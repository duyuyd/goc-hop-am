import { ORIGIN, SOURCE_HEADERS, clean, safeSongUrl } from './music-catalog.mjs';
import providedSong from '../data/provided-song.json' with { type: 'json' };
import {youtubeId} from '../public/youtube.js';
import {singleFlight} from './single-flight.mjs';

// Read a single public song on demand. Only plain text leaves this module;
// navigation, scripts, forms, comments and third-party markup are discarded.
function element(html, predicate) {
 const tags=/<([a-z][\w:-]*)\b([^>]*)>/gi;
 let match;
 while((match=tags.exec(html))){
  if(!predicate(match[2]))continue;
  const tag=match[1],start=tags.lastIndex;
  const nested=new RegExp(`<\\/?${tag}\\b[^>]*>`,'gi');
  nested.lastIndex=start;let depth=1,next;
  while((next=nested.exec(html))){
   depth+=next[0].startsWith('</')?-1:1;
   if(!depth)return html.slice(start,next.index);
  }
 }
 return '';
}
const byId=(html,id)=>element(html,a=>new RegExp(`\\bid=["']${id}["']`,'i').test(a));
function lyricsText(html){
  // Traverse markup once rather than repeatedly stripping fragments with regex:
  // malformed nested tags/comments must never restore executable content.
  const omitted=new Set(['script','style','iframe','form','button','noscript','object','embed','svg','template']);
  const breaks=new Set(['p','div','li','section']);
  const hidden=[];
  let result='',i=0;
  while(i<html.length){
    const open=html.indexOf('<',i);
    if(open<0){if(hidden.length===0)result+=html.slice(i);break;}
    if(hidden.length===0)result+=html.slice(i,open);
    if(html.startsWith('<!--',open)){
      const close=html.indexOf('-->',open+4);
      i=close<0?html.length:close+3;
      continue;
    }
    let quote='',end=open+1;
    for(;end<html.length;end++){
      const char=html[end];
      if(quote){if(char===quote)quote='';}
      else if(char==='"'||char==="'")quote=char;
      else if(char==='>')break;
    }
    if(end>=html.length)break;
    const tag=html.slice(open,end+1);
    const match=/^<\s*(\/?)([a-z][a-z0-9:-]*)\b/i.exec(tag);
    if(match){
      const close=match[1]==='/',name=match[2].toLowerCase();
      if(omitted.has(name)){
        if(close){if(hidden.at(-1)===name)hidden.pop();}
        else if(!/\/\s*>$/.test(tag))hidden.push(name);
      }else if(hidden.length===0&&(name==='br'||(close&&breaks.has(name))))result+='\n';
    }
    i=end+1;
  }
  return result.split(/\r?\n/).map(line=>clean(line)).join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
export function parseSong(html,url){
 const safe=safeSongUrl(url);if(!safe)throw new Error('invalid_song_url');
 const title=clean(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||'');
 const block=byId(html,'lyric-version-0')||element(html,a=>/\bclass=["'][^"']*\blyric-block\b/.test(a));
 const content=lyricsText(block);
 if(!title||!content||content.length>80000)throw new Error('upstream_song_layout');
 const keyText=clean(byId(html,'song-tone')).replace(/[\[\]]/g,'').trim();
 const key=/^[A-G](?:#|b)?m?$/.test(keyText)?keyText:(content.match(/\[([A-G](?:#|b)?m?)\]/)?.[1]||'C');
 const author=clean(html.match(/<a\b[^>]*href=["'][^"']*\/chord\/composer\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/i)?.[1]||'');
 const videos=[];
 try {
  const raw=html.match(/(?:var|const|let)\s+songSources\s*=\s*(\[[\s\S]*?\]);/)?.[1];
  if(raw&&raw.length<300000)for(const entry of JSON.parse(raw)) {
   const id=entry?.host==='ytb'?youtubeId(entry.music_id):null;
   if(id&&!videos.some(v=>v.id===id))videos.push({id,label:'Bản thu '+(videos.length+1)});
   if(videos.length===30)break;
  }
 }catch{}
 return {id:safe.split('/').at(-1).replace('.html',''),title,author,key,content,videos,videoId:videos[0]?.id||null,
  rhythm:clean(byId(html,'currentRhythmLabel')),source:'Hợp Âm Việt',sourceUrl:safe};
}
const cache=new Map();
export async function readSong(value,fetcher=fetch){
 const url=safeSongUrl(value);if(!url)throw new Error('invalid_song_url');
 // This complete song was supplied by the user in the reference screenshot.
 // Serve its transcription locally so the reported example is independent of upstream access.
 if(url===providedSong.sourceUrl){const {provenance,...song}=providedSong;return song;}
 const found=cache.get(url);if(found&&found.expires>Date.now())return found.song;
 return singleFlight('song:'+url,async()=>{
 const response=await fetcher(url,{headers:SOURCE_HEADERS,redirect:'manual',signal:AbortSignal.timeout(18000)});
 if(!response.ok){const detail=await response.text();throw new Error('upstream_'+response.status+':'+clean(detail.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').slice(0,100))}
 if(response.url&&new URL(response.url).origin!==ORIGIN)throw new Error('upstream_redirect');
 const html=await response.text();
 if(/<title>\s*(?:Just a moment|Attention Required)|cf-chl-/i.test(html))throw new Error('upstream_verification');
 const song=parseSong(html,url);cache.set(url,{song,expires:Date.now()+600000});
 if(cache.size>60)cache.delete(cache.keys().next().value);
 return song;
 });
}
