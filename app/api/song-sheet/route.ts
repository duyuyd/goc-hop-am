import {sourceSheet,sheetPdf,pdfChunk,sheetIndex} from '../../../lib/source-sheets.mjs';
import {publicLimit} from '../../../lib/security';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const limited=publicLimit(request,'song-sheet',160);if(limited)return limited;
 const query=new URL(request.url).searchParams;
 try{
  if(query.get('list')==='1')return Response.json(await sheetIndex(Number(query.get('page')||0)),{headers:{'Cache-Control':'public, max-age=120'}});
  const url=query.get('url')||'';if(!/^https:\/\/hopamviet\.vn\/chord\/song\/[a-z0-9-]+\/[A-Za-z0-9]+\.html$/.test(url))return Response.json({error:'Bài hát không hợp lệ.'},{status:400});
  if(query.has('file')){const file=Number(query.get('file'));if(!Number.isInteger(file)||file<0||file>11)return Response.json({error:'Bản phổ không hợp lệ.'},{status:400});const bytes=await sheetPdf(url,file);
   if(query.get('download')==='1')return new Response(bytes,{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="Goc_Hop_Am_Ban_Pho.pdf"','Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff'}});
   return Response.json(pdfChunk(bytes,Number(query.get('part')||0)),{headers:{'Cache-Control':'public, max-age=300'}});
  }
  const data=await sourceSheet(url);return Response.json({...data,files:data.files.map((file:string,index:number)=>({index,name:decodeURIComponent(file.split('/').at(-1)||'Bản phổ')}))},{headers:{'Cache-Control':data.available?'public, max-age=300':'no-store'}});
 }catch{return Response.json({available:false,code:'unavailable',files:[],error:'Chưa đọc được bản phổ từ nguồn lúc này. Thử lại sau; ứng dụng không tạo nốt thay thế.',reason:'Chưa đọc được bản phổ từ nguồn lúc này. Thử lại sau; ứng dụng không tạo nốt thay thế.'},{headers:{'Cache-Control':'no-store'}})}
}
