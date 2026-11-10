import {songVideos,youtubeEmbed,youtubeId} from './youtube.js';

let apiPromise;
function playerApi() {
 if(window.YT?.Player)return Promise.resolve(window.YT);
 if(apiPromise)return apiPromise;
 apiPromise=new Promise((resolve,reject)=>{
  const previous=window.onYouTubeIframeAPIReady;
  const timer=setTimeout(()=>reject(new Error('video_api_timeout')),10000);
  window.onYouTubeIframeAPIReady=()=>{clearTimeout(timer);previous?.();resolve(window.YT)};
  const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.async=true;
  script.onerror=()=>{clearTimeout(timer);apiPromise=null;reject(new Error('video_api_unavailable'))};
  document.head.append(script);
 });
 return apiPromise;
}

export function inlinePlayer({onVideo=()=>{},onTick=()=>{}}={}) {
 const $=id=>document.getElementById(id),pane=$('reader-media'),toggle=$('youtube'),mount=$('video-mount'),status=$('video-status'),choices=$('video-choices');
 let song={},videos=[],activeId=null,player=null,ticket=0,clock;
 function stop(){++ticket;clearInterval(clock);onVideo(null);try{player?.destroy()}catch{}player=null;activeId=null;mount.replaceChildren();$('video-play').disabled=true;$('video-play').textContent='▶ Phát'}
 function close(){stop();pane.hidden=true;$('reader').classList.remove('has-video');toggle.setAttribute('aria-expanded','false');toggle.textContent='▶ Nghe cùng hợp âm'}
 function renderChoices(){choices.replaceChildren();videos.forEach(video=>{const option=document.createElement('option');option.value=video.id;option.textContent=video.label;choices.append(option)});choices.hidden=videos.length<2;if(activeId)choices.value=activeId}
 async function play(id) {
  const src=youtubeEmbed(id,location.origin);if(!src)return;
  stop();const generation=ticket;activeId=id;onVideo(id);
  const frame=document.createElement('iframe');frame.id='song-video';frame.title='Video nghe cùng: '+(song.title||'bài hát');frame.src=src;
  frame.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
  mount.append(frame);choices.value=id;status.textContent='Bấm nút phát trong video để nghe cùng lời và hợp âm.';
  try {
   const YT=await playerApi();if(generation!==ticket||pane.hidden)return;
   player=new YT.Player(frame,{events:{
    onReady:()=>{if(generation===ticket){status.textContent='';$('video-play').disabled=false;clearInterval(clock);clock=setInterval(()=>{try{onTick({id:activeId,time:player.getCurrentTime(),state:player.getPlayerState()})}catch{}},250)}},
    onStateChange:event=>{if(generation!==ticket)return;$('video-play').textContent=[1,3].includes(event.data)?'Ⅱ Tạm dừng':'▶ Phát';if(event.data===3)status.textContent='Đang tải video…';else if([1,2,0].includes(event.data))status.textContent=''},
    onError:event=>{if(generation!==ticket)return;status.textContent=[101,150].includes(event.data)?'Bản này không cho phép phát nhúng. Chọn một bản thu khác trong “Đổi video”.':event.data===153?'Trình phát chưa xác nhận được kết nối. Hãy tải lại bài hoặc chọn một bản thu khác.':'Chưa phát được video này. Bạn có thể chọn bản thu khác hoặc dán liên kết YouTube.';$('video-options').open=true},
   }});
  }catch{if(generation===ticket)status.textContent='Bạn vẫn có thể bấm phát trong khung. Nếu video chưa tải được, hãy chọn bản thu khác.'}
 }
 function open(){pane.hidden=false;$('reader').classList.add('has-video');toggle.setAttribute('aria-expanded','true');toggle.textContent='Đóng video';if(!activeId){if(videos.length)play(videos[0].id);else{status.textContent='Chưa có bản thu cho bài này. Dán liên kết YouTube để nghe ngay tại đây.';$('video-options').open=true}}}
 function setSong(value,{reset=false}={}) {
  if(reset||value.id!==song.id){close();$('video-link').value='';$('video-options').open=false}
  song=value;videos=songVideos(value);renderChoices();
  if(!pane.hidden&&!activeId&&videos.length)play(videos[0].id);
 }
 toggle.onclick=()=>pane.hidden?open():close();$('video-close').onclick=close;
 $('video-play').onclick=()=>{if(!player)return;try{[1,3].includes(player.getPlayerState())?player.pauseVideo():player.playVideo()}catch{status.textContent='Hãy bấm nút phát trong khung video để nghe.'}};
 choices.onchange=()=>{if(youtubeId(choices.value))play(choices.value)};
 $('video-form').onsubmit=event=>{event.preventDefault();const id=youtubeId($('video-link').value);if(!id){status.textContent='Liên kết chưa hợp lệ. Dùng liên kết video youtube.com hoặc youtu.be.';return}if(!videos.some(v=>v.id===id))videos.unshift({id,label:'Video bạn chọn'});renderChoices();play(id);$('video-options').open=false};
 const size=$('video-size');let gripStart=null;
 function resize(value){const height=Math.max(200,Math.min(420,Number(value)||200));size.value=height;mount.style.height=height+'px';mount.style.aspectRatio='auto';try{localStorage.setItem('goc-video-height',height)}catch{}}
 size.oninput=()=>resize(size.value);$('video-compact').onclick=()=>{resize(200);$('reader').classList.toggle('compact-video');$('video-compact').textContent=$('reader').classList.contains('compact-video')?'Mở công cụ':'Thu gọn'};
 $('video-grip').onpointerdown=event=>{gripStart={y:event.clientY,height:Number(size.value)};event.currentTarget.setPointerCapture(event.pointerId)};
 $('video-grip').onpointermove=event=>{if(gripStart)resize(gripStart.height+event.clientY-gripStart.y)};
 $('video-grip').onpointerup=$('video-grip').onpointercancel=()=>{gripStart=null};try{resize(localStorage.getItem('goc-video-height'))}catch{resize(200)}
 return {pause(){try{player?.pauseVideo()}catch{}},setSong,open,close,clear:()=>{close();song={};videos=[];renderChoices();$('video-link').value=''}};
}
