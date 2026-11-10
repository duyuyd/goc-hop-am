import {env} from 'cloudflare:workers';
import {AppError,body,db,getAccount,json,rate,requireAccount} from './accounts';
import {publicLimit} from './security';
import {catalog,sourceFor} from './music-catalog.mjs';
import {musicSnapshot} from './music-cache.mjs';
import {verificationToken} from './search-metadata.mjs';
type Product={id:string;title:string;description:string;kind:string;cover:string;pages:number;bytes:number;price_vnd:number;selling:number;file_key:string};
type Order={id:string;account_id:string;product_id:string;title:string;amount_vnd:number;status:string;payment_ref:string;buyer_note:string;admin_note:string;created_at:number;updated_at:number};
export async function option(key:string,fallback=''){const row=await db().prepare('SELECT value FROM site_settings WHERE key=?').bind(key).first<{value:string}>();return row?.value??fallback}
export async function setOption(key:string,value:string){await db().prepare('INSERT INTO site_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,value).run()}
function productView(p:Product){return {id:p.id,title:p.title,description:p.description,cover:p.cover,pages:p.pages,bytes:p.bytes,priceVnd:p.price_vnd,selling:!!p.selling&&p.price_vnd>=1000,ready:!!p.file_key}}
export async function storeGet(request:Request){
 const limited=publicLimit(request,'store',90);if(limited)return limited;
 const user=await getAccount(request),params=new URL(request.url).searchParams,id=params.get('order');
 if(id){if(!user)throw new AppError(401,'Đăng nhập để xem đơn hàng.');const order=await ownedOrder(id,user.id);return json({order,recipient:{name:'Thế Duy',maskedAccount:'•••••••922'},qr:'/api/store/qr?order='+encodeURIComponent(order.id)})}
 const products=await db().prepare("SELECT * FROM store_products WHERE kind='sale' ORDER BY id DESC").all<Product>();
 const orders=user?await db().prepare('SELECT id,product_id,title,amount_vnd,status,admin_note,created_at,updated_at FROM store_orders WHERE account_id=? ORDER BY created_at DESC LIMIT 100').bind(user.id).all():{results:[]};
 return json({products:products.results.map(productView),orders:orders.results,user:user?{name:user.name,role:user.role}:null});
}
async function ownedOrder(id:string,userId:string){if(!/^[A-Z0-9]{16}$/.test(id))throw new AppError(404,'Không tìm thấy đơn hàng.');const order=await db().prepare('SELECT * FROM store_orders WHERE id=? AND account_id=?').bind(id,userId).first<Order>();if(!order)throw new AppError(404,'Không tìm thấy đơn hàng.');return order}
export async function storeAction(request:Request){
 const user=await requireAccount(request),data=await body(request);await rate(request,'store:'+user.id,40);
 if(data.action==='order'){
  const id=typeof data.productId==='string'?data.productId:'';
  const product=await db().prepare("SELECT * FROM store_products WHERE id=? AND kind='sale'").bind(id).first<Product>();
  if(!product||!product.file_key||!product.selling||product.price_vnd<1000)throw new AppError(409,'Tài liệu này chưa mở bán.');
  const existing=await db().prepare("SELECT * FROM store_orders WHERE account_id=? AND product_id=? AND status IN ('pending','review','paid') ORDER BY CASE WHEN status='paid' THEN 0 ELSE 1 END,created_at DESC LIMIT 1").bind(user.id,id).first<Order>();if(existing)return json({order:existing});
  const orderId='GHA'+crypto.randomUUID().replaceAll('-','').slice(0,13).toUpperCase(),now=Date.now();
  try{await db().prepare("INSERT INTO store_orders(id,account_id,product_id,title,amount_vnd,status,created_at,updated_at) VALUES(?,?,?,?,?,'pending',?,?)").bind(orderId,user.id,id,product.title,product.price_vnd,now,now).run()}catch(error){const duplicate=await db().prepare("SELECT * FROM store_orders WHERE account_id=? AND product_id=? AND status IN ('pending','review') LIMIT 1").bind(user.id,id).first<Order>();if(duplicate)return json({order:duplicate});throw error}
  return json({order:await ownedOrder(orderId,user.id)});
 }
 if(data.action==='submitted'){
  const order=await ownedOrder(String(data.orderId||''),user.id);if(!['pending','rejected'].includes(order.status))return json({order});
  const reference=typeof data.reference==='string'?data.reference.trim().slice(0,100):'',note=typeof data.note==='string'?data.note.trim().slice(0,400):'';
  if(!reference)throw new AppError(400,'Nhập mã giao dịch để người bán đối soát.');
  await db().prepare("UPDATE store_orders SET status='review',payment_ref=?,buyer_note=?,updated_at=? WHERE id=? AND account_id=? AND status IN ('pending','rejected')").bind(reference,note,Date.now(),order.id,user.id).run();
  return json({order:await ownedOrder(order.id,user.id)});
 }
 throw new AppError(400,'Thao tác không hợp lệ.');
}
export async function orderQr(request:Request){const user=await requireAccount(request),order=await ownedOrder(new URL(request.url).searchParams.get('order')||'',user.id);if(!['pending','review'].includes(order.status))throw new AppError(409,'Đơn này không cần thanh toán thêm.');const key=await option('payment_qr_key');if(!key||!env.BUCKET)throw new AppError(503,'Mã QR chưa sẵn sàng.');const file=await env.BUCKET.get(key);if(!file)throw new AppError(503,'Mã QR chưa sẵn sàng.');return new Response(file.body,{headers:{'Content-Type':'image/png','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})}
export async function downloadProduct(request:Request){
 const user=await requireAccount(request),limit=publicLimit(request,'download',24);if(limit)return limit;
 const id=new URL(request.url).searchParams.get('product')||'',product=await db().prepare('SELECT * FROM store_products WHERE id=?').bind(id).first<Product>();if(!product)throw new AppError(404,'Không tìm thấy tài liệu.');
 if(user.role!=='admin'){const paid=await db().prepare("SELECT id FROM store_orders WHERE account_id=? AND status='paid'"+(product.kind==='bonus'?'':' AND product_id=?')+' LIMIT 1').bind(...(product.kind==='bonus'?[user.id]:[user.id,id])).first();if(!paid)throw new AppError(403,'Tài liệu chỉ mở tải sau khi đơn được xác nhận đã nhận tiền.')}
 if(!env.BUCKET)throw new AppError(503,'Kho tài liệu chưa sẵn sàng.');const file=await env.BUCKET.get(product.file_key);if(!file)throw new AppError(503,'Tệp đang được cập nhật.');
 return new Response(file.body,{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="Goc-Hop-Am-'+product.id+'.pdf"','Content-Length':String(file.size),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':'sandbox'}});
}
export async function commerceGet(request:Request){await requireAccount(request,true);const products=await db().prepare('SELECT * FROM store_products ORDER BY id').all<Product>(),orders=await db().prepare('SELECT o.*,a.username,a.name FROM store_orders o JOIN accounts a ON a.id=o.account_id ORDER BY o.created_at DESC LIMIT 100').all();return json({products:products.results.map(p=>({...productView(p),kind:p.kind})),orders:orders.results,googleClientId:await option('google_client_id'),googleSiteVerification:(await option('google_site_verification'))||env.GOOGLE_SITE_VERIFICATION||'',release:'2.0.0'})}
export async function commerceAction(request:Request){
 const user=await requireAccount(request,true),data=await body(request);
 if(data.action==='refresh'){
  await rate(request,'catalog-refresh:'+user.id,12);
  const results=await Promise.all(['home','latest'].map(async mode=>{const params=new URLSearchParams({mode});return musicSnapshot(db(),'catalog:'+sourceFor(params).url,()=>catalog(params,fetch,{force:true}),{ttl:0})}));
  return json({ok:true,count:results.reduce((n,result)=>n+(result.items?.length||0),0),stale:results.some(result=>result.stale)});
 }
 if(data.action==='product'){
  const price=Number(data.priceVnd),selling=data.selling===true,id=String(data.productId||'');
  if(!Number.isSafeInteger(price)||price<0||price>10000000||(selling&&price<1000))throw new AppError(400,'Giá bán cần là số đồng nguyên, từ 1.000đ khi mở bán.');
  const product=await db().prepare("SELECT id FROM store_products WHERE id=? AND kind='sale'").bind(id).first();if(!product)throw new AppError(404,'Không tìm thấy tài liệu.');
  await db().prepare('UPDATE store_products SET price_vnd=?,selling=?,updated_at=? WHERE id=?').bind(price,selling?1:0,Date.now(),id).run();return json({ok:true});
 }
 if(data.action==='review'){
  const decision=data.decision==='paid'?'paid':data.decision==='rejected'?'rejected':null;if(!decision)throw new AppError(400,'Trạng thái chưa hợp lệ.');
  const note=typeof data.note==='string'?data.note.trim().slice(0,400):'';
  const row=await db().prepare("UPDATE store_orders SET status=?,admin_note=?,reviewed_by=?,reviewed_at=?,updated_at=? WHERE id=? AND status='review' RETURNING id").bind(decision,note,user.id,Date.now(),Date.now(),String(data.orderId||'')).first();
  if(!row)throw new AppError(409,'Đơn đã được xử lý hoặc chưa gửi đối soát.');return json({ok:true});
 }
 if(data.action==='google'){
  const client=String(data.clientId||'').trim();if(client&&!/^\d+-[a-z0-9-]+\.apps\.googleusercontent\.com$/.test(client))throw new AppError(400,'Client ID Google chưa đúng định dạng.');await setOption('google_client_id',client);return json({ok:true});
 }
 if(data.action==='search-verification'){
  let token;try{token=verificationToken(data.verification)}catch{throw new AppError(400,'Dán mã hoặc thẻ HTML google-site-verification do Search Console cấp. Không dùng Client ID hay Client Secret.');}
  await setOption('google_site_verification',token);return json({ok:true});
 }
 throw new AppError(400,'Thao tác không hợp lệ.');
}
