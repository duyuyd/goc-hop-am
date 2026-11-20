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
 const readerActions = view.replace('<div class="reader-actions">', '<div class="reader-actions"><form action="/tao-ban-pho"><button type="submit" id="reader-audio-sheet">Tạo Sheet bằng AI</button></form>');
 const html=publicSeo(readerActions.replace('data-page="library"',`data-page="library" data-membership="${member?'member':'guest'}"`),publicOrigin(request),'/',verification);
  const enhanced=html.replace('</head>','<script src="https://js.puter.com/v2/" defer></script><script src="/puter-assistant.js" defer></script></head>').replace('<button id="reader-sheet">','<a id="reader-chord-chart" href="/chord-chart" class="reader-chord-link">♫ Biểu đồ hợp âm</a><button id="reader-sheet">');
  return new Response(enhanced,{headers:{...protectionHeaders,'Permissions-Policy':'camera=(self), microphone=(self), display-capture=(self), geolocation=()','Content-Type':'text/html; charset=utf-8','Cache-Control':member?'private, no-store':'public, max-age=60','Content-Security-Policy':"frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com; object-src 'none'; base-uri 'self'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com"}});
}
