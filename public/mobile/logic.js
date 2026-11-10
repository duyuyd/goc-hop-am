export function transpose(chord,shift=0){
 const sharps=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
 const flats=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
 const aliases={Db:1,Eb:3,Gb:6,Ab:8,Bb:10,Cb:11,Fb:4,'E#':5,'B#':0};
 return String(chord).replace(/(^|\/)([A-G][#b]?)/g,(_,prefix,note)=>prefix+(note.includes('b')?flats:sharps)[(((aliases[note]??sharps.indexOf(note))+shift)%12+12)%12]);
}
const communityPrefix='goc-song:';
export function communitySongRef(id){return typeof id==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(id)?communityPrefix+id:null}
export function communitySongId(value){return typeof value==='string'&&value.startsWith(communityPrefix)&&communitySongRef(value.slice(communityPrefix.length))===value?value.slice(communityPrefix.length):null}
export function songUrl(value){if(communitySongId(value))return value;try{const u=new URL(value);return u.origin==='https://hopamviet.vn'&&!u.username&&!u.password&&/^\/chord\/song\/[a-z0-9-]+\/[A-Za-z0-9]+\.html$/.test(u.pathname)?u.origin+u.pathname:null}catch{return null}}
export function songReferenceId(value){const ref=songUrl(value),id=communitySongId(ref);return ref&&(id?'goc-'+id:ref.split('/').at(-1).slice(0,-5))}
export function songReaderPath(value){const ref=songUrl(value);if(!ref)return null;const id=communitySongId(ref);return '/api/reader?'+new URLSearchParams(id?{id}:{url:ref})}
export function validSong(s){return !!s&&typeof s.title==='string'&&s.title.length>0&&s.title.length<400&&typeof s.content==='string'&&s.content.length>0&&s.content.length<=80000&&!!songUrl(s.sourceUrl)}

export function songSearchKey(value){return String(value??'').normalize('NFD').replace(/\p{M}/gu,'').replace(/[đĐ]/g,'d').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim()}

function oneSongEdit(a,b){
 const shorterLength=Math.min(a.length,b.length),longerLength=Math.max(a.length,b.length);
 if(shorterLength<3||longerLength<4||longerLength-shorterLength>1)return false;
 let i=0;while(i<shorterLength&&a[i]===b[i])i++;
 if(a.length!==b.length){const [shorter,longer]=a.length<b.length?[a,b]:[b,a];return shorter.slice(i)===longer.slice(i+1)}
 return a.slice(i+1)===b.slice(i+1)||(a[i]===b[i+1]&&a[i+1]===b[i]&&a.slice(i+2)===b.slice(i+2));
}

export function songTextRank(query,value){
 if(!query||!value)return 0;
 if(value===query)return 1;
 if((' '+value+' ').includes(' '+query+' '))return 2;
 const tokens=query.split(' '),words=value.split(' ');
 for(let start=0;start+tokens.length<=words.length;start++){
  let edits=0,i=0;
  for(;i<tokens.length;i++){
   if(tokens[i]===words[start+i])continue;
   if(edits||!oneSongEdit(tokens[i],words[start+i]))break;
   edits++;
  }
  if(i===tokens.length)return 3;
 }
 return 0;
}

export const songSearchField=type=>type==='singer'?'singer':type==='composer'?'author':'title';
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
export const offlineSongStorageKey='goc-mobile-offline';
export const offlineSongLimit=100;
export function offlineLibrary(value){
 const result=Object.create(null);if(!value||typeof value!=='object'||Array.isArray(value))return result;
 for(const item of Object.values(value).slice(0,offlineSongLimit))if(validSong(item)){
  const url=songUrl(item.sourceUrl);
  result[url]={title:item.title,author:String(item.author||'').slice(0,400),key:/^[A-G][#b]?m?$/.test(item.key)?item.key:'C',content:item.content,sourceUrl:url,videos:videoList(item),savedAt:Number(item.savedAt)||0};
  if(item.singer)result[url].singer=String(item.singer).slice(0,400);
  if(item.rhythm)result[url].rhythm=String(item.rhythm).slice(0,80);
 }
 return result;
}

export function parseOfflineSongs(raw){
 const value=JSON.parse(raw??'{}');
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Chưa đọc được thư viện ngoại tuyến.');
 return offlineLibrary(value);
}

export function toggleOfflineSong(library,song,now=Date.now()){
 if(!validSong(song))throw new Error('Bài này chưa tải đủ lời và hợp âm.');
 const url=songUrl(song.sourceUrl),next={...library};
 if(next[url])delete next[url];
 else{
  if(Object.keys(next).length>=offlineSongLimit)throw new Error('Đã đủ '+offlineSongLimit+' bài. Bỏ lưu một bài để thêm bài mới.');
  next[url]={...song,savedAt:now};
 }
 const clean=offlineLibrary(next);
 if(libraryBytes(clean)>2000000)throw new Error('Thư viện đã đầy. Hãy bỏ lưu một số bài.');
 return clean;
}

export function updateWebOfflineSong(song,storage,locks){
 const update=()=>{
  const next=toggleOfflineSong(parseOfflineSongs(storage.getItem(offlineSongStorageKey)),song);
  storage.setItem(offlineSongStorageKey,JSON.stringify(next));
  return next;
 };
 return locks?locks.request(offlineSongStorageKey,update):update();
}

export function findOfflineSongs(library,{q='',type='title'}={}){
 const query=songSearchKey(q),field=songSearchField(type);
 if(q.trim()&&!query)return [];
 return Object.values(library??{}).map(song=>({song,rank:query?songTextRank(query,songSearchKey(song[field])):1}))
  .filter(match=>match.rank).sort((a,b)=>a.rank-b.rank||b.song.savedAt-a.song.savedAt||a.song.title.localeCompare(b.song.title,'vi')).map(match=>match.song);
}
export function catalogItems(data){return (Array.isArray(data?.items)?data.items:[]).filter(s=>s&&typeof s.title==='string'&&songUrl(s.url)).slice(0,100)}
export function libraryBytes(library){return new TextEncoder().encode(JSON.stringify(library)).length}
export function bpmValue(value){return Math.max(40,Math.min(240,Math.round(Number(value)||80)))}
