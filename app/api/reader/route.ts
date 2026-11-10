import { safeSongUrl } from '../../../lib/music-catalog.mjs';
import { readSong } from '../../../lib/song-reader.mjs';
import { musicSnapshot } from '../../../lib/music-cache.mjs';
import { readCommunitySong } from '../../../lib/community-catalog.mjs';
import { communitySongRef,songReferenceId } from '../../../public/mobile/logic.js';
import { env } from 'cloudflare:workers';
import {publicLimit} from '../../../lib/security';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
 const limited=publicLimit(request,'reader',120);if(limited)return limited;
 const params=new URL(request.url).searchParams,url=params.get('url');
 const localId=params.get('id'),localRef=params.has('url')?null:communitySongRef(localId);
 if(params.has('id')?!localRef:!url||!safeSongUrl(url))return Response.json({error:'Bài hát không hợp lệ.'},{status:400});
 try {
  if(localRef){
   const song=env.DB?await readCommunitySong(env.DB,localId):null;
   const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex'};
   if(!song)return Response.json({error:'Không tìm thấy bài hát.'},{status:404,headers});
   return Response.json({song:{...song,id:songReferenceId(localRef),sourceUrl:localRef}},{headers});
  }
  const safe=safeSongUrl(url!)!;
  const retrieve=async()=>({song:await readSong(safe)});
  const data=env.DB?await musicSnapshot(env.DB,'reader:v2:'+safe,retrieve,{ttl:600000}):await retrieve();
  return Response.json(data,{headers:{'Cache-Control':data.stale?'no-store':'public, max-age=120','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex'}});
 } catch (error) {
  console.error('Song retrieval failed:',error instanceof Error?error.message:'unknown');
  return Response.json({error:'Chưa tải được lời và hợp âm của bài này. Hãy bấm thử lại.'},{status:502,headers:{'Cache-Control':'no-store'}});
 }
}
