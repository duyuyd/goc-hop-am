import { env } from 'cloudflare:workers';
import { hashPassword, verifyPassword, tokenHash, newToken } from './passwords.mjs';
import {boundedBytes,protectionHeaders} from './security';
export type Account={id:string;username:string;name:string;role:'admin'|'member';created_at:number;provider?:string};
export class AppError extends Error { constructor(public status:number,message:string){super(message)} }
const sessionSeconds=7*24*60*60;
const settingsDefaults={title:'Góc Hợp Âm',tagline:'Âm nhạc có chỗ cho mọi cảm xúc.'};
export function db(){if(!env.DB)throw new AppError(503,'Hệ thống tài khoản đang được khởi tạo. Vui lòng thử lại sau.');return env.DB}
export function json(value:unknown,status=200,headers:Record<string,string>={}){return Response.json(value,{status,headers:{...protectionHeaders,'Cache-Control':'no-store','X-Robots-Tag':'noindex',...headers}})}
export function failure(error:unknown){if(error instanceof AppError)return json({error:error.message},error.status);console.error('account operation failed',error instanceof Error?error.name:'error');return json({error:'Chưa thực hiện được yêu cầu. Vui lòng thử lại.'},500)}
export function requireOrigin(request:Request){if(request.headers.get('origin')!==new URL(request.url).origin)throw new AppError(403,'Yêu cầu không hợp lệ. Hãy tải lại trang.');}
export async function body(request:Request){requireOrigin(request);if(!(request.headers.get('content-type')||'').includes('application/json'))throw new AppError(415,'Định dạng không hợp lệ.');let data;try{data=JSON.parse(new TextDecoder().decode(await boundedBytes(request,100000)))}catch(e){if(e instanceof Error&&e.message==='body_too_large')throw new AppError(413,'Nội dung quá lớn.');throw new AppError(400,'Nội dung không hợp lệ.')}if(!data||typeof data!=='object'||Array.isArray(data))throw new AppError(400,'Nội dung không hợp lệ.');return data as Record<string,unknown>}
const str=(v:unknown)=>typeof v==='string'?v.trim():'';
export function cookieToken(request:Request){return request.headers.get('cookie')?.match(/(?:^|;\s*)goc_session=([a-f0-9]{64})(?:;|$)/)?.[1]||null}
function cookie(request:Request,value:string,maxAge=sessionSeconds){return `goc_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(request.url).protocol==='https:'?'; Secure':''}`}
export async function getAccount(request:Request):Promise<Account|null>{const token=cookieToken(request);if(!token)return null;return await db().prepare("SELECT a.id,a.username,a.name,a.role,a.created_at,CASE WHEN EXISTS(SELECT 1 FROM google_identities g WHERE g.account_id=a.id) THEN 'google' ELSE 'password' END AS provider FROM account_sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>?" ).bind(await tokenHash(token),Date.now()).first<Account>()}
export async function requireAccount(request:Request,admin=false){const user=await getAccount(request);if(!user)throw new AppError(401,'Vui lòng đăng nhập để tiếp tục.');if(admin&&user.role!=='admin')throw new AppError(403,'Tài khoản này không có quyền quản trị.');return user}
export async function rate(request:Request,name:string,maximum:number){const key=await tokenHash((request.headers.get('cf-connecting-ip')||'local')+':'+name);const bucket=Math.floor(Date.now()/900000);const row=await db().prepare('INSERT INTO auth_limits(key,bucket,attempts) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN auth_limits.bucket=excluded.bucket THEN auth_limits.attempts+1 ELSE 1 END,bucket=excluded.bucket RETURNING attempts').bind(key,bucket).first<{attempts:number}>();if((row?.attempts||0)>maximum)throw new AppError(429,'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.');}
export async function authAction(request:Request){
 const data=await body(request),action=str(data.action);
 if(action==='logout'){const token=cookieToken(request);if(token)await db().prepare('DELETE FROM account_sessions WHERE token_hash=?').bind(await tokenHash(token)).run();return json({ok:true},200,{'Set-Cookie':cookie(request,'',0)})}
 if(action==='password'){
  const user=await requireAccount(request);await rate(request,'change:'+user.id,8);const row=await db().prepare('SELECT password_hash FROM accounts WHERE id=?').bind(user.id).first<{password_hash:string}>();
  const password=typeof data.password==='string'?data.password:'',next=typeof data.newPassword==='string'?data.newPassword:'';if(!row||!(await verifyPassword(password,row.password_hash)))throw new AppError(400,'Mật khẩu hiện tại chưa đúng.');if(next.length<10||next.length>128)throw new AppError(400,'Mật khẩu mới cần từ 10 đến 128 ký tự.');const hash=await hashPassword(next),token=cookieToken(request)!;await db().batch([db().prepare('UPDATE accounts SET password_hash=? WHERE id=?').bind(hash,user.id),db().prepare('DELETE FROM account_sessions WHERE account_id=? AND token_hash<>?').bind(user.id,await tokenHash(token))]);return json({ok:true});
 }
 const username=str(data.username).toLowerCase(),password=typeof data.password==='string'?data.password:'';
 if(!/^[a-z0-9_.-]{3,32}$/.test(username)||password.length>128)throw new AppError(400,'Tên đăng nhập cần 3–32 ký tự: chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.');
 const adminName=String(env.ADMIN_USERNAME||'admin').toLowerCase();
 await rate(request,'auth-global',60);
 await rate(request,(action==='register'?'register':'login')+':'+username,action==='register'?5:12);
 let user:Account|null=null;
 if(action==='register'){
  await rate(request,'register-global',12);if(password.length<10)throw new AppError(400,'Mật khẩu cần ít nhất 10 ký tự.');const name=str(data.name);if(!name||name.length>80)throw new AppError(400,'Vui lòng nhập tên hiển thị từ 1 đến 80 ký tự.');
  if(username===adminName||await db().prepare('SELECT id FROM accounts WHERE username=?').bind(username).first())throw new AppError(409,'Tên đăng nhập đã được sử dụng.');
  user={id:crypto.randomUUID(),username,name,role:'member',created_at:Date.now()};
  try{await db().prepare('INSERT INTO accounts(id,username,name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').bind(user.id,username,name,await hashPassword(password),'member',user.created_at).run()}catch{throw new AppError(409,'Tên đăng nhập đã được sử dụng.')}
 }else if(action==='login'){
  let row=await db().prepare('SELECT id,username,name,role,created_at,password_hash FROM accounts WHERE username=?').bind(username).first<Account&{password_hash:string}>();
  if(!row&&username===adminName&&env.ADMIN_PASSWORD_HASH&&await verifyPassword(password,env.ADMIN_PASSWORD_HASH)){
   const admin:Account={id:'site-owner-admin',username,name:'Quản trị viên',role:'admin',created_at:Date.now()};
   await db().prepare('INSERT OR IGNORE INTO accounts(id,username,name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').bind(admin.id,username,admin.name,env.ADMIN_PASSWORD_HASH,'admin',admin.created_at).run();
   row=await db().prepare('SELECT id,username,name,role,created_at,password_hash FROM accounts WHERE username=?').bind(username).first<Account&{password_hash:string}>();
  }
  if(!row||!await verifyPassword(password,row.password_hash))throw new AppError(401,'Tên đăng nhập hoặc mật khẩu chưa đúng.');
  user={id:row.id,username:row.username,name:row.name,role:row.role,created_at:row.created_at};
 }else throw new AppError(400,'Thao tác không hợp lệ.');
 return issueSession(request,user);
}
export async function issueSession(request:Request,user:Account){const token=newToken();await db().prepare('INSERT INTO account_sessions(token_hash,account_id,expires_at) VALUES(?,?,?)').bind(await tokenHash(token),user.id,Date.now()+sessionSeconds*1000).run();return json({user},200,{'Set-Cookie':cookie(request,token)});
}
export async function settings(){const rows=await db().prepare('SELECT key,value FROM site_settings').all<{key:string,value:string}>();const values={...settingsDefaults};for(const row of rows.results||[])if(row.key==='title'||row.key==='tagline')values[row.key]=row.value;return values}
export async function adminGet(request:Request){const user=await requireAccount(request,true);const [members,songs]=await Promise.all([db().prepare('SELECT id,username,name,role,created_at FROM accounts ORDER BY created_at DESC LIMIT 100').all(),db().prepare('SELECT id,title,author,genre,rhythm,key,content,published,created_at,updated_at FROM community_songs ORDER BY updated_at DESC LIMIT 100').all()]);const stats=await db().prepare('SELECT (SELECT COUNT(*) FROM accounts) AS members,(SELECT COUNT(*) FROM community_songs) AS songs,(SELECT COUNT(*) FROM community_songs WHERE published=1) AS published').first();return json({user,stats,members:members.results,songs:songs.results,settings:await settings()})}
export async function adminAction(request:Request){await requireAccount(request,true);const data=await body(request);
 if(data.action==='settings'){const title=str(data.title),tagline=str(data.tagline);if(!title||title.length>60||tagline.length>160)throw new AppError(400,'Tên trang tối đa 60 ký tự; mô tả tối đa 160 ký tự.');await db().batch([db().prepare('INSERT INTO site_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('title',title),db().prepare('INSERT INTO site_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('tagline',tagline)]);return json({ok:true})}
 if(data.action==='song'){
  const title=str(data.title),content=typeof data.content==='string'?data.content.trim():'';if(!title||title.length>180||!content||content.length>60000)throw new AppError(400,'Cần tên bài (tối đa 180 ký tự) và lời kèm hợp âm (tối đa 60.000 ký tự).');
  const key=str(data.key)||'C';if(!/^[A-G](?:#|b)?m?$/.test(key))throw new AppError(400,'Tông chưa hợp lệ. Ví dụ: C, Am, F#m.');
  const id=str(data.id)||crypto.randomUUID();if(id.length>80)throw new AppError(400,'Mã bài không hợp lệ.');const now=Date.now();
  await db().prepare('INSERT INTO community_songs(id,title,author,genre,rhythm,key,content,published,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,author=excluded.author,genre=excluded.genre,rhythm=excluded.rhythm,key=excluded.key,content=excluded.content,published=excluded.published,updated_at=excluded.updated_at').bind(id,title,str(data.author).slice(0,180),str(data.genre).slice(0,80),str(data.rhythm).slice(0,80),key,content,data.published===false?0:1,now,now).run();return json({ok:true,id})
 }
 throw new AppError(400,'Thao tác không hợp lệ.');
}
