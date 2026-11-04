const VIDEO=/^[A-Za-z0-9_-]{11}$/;
const cache=new Map();
function playerData(html){
 const marker='ytInitialPlayerResponse';let start=html.indexOf(marker);if(start<0)return null;start=html.indexOf('{',start);if(start<0)return null;
 let depth=0,quote=false,escaped=false;
 for(let i=start;i<Math.min(html.length,start+2500000);i++){const char=html[i];if(quote){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quote=false;continue}if(char==='"')quote=true;else if(char==='{')depth++;else if(char==='}'&&!--depth){try{return JSON.parse(html.slice(start,i+1))}catch{return null}}}
 return null;
}
export function captionTracks(html){const data=playerData(html);return data?.captions?.playerCaptionsTracklistRenderer?.captionTracks||[]}
export function parseCaptionCues(data){
 if(!data||!Array.isArray(data.events))return [];
 return data.events.filter(e=>Number.isFinite(e.tStartMs)&&e.tStartMs>=0&&e.tStartMs<86400000&&Array.isArray(e.segs)).slice(0,6000).map(e=>({start:e.tStartMs/1000,duration:Math.max(0,Math.min(120,Number(e.dDurationMs||0)/1000)),text:e.segs.map(s=>typeof s.utf8==='string'?s.utf8:'').join('').replace(/\s+/g,' ').trim().slice(0,1000)})).filter(e=>e.text&&e.text!=='[Music]'&&e.text!=='[âm nhạc]');
}
async function boundedText(response,max=3500000){const reader=response.body.getReader(),parts=[];let count=0;for(;;){const {value,done}=await reader.read();if(done)break;count+=value.length;if(count>max){await reader.cancel();throw new Error('captions_too_large')}parts.push(value)}const all=new Uint8Array(count);let offset=0;for(const part of parts){all.set(part,offset);offset+=part.length}return new TextDecoder().decode(all)}
export async function videoCaptions(id,fetcher=fetch){
 if(!VIDEO.test(id))throw new Error('invalid_video');
 const found=cache.get(id);if(found&&found.until>Date.now())return found.data;
 const headers={Accept:'text/html','Accept-Language':'vi,en;q=0.7','User-Agent':'GocHopAm/1.2.1 (+https://gochopam.pages.dev/)'};
 const response=await fetcher('https://www.youtube.com/watch?v='+id+'&hl=vi',{headers,redirect:'manual',signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new Error('captions_unavailable');
 const html=await boundedText(response);
 if(/verify you are human|unusual traffic|sign in to confirm you.re not a bot/i.test(html))throw new Error('captions_unavailable');
 const tracks=captionTracks(html).filter(t=>t&&typeof t.baseUrl==='string');
 const track=tracks.find(t=>t.languageCode==='vi'&&t.kind!=='asr')||tracks.find(t=>t.languageCode==='vi')||tracks.find(t=>t.kind!=='asr')||tracks[0];
 let data={videoId:id,available:false,cues:[],reason:'Video chưa có phụ đề công khai để khớp lời.'};
 if(track){
  const url=new URL(track.baseUrl);if(url.protocol!=='https:'||url.hostname!=='www.youtube.com'||url.pathname!=='/api/timedtext'||url.username||url.password||url.searchParams.get('v')!==id)throw new Error('invalid_caption_track');url.searchParams.set('fmt','json3');
  const result=await fetcher(url.href,{headers:{Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(10000)});
  if(!result.ok)throw new Error('captions_unavailable');
  let cues=[];try{cues=parseCaptionCues(JSON.parse(await boundedText(result,1800000)))}catch{}
  if(cues.length)data={videoId:id,available:true,language:track.languageCode,automatic:track.kind==='asr',cues};
 }
 cache.set(id,{data,until:Date.now()+300000});if(cache.size>40)cache.delete(cache.keys().next().value);return data;
}
