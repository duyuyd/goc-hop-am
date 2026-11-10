import { decodeEntities } from '../public/text.js';
import {singleFlight} from './single-flight.mjs';
export const ORIGIN = 'https://hopamviet.vn';
export const SOURCE_HEADERS = {Accept:'text/html','Accept-Language':'vi,en;q=0.7','User-Agent':'GocHopAm/1.0'};
export const GENRES = [
 {id:1,name:'Nhạc Vàng',slug:'nhac-vang',icon:'🎵'},
 {id:2,name:'Nhạc Trữ tình',slug:'nhac-tru-tinh',icon:'💕'},
 {id:3,name:'Nhạc Trẻ',slug:'nhac-tre',icon:'🔥'},
 {id:4,name:'Nhạc Quê hương',slug:'nhac-que-huong',icon:'🌿'},
 {id:5,name:'Nhạc Ngoại lời Việt',slug:'nhac-ngoai-loi-viet',icon:'🌍'},
 {id:6,name:'Nhạc Đỏ',slug:'nhac-do',icon:'🚩'},
 {id:7,name:'Nhạc Dân ca',slug:'nhac-dan-ca',icon:'🛶'},
 {id:8,name:'Nhạc Quốc tế',slug:'nhac-quoc-te',icon:'🌐'},
 {id:9,name:'Nhạc Học trò',slug:'nhac-hoc-tro',icon:'🎓'},
 {id:10,name:'Nhạc Thiếu nhi',slug:'nhac-thieu-nhi',icon:'🧸'},
 {id:11,name:'Nhạc Thánh ca',slug:'nhac-thanh-ca',icon:'✨'},
 {id:12,name:'Nhạc Phật giáo',slug:'nhac-phat-giao',icon:'☸️'},
 {id:13,name:'Nhạc Chế - Vui',slug:'nhac-che-vui',icon:'😄'}
];
export function clean(s='') {
 return decodeEntities(s.replace(/<!--[\s\S]*?-->/g,' ').replace(/<svg\b[\s\S]*?<\/svg>/gi,' ').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
}
function num(s){const digits=String(s??'').replace(/[^\d]/g,'');return digits?Number(digits):null}
export function safeSongUrl(value){try{const u=new URL(value,ORIGIN);return u.origin===ORIGIN&&!u.username&&!u.password&&/^\/chord\/song\/[a-z0-9-]+\/[A-Za-z0-9]+\.html$/.test(u.pathname)?u.origin+u.pathname:null}catch{return null}}
export function parseCatalog(html, sourceUrl=ORIGIN, page=0, kind='browse') {
 const items=[], featured=[],seen=new Set();
 const mainHtml=kind==='home'?html:html.split(/<aside\b/i)[0];
 const anchors=mainHtml.matchAll(/<a\b([^>]*?)>([\s\S]*?)<\/a>/gi);
 for(const [,attrs,body] of anchors){
  const classes=attrs.match(/\bclass=["']([^"']*)["']/i)?.[1]||'';
  if(!/(?:^|\s)(?:featured-song-card|song-card)(?:\s|$)/.test(classes))continue;
  const url=safeSongUrl(attrs.match(/\bhref="([^"]+)"/i)?.[1]);if(!url)continue;
  const isFeature=classes.includes('featured-song-card');
  const title=clean(isFeature?(body.match(/<h[2-5]\b[^>]*>([\s\S]*?)<\/h[2-5]>/i)?.[1]||''):(body.match(/<div\b[^>]*class="[^"]*font-bold[^"\n]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1]||''));
  if(!title)continue;
  let author='',singer='';
  if(isFeature){const paragraphs=[...body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(x=>clean(x[1]));author=paragraphs[0]||'';singer=paragraphs[1]||''}
  else {author=[...body.matchAll(/<span\b[^>]*class="truncate"[^>]*>([\s\S]*?)<\/span>/gi)].map(x=>clean(x[1])).join(', ')}
  const thumbnail=body.match(/https:\/\/(?:img|i)\.youtube\.com\/vi\/([A-Za-z0-9_-]{11})\/[A-Za-z0-9_-]+\.jpg/)?.[0]||null;
  const views=clean(body.match(/<div\b[^>]*(?:title="Tổng lượt xem"|aria-label="[^"]*Tổng lượt xem")[^>]*>([\s\S]*?)<\/div>/i)?.[1]||'');
  const item={id:url.split('/').at(-1).replace('.html',''),title,author,singer,url,thumbnail,views,source:'Hợp Âm Việt'};
  if(isFeature)featured.push(item);
  if(!seen.has(item.id)){seen.add(item.id);items.push(item)}
 }
 let total=null;
 if(kind==='search')total=num(html.match(/<strong[^>]*>([\d.,\s]+)<\/strong>\s*(?:kết quả|tác phẩm khớp tìm kiếm|bài hát)/i)?.[1]);
 else total=num(html.match(/([\d.,]+)\s*bài hát\s*</i)?.[1]);
 const inventory=num(html.match(/<strong\b[^>]*class="font-black"[^>]*>([\d.,]+)<\/strong>\s*(?:&nbsp;|\s)*hợp âm/i)?.[1]);
 const next=/<a\b[^>]*\brel=["']next["']/i.test(html)||[...html.matchAll(/href="[^"<>]*[?&](?:amp;)?page=(\d+)[^"<>]*"/g)].some(m=>Number(m[1])>page);
 // The source uses different page sizes. Follow its actual next-page links.
 const hasMore=next;
 return {items,featured,total:kind==='home'?inventory:total,inventory,page,hasMore,sourceUrl,source:'Hợp Âm Việt',checkedAt:new Date().toISOString(),genres:GENRES};
}
export function sourceFor(params){
 const q=(params.get('q')||'').normalize('NFC').trim().slice(0,120),page=Math.max(0,Math.min(2000,Number.parseInt(params.get('page')||'0',10)||0));
 const type=['title','singer','composer'].includes(params.get('type'))?params.get('type'):'title';
 const g=GENRES.find(x=>x.id===Number(params.get('genre')));
 const mode=params.get('mode')||'hot';
 const u=new URL(q?'/chord/search':g?`/chord/category/${g.id}/${g.slug}`:mode==='home'?'/':mode==='latest'?'/chord/latest':'/chord/hot',ORIGIN);
 if(q){u.searchParams.set('song',q);u.searchParams.set('type',type)}
 if(page)u.searchParams.set('page',String(page));
 return {url:u.href,page,kind:q?'search':mode==='home'&&!g?'home':'browse',q,type,genre:g?.name||null};
}
const cache=new Map();
export async function catalog(params, fetcher=fetch,{force=false}={}){
 const request=sourceFor(params),key=request.url,found=cache.get(key);
 if(!force&&found&&found.expires>Date.now())return {...found.data,cached:true};
 return singleFlight('catalog:'+key,async()=>{
 const res=await fetcher(request.url,{headers:SOURCE_HEADERS,signal:AbortSignal.timeout(16000)});
 if(!res.ok){const detail=await res.text();throw new Error('upstream_'+res.status+':'+clean(detail.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').slice(0,100))}
 const html=await res.text();
 if(/<title>\s*(?:Just a moment|Attention Required)|cf-chl-/i.test(html))throw new Error('upstream_verification');
 const result=parseCatalog(html,request.url,request.page,request.kind);
 if(!result.items.length&&!(request.kind==='search'&&/không tìm thấy|không có kết quả|0<\/strong>\s*kết quả/i.test(html)))throw new Error('upstream_layout');
 const data={...result,query:request.q,type:request.type,genre:request.genre};
 cache.set(key,{expires:Date.now()+300000,data});if(cache.size>100)cache.delete(cache.keys().next().value);
 return data;
 });
}
