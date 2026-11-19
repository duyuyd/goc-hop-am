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
 const imported=params.get('imported');
 if(imported!==null){
  if(url||params.has('id')||imported.length>160||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(imported))
   return Response.json({error:'Đường dẫn bài nhập không hợp lệ.'},{status:400});
  if(!env.DB)return Response.json({error:'D1 chưa kết nối.'},{status:503});
  try{
   const song=await env.DB.prepare('SELECT title,artist,slug,chords_text,lyrics_text,source_name FROM songs WHERE slug=? LIMIT 1').bind(imported).first<{title:string;artist:string;slug:string;chords_text:string;lyrics_text:string;source_name:string}>();
   if(!song)return Response.json({error:'Không tìm thấy bài hát.'},{status:404});
   const content=song.chords_text||song.lyrics_text;
   const key=content.match(/\[([A-G](?:#|b)?m?)\]/)?.[1]||'C';
   return Response.json({song:{id:'goc-import-'+song.slug,title:song.title,author:song.artist,sourceUrl:'goc-import:'+song.slug,source:song.source_name,key,content}},{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex'}});
  }catch(error){console.error('Imported D1 reader error',error instanceof Error?error.name:'unknown');return Response.json({error:'Không đọc được dữ liệu D1.'},{status:503});}
 }
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
