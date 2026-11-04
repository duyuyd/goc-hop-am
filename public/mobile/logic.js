export function transpose(chord,shift=0){
 const sharps=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
 const flats=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
 const aliases={Db:1,Eb:3,Gb:6,Ab:8,Bb:10,Cb:11,Fb:4,'E#':5,'B#':0};
 return String(chord).replace(/(^|\/)([A-G][#b]?)/g,(_,prefix,note)=>prefix+(note.includes('b')?flats:sharps)[(((aliases[note]??sharps.indexOf(note))+shift)%12+12)%12]);
}
export function songUrl(value){try{const u=new URL(value);return u.origin==='https://hopamviet.vn'&&!u.username&&!u.password&&/^\/chord\/song\/[a-z0-9-]+\/[A-Za-z0-9]+\.html$/.test(u.pathname)?u.origin+u.pathname:null}catch{return null}}
export function validSong(s){return !!s&&typeof s.title==='string'&&s.title.length>0&&s.title.length<400&&typeof s.content==='string'&&s.content.length>0&&s.content.length<=80000&&!!songUrl(s.sourceUrl)}
export function videoId(value=''){
 const text=String(value).trim();if(/^[A-Za-z0-9_-]{11}$/.test(text))return text;if(text.length>2048)return null;
 try{const u=new URL(text);if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.port)return null;let id;
  if(u.hostname==='youtu.be')id=/^\/([A-Za-z0-9_-]{11})\/?$/.exec(u.pathname)?.[1];
  else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','www.youtube-nocookie.com','youtube-nocookie.com'].includes(u.hostname))id=u.pathname==='/watch'?u.searchParams.get('v'):/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})\/?$/.exec(u.pathname)?.[1];
  return /^[A-Za-z0-9_-]{11}$/.test(id||'')?id:null;
 }catch{return null}
}
export function videoList(song={}){
 const result=[],seen=new Set();for(const value of [...(Array.isArray(song.videos)?song.videos:[]),song.videoId]){
  const id=videoId(value&&typeof value==='object'?value.id:value);if(!id||seen.has(id))continue;
  seen.add(id);result.push({id,label:value&&typeof value==='object'&&value.label?String(value.label).slice(0,100):'Bản thu '+(result.length+1)});if(result.length===30)break;
 }return result;
}
export function videoEmbed(value,origin){const id=videoId(value);if(!id)return null;const u=new URL('https://www.youtube-nocookie.com/embed/'+id);u.search=new URLSearchParams({playsinline:'1',controls:'1',rel:'0',autoplay:'0',fs:'0',origin:new URL(origin).origin}).toString();return u.href;}
export function offlineLibrary(value){
 const result=Object.create(null);if(!value||typeof value!=='object'||Array.isArray(value))return result;
 for(const item of Object.values(value).slice(0,100))if(validSong(item)){const url=songUrl(item.sourceUrl);result[url]={title:item.title,author:String(item.author||'').slice(0,400),key:/^[A-G][#b]?m?$/.test(item.key)?item.key:'C',content:item.content,sourceUrl:url,videos:videoList(item),savedAt:Number(item.savedAt)||0};}
 return result;
}
export function catalogItems(data){return (Array.isArray(data?.items)?data.items:[]).filter(s=>s&&typeof s.title==='string'&&songUrl(s.url)).slice(0,100)}
export function libraryBytes(library){return new TextEncoder().encode(JSON.stringify(library)).length}
export function bpmValue(value){return Math.max(40,Math.min(240,Math.round(Number(value)||80)))}
