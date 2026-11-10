import {videoCaptions,captionFailure} from '../../../lib/video-captions.mjs';
import {publicLimit} from '../../../lib/security';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const limited=publicLimit(request,'video-captions',20);if(limited)return limited;
 const id=new URL(request.url).searchParams.get('id')||'';
 if(!/^[A-Za-z0-9_-]{11}$/.test(id))return Response.json({error:'Liên kết video không hợp lệ.'},{status:400});
 try{const data=await videoCaptions(id);return Response.json(data,{headers:{'Cache-Control':data.available?'public, max-age=120':'no-store','X-Content-Type-Options':'nosniff'}})}
 catch{return Response.json(captionFailure(id),{headers:{'Cache-Control':'no-store'}})}
}
