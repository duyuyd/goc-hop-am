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
 const readerActions = view.replace('<div class="reader-actions">', '<div class="reader-actions"><button type="button" id="reader-auto-sheet">Tạo Sheet bằng AI</button><form action="/tao-ban-pho"><button type="submit" id="reader-audio-sheet">Tạo sheet từ file</button></form>').replace('/live.js?v=145','/live.js?v=146');
 const html=publicSeo(readerActions.replace('data-page="library"',`data-page="library" data-membership="${member?'member':'guest'}"`),publicOrigin(request),'/',verification);
  return new Response(html,{headers:{...protectionHeaders,'Permissions-Policy':'camera=(self), microphone=(self), display-capture=(self), geolocation=()','Content-Type':'text/html; charset=utf-8','Cache-Control':member?'private, no-store':'public, max-age=60','Content-Security-Policy':"frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com; object-src 'none'; base-uri 'self'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com"}});
}
