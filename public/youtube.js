import {decodeEntities} from './text.js';

const idPattern=/^[A-Za-z0-9_-]{11}$/;
export function youtubeId(value='') {
 const text=decodeEntities(value).trim();
 if(idPattern.test(text))return text;
 if(text.length>2048)return null;
 try {
  const url=new URL(text);
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.port)return null;
  const host=url.hostname.toLowerCase();let id;
  if(host==='youtu.be')id=url.pathname.split('/')[1];
  else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','www.youtube-nocookie.com','youtube-nocookie.com'].includes(host)) {
   id=url.pathname==='/watch'?url.searchParams.get('v'):/^\/(?:embed|shorts|live)\/([^/]+)\/?$/.exec(url.pathname)?.[1];
  }else if(['img.youtube.com','i.ytimg.com','i.youtube.com'].includes(host))id=/^\/vi(?:_webp)?\/([^/]+)\//.exec(url.pathname)?.[1];
  return idPattern.test(id||'')?id:null;
 }catch{return null}
}

export function youtubeEmbed(value,origin) {
 const id=youtubeId(value);if(!id)return null;
 const url=new URL('https://www.youtube-nocookie.com/embed/'+id);
 url.search=new URLSearchParams({playsinline:'1',controls:'1',rel:'0',autoplay:'0',enablejsapi:'1',origin:new URL(origin).origin}).toString();
 return url.href;
}

export function songVideos(song={}) {
 const seen=new Set(),videos=[];
 for(const entry of [...(Array.isArray(song.videos)?song.videos:[]),song.videoId,song.thumbnail]) {
  const id=youtubeId(typeof entry==='object'&&entry?entry.id:entry);
  if(!id||seen.has(id))continue;
  seen.add(id);videos.push({id,label:typeof entry==='object'&&entry?.label?String(entry.label).slice(0,100):'Bản thu '+(videos.length+1)});
  if(videos.length===30)break;
 }
 return videos;
}
