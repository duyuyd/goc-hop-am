import {env} from 'cloudflare:workers';
import {AppError,db,json,requireAccount,requireOrigin} from './accounts';
import {boundedBytes} from './security';
import documents from '../data/store-products.json';
const hex=(buffer:ArrayBuffer)=>Array.from(new Uint8Array(buffer),v=>v.toString(16).padStart(2,'0')).join('');
async function putPdf(request:Request,id:string,expected?:typeof documents[number]){
 if(!env.BUCKET)throw new AppError(503,'Kho tệp chưa sẵn sàng.');
 let bytes;try{bytes=await boundedBytes(request,8*1024*1024)}catch{throw new AppError(413,'Tệp PDF tối đa 8MB.')}
 if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new AppError(400,'Tệp chưa đúng định dạng PDF.');
 const hash=hex(await crypto.subtle.digest('SHA-256',bytes));if(expected&&(hash!==expected.sha256||bytes.length!==expected.bytes))throw new AppError(400,'Tệp không trùng bản tài liệu đã chuẩn bị.');
 const key='products/'+id+'/'+hash+'.pdf';await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:'application/pdf'}});return {key,hash,bytes:bytes.length};
}
export async function adminUpload(request:Request){await requireAccount(request,true);requireOrigin(request);const id=request.headers.get('x-product-id')||'';if(!documents.some(p=>p.id===id))throw new AppError(400,'Tài liệu chưa hợp lệ.');const existing=await db().prepare('SELECT id FROM store_products WHERE id=?').bind(id).first();if(!existing)throw new AppError(404,'Tài liệu chưa được khởi tạo.');const file=await putPdf(request,id);await db().prepare('UPDATE store_products SET file_key=?,sha256=?,bytes=?,updated_at=? WHERE id=?').bind(file.key,file.hash,file.bytes,Date.now(),id).run();return json({ok:true})}
