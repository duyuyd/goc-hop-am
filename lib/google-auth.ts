import {AppError,body,db,issueSession,json,rate,type Account} from './accounts';
import {newToken,tokenHash,hashPassword} from './passwords.mjs';
import {verifyGoogleToken} from './google-token.mjs';
import {option} from './store';
const nonceCookie=(request:Request,value:string,seconds=300)=>`goc_google_nonce=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${new URL(request.url).protocol==='https:'?'; Secure':''}`;
export async function googleChallenge(request:Request){
 const clientId=await option('google_client_id');if(!clientId)throw new AppError(503,'Đăng nhập Google chưa được bật. Bạn có thể dùng tài khoản của website.');
 await rate(request,'google-challenge',30);const nonce=newToken();
 await db().batch([db().prepare('DELETE FROM google_nonces WHERE expires_at<?').bind(Date.now()),db().prepare('INSERT INTO google_nonces(hash,expires_at) VALUES(?,?)').bind(await tokenHash(nonce),Date.now()+300000)]);
 return json({clientId,nonce},200,{'Set-Cookie':nonceCookie(request,nonce)});
}
export async function googleAccount(identity:{subject:string;email:string;name:string}):Promise<Account>{
 const known=await db().prepare('SELECT a.id,a.username,a.name,a.role,a.created_at FROM accounts a JOIN google_identities g ON g.account_id=a.id WHERE g.subject=?').bind(identity.subject).first<Account>();if(known)return {...known,provider:'google'};
 // Never merge an existing password account by email or caller-supplied role.
 const id=crypto.randomUUID(),username='g_'+crypto.randomUUID().replaceAll('-','').slice(0,24),now=Date.now();
 try{await db().batch([
  db().prepare('INSERT INTO accounts(id,username,name,password_hash,role,created_at) VALUES(?,?,?,?,?,?)').bind(id,username,identity.name,await hashPassword(newToken()),'member',now),
  db().prepare('INSERT INTO google_identities(subject,account_id,email,created_at) VALUES(?,?,?,?)').bind(identity.subject,id,identity.email,now)
 ])}catch(error){const concurrent=await db().prepare('SELECT a.id,a.username,a.name,a.role,a.created_at FROM accounts a JOIN google_identities g ON g.account_id=a.id WHERE g.subject=?').bind(identity.subject).first<Account>();if(concurrent)return {...concurrent,provider:'google'};throw error}
 return {id,username,name:identity.name,role:'member',created_at:now,provider:'google'};
}
export async function googleSignIn(request:Request){
 const data=await body(request);await rate(request,'google-login',20);
 const clientId=await option('google_client_id');if(!clientId)throw new AppError(503,'Đăng nhập Google chưa được bật.');
 const nonce=request.headers.get('cookie')?.match(/(?:^|;\s*)goc_google_nonce=([a-f0-9]{64})(?:;|$)/)?.[1];if(!nonce)throw new AppError(400,'Phiên đăng nhập Google đã hết hạn. Hãy thử lại.');
 const used=await db().prepare('DELETE FROM google_nonces WHERE hash=? AND expires_at>? RETURNING hash').bind(await tokenHash(nonce),Date.now()).first();if(!used)throw new AppError(400,'Phiên đăng nhập Google đã được dùng hoặc hết hạn.');
 let identity;try{identity=await verifyGoogleToken(data.credential,clientId,nonce)}catch{throw new AppError(401,'Không xác minh được tài khoản Google. Hãy thử lại.')}
 const result=await issueSession(request,await googleAccount(identity));result.headers.append('Set-Cookie',nonceCookie(request,'',0));return result;
}
