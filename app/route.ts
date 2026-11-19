import { view } from './view';
import {getAccount} from '../lib/accounts';
import {protectionHeaders} from '../lib/security';
import {publicSeo} from '../lib/search-metadata.mjs';
import {option} from '../lib/store';
import {publicOrigin} from '../lib/public-address';
import {env} from 'cloudflare:workers';
export const dynamic = 'force-dynamic';
export async function GET(request:Request) {
 let member=false;try{member=!!await getAccount(request)}catch{}
 let verification=env.GOOGLE_SITE_VERIFICATION||'';try{verification=(await option('google_site_verification'))||verification}catch{}
 let songCount:number|null=null;
 try{if(env.DB){const row=await env.DB.prepare('SELECT COUNT(DISTINCT slug) AS total FROM songs').first<{total:number}>();if(row&&Number.isFinite(Number(row.total)))songCount=Number(row.total)}}catch(error){console.error('D1 count unavailable',error instanceof Error?error.name:'unknown')}
 const liveCount=songCount===null?'':'<div class="badge" id="d1-song-count" role="status">Đã cập nhật '+songCount.toLocaleString('vi-VN')+' bài hát</div>';
 const readerActions = view.replace('<section class="music-launch">', liveCount+'<section class="music-launch">').replace('<div class="reader-actions">', '<div class="reader-actions"><form action="/tao-ban-pho"><button type="submit" id="reader-audio-sheet">Tạo Sheet bằng AI</button></form>');
 const html=publicSeo(readerActions.replace('data-page="library"',`data-page="library" data-membership="${member?'member':'guest'}"`),publicOrigin(request),'/',verification);
  return new Response(html,{headers:{...protectionHeaders,'Permissions-Policy':'camera=(self), microphone=(self), display-capture=(self), geolocation=()','Content-Type':'text/html; charset=utf-8','Cache-Control':member?'private, no-store':'public, max-age=60','Content-Security-Policy':"frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com; object-src 'none'; base-uri 'self'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com"}});
}
