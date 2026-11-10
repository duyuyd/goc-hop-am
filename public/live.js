import {transpose} from './chords.js';
import {decodeEntities,escapeText} from './text.js';
import {renderLyrics,readerFont} from './reader-format.js';
import {inlinePlayer} from './inline-player.js?v=140';
import {createFollow} from './mobile/follow.js?v=140';
import {createMusicTools} from './mobile/music-tools.js?v=143';
import {createSongSheet} from './mobile/song-sheet.js?v=142';
import {createStudio} from './mobile/studio.js?v=121';
import {communitySongId,communitySongRef,songUrl as valid,songReferenceId,songReaderPath,validSong,parseOfflineSongs,offlineSongStorageKey,updateWebOfflineSong,findOfflineSongs} from './mobile/logic.js?v=142';
(() => {
'use strict';
const $=id=>document.getElementById(id),esc=s=>escapeText(decodeEntities(s??''));
const format=n=>Number(n).toLocaleString('vi-VN');
let state={q:'',type:'title',genre:'',mode:'home',page:0},items=[],favorites=[],home,genres=[],current=null,request=0,controller,typing,loading=false;
let readerSong=null,readerRequest=0,readerController,shift=0,font=20,scrollTimer=null,hideChords=false;
try{font=readerFont(localStorage.getItem('goc-reader-font'))}catch{}
const registry=new Map(),clientCache=new Map(),songCache=new Map();
let followVideo=null,followEnabled=true;
function followStatus(text){$('reader-follow-status').textContent=text}
function rootCall(action,args={}){try{if(action==='api')return fetch(args.path).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error||'Chưa kết nối được.');return data});if(action==='settingsLoad')return Promise.resolve(localStorage.getItem('goc-follow-v2')||'{}');if(action==='settingsSave')localStorage.setItem('goc-follow-v2',args.value);return Promise.resolve(true)}catch(error){return Promise.reject(error)}}
const rootFollow=createFollow({call:rootCall,native:false,toast:followStatus,getSong:()=>readerSong?{...readerSong,sourceUrl:readerSong.sourceUrl||current?.url}:null,getVideo:()=>followVideo,stopRegular:stopScroll,onClear(){document.querySelectorAll('#reader-lyrics .active').forEach(el=>el.classList.remove('active'))},onHighlight(line){const rows=$('reader-lyrics').querySelectorAll('.lyric-line');rows.forEach((el,index)=>el.classList.toggle('active',index===line));const el=rows[line],body=$('reader-body');if(el)body.scrollTo({top:Math.max(0,body.scrollTop+el.getBoundingClientRect().top-body.getBoundingClientRect().top-body.clientHeight*.32),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})}});
const media=inlinePlayer({onVideo(id){songSheet.stop();followVideo=id;rootFollow.stop();if(id&&followEnabled&&readerSong)rootFollow.videoReady()},onTick(event){rootFollow.onTick(event)}});let ownsFullscreen=false;
$('reader-follow').onclick=()=>{followEnabled=!followEnabled;$('reader-follow').setAttribute('aria-pressed',String(followEnabled));if(followEnabled&&followVideo)rootFollow.videoReady();else{rootFollow.stop();$('reader-lyrics').querySelectorAll('.active').forEach(el=>el.classList.remove('active'));followStatus(followEnabled?'Mở video YouTube để theo lời.':'Đã tắt theo lời YouTube.')}};
$('reader-lyrics').addEventListener('click',event=>{const row=event.target.closest('.lyric-line');if(row)rootFollow.select([...$('reader-lyrics').querySelectorAll('.lyric-line')].indexOf(row))});
const musicTools=createMusicTools({toast:followStatus,getSong:()=>readerSong,getShift:()=>shift,onFindPdf(){if(readerSong)songSheet.open();else $('sheet-catalog').click()}});
const songSheet=createSongSheet({host:$('reader-body'),getSong:()=>readerSong,getShift:()=>shift,toast:followStatus,onPlay(){rootFollow.stop();media.pause();stopScroll();musicTools.stop()},onShow(show){$('reader-lyrics').hidden=false;$('reader-sheet').setAttribute('aria-pressed',String(show));rootFollow.refresh()}});
$('music-open').onclick=()=>musicTools.open();$('reader-make-sheet').onclick=()=>musicTools.open();$('reader-sheet').onclick=()=>songSheet.open();
const studio=createStudio({native:false,call:async()=>true,toast:followStatus,beforeRecord(){}});
$('reader-share').onclick=async()=>{if(!current?.url)return;const url=new URL('/',location.origin);url.searchParams.set('song',current.url);try{if(navigator.share)await navigator.share({title:readerSong?.title||current.title,text:'Cùng chơi bài này trên Góc Hợp Âm',url:url.href});else{await navigator.clipboard.writeText(url.href);followStatus('Đã sao chép liên kết bài hát.')}}catch(error){if(error.name!=='AbortError')followStatus('Chưa chia sẻ được. Hãy thử lại.')}};
$('share-site').onclick=async()=>{const url=document.querySelector('link[rel=canonical]')?.href||location.origin+'/';try{if(navigator.share)await navigator.share({title:'Góc Hợp Âm',text:'Tra hợp âm, đổi tông và tập hát cùng YouTube · NPT Duy',url});else{await navigator.clipboard.writeText(url);$('share-site').textContent='Đã sao chép liên kết ✓'}}catch{}};
try{const raw=JSON.parse(localStorage.getItem('anh-live-favorites')||'[]');favorites=Array.isArray(raw)?raw.filter(s=>s&&valid(s.url)&&typeof s.title==='string'):[];for(const s of favorites)registry.set(s.id,s);document.body.classList.toggle('light',localStorage.getItem('goc-theme')==='light')}catch{}
function pathState(){const p=new URLSearchParams();if(state.q)p.set('q',state.q);if(state.type!=='title')p.set('type',state.type);if(state.genre)p.set('genre',state.genre);if(state.mode!=='home')p.set('mode',state.mode);if(state.page)p.set('page',state.page);if(current?.url)p.set('song',current.url);history.replaceState(null,'',location.pathname+(p.size?'?'+p:'')+(current?'#bai/'+current.id:''))}
function row(s){const saved=favorites.some(x=>x.id===s.id);return `<article class="row"><span class="song-icon" aria-hidden="true">♫</span><button class="open" data-open="${esc(s.id)}"><strong>${esc(s.title)}</strong><span class="meta">${esc([s.author,s.singer].filter((v,i,a)=>v&&a.indexOf(v)===i).join(' · ')||'Hợp âm & lời bài hát')}</span><span class="open-label">${s.local?'Kho riêng · ':''}Mở lời & hợp âm ›</span></button><button class="row-sheet song-sheet-launch" data-song-sheet="${esc(s.id)}" aria-label="Xem bản phổ ${esc(s.title)}">▤ Sheet</button><button class="row-yt" data-listen="${esc(s.id)}" aria-label="Nghe ${esc(s.title)} cùng hợp âm">▶</button>${s.local?'':`<button class="save ${saved?'on':''}" data-save="${esc(s.id)}" aria-label="${saved?'Bỏ lưu':'Lưu'} ${esc(s.title)}" aria-pressed="${saved}">${saved?'★':'☆'}</button>`}</article>`}
function title(){if(state.mode==='offline')return 'Bài đã tải';if(state.mode==='sheets')return 'Kho bản phổ';const g=genres.find(g=>String(g.id)===state.genre);return state.mode==='favorites'?'Bài hát yêu thích':state.q?'Kết quả cho “'+state.q+'”':g?g.name:state.mode==='latest'?'Bài mới cập nhật':state.mode==='hot'?'Bài hát thịnh hành':'Khám phá bài hát'}
function filters(){
 document.querySelectorAll('[data-genre]').forEach(e=>{const on=e.dataset.genre===state.genre;e.classList.toggle('active',on);e.setAttribute('aria-pressed',on)});
 document.querySelectorAll('[data-type]').forEach(e=>e.classList.toggle('selected',e.dataset.type===state.type));
 $('favorites').setAttribute('aria-pressed',state.mode==='favorites');
 $('query-trail').innerHTML=state.q||state.genre||state.mode!=='home'?'<button id="clear-results">× Bỏ lọc · về trang đầu</button>':'';
}
function draw(data){
 items=(data.items||[]).filter(s=>valid(s.url));items.forEach(s=>registry.set(s.id,s));
 $('listtitle').textContent=title();$('catalog-eyebrow').textContent=state.mode==='favorites'?'DANH SÁCH YÊU THÍCH':'KHÁM PHÁ ÂM NHẠC';
 $('results').innerHTML=items.map(row).join('');$('empty').hidden=!!items.length;
 $('count').textContent=data.total!=null?(state.mode==='home'?'Kho '+format(data.total)+' bài':format(data.total)+' '+(state.q?'kết quả':'bài')):items.length+' bài trên trang';
 $('pagination').hidden=state.mode==='home'||state.mode==='favorites'||data.offline||(!data.hasMore&&!state.page);
 $('next').disabled=!data.hasMore;$('previous').disabled=state.page===0;$('page-label').textContent='Trang '+(state.page+1);
 if(data.stale){$('status').textContent='Đang dùng kết quả đã lưu ngày '+new Date(data.cachedAt).toLocaleDateString('vi-VN')+'. Kho trực tuyến chưa phản hồi.'}
 if(data.fallback){$('status').textContent=data.fallback==='unavailable'?'Kho trực tuyến chưa phản hồi. Đang hiển thị bài phù hợp trong dữ liệu đã lưu.':'Không thấy kết quả trực tuyến. Đây là bài phù hợp hoặc gần đúng trong dữ liệu đã lưu.'}
 if(data.offline)$('status').textContent=items.length?'Bài đã tải · Mở được trên thiết bị khi mất mạng.':'Chưa tìm thấy bài đã tải. Hãy kết nối mạng để tải thêm.';
 filters();
}
function pending(on){loading=on;$('results').classList.toggle('loading',on);$('results').setAttribute('aria-busy',on);$('search').setAttribute('aria-busy',on);$('status').classList.remove('error');$('status').textContent=on?'Đang tìm bài hát…':'';if(on){$('empty').hidden=true;$('next').disabled=true;$('previous').disabled=true}}
function error(text='Chưa tải được danh sách bài hát.'){$('status').classList.add('error');$('status').innerHTML=esc(text)+' <button id="retry">Thử lại</button>';}
function getDownloads(){try{return parseOfflineSongs(localStorage.getItem(offlineSongStorageKey))}catch{return Object.create(null)}}
function downloadedResults(){
 const results=findOfflineSongs(getDownloads(),{q:state.q,type:state.type});
 const items=results.map(({sourceUrl,title,author,singer})=>({id:songReferenceId(sourceUrl),url:sourceUrl,title,author,singer,local:!!communitySongId(sourceUrl)}));
 return {items,total:items.length,offline:true};
}
async function load({scroll=false,force=false}={}){
 controller?.abort();const ticket=++request;
 pathState();filters();$('listtitle').textContent=title();
 if(scroll)$('catalog').scrollIntoView({behavior:'smooth'});
 if(state.mode==='offline'||(navigator.onLine===false&&['search','home'].includes(state.mode))){pending(false);draw(downloadedResults());return}
 if(state.mode==='favorites'||(state.mode==='home'&&home)){pending(false);draw(state.mode==='favorites'?{items:favorites,total:favorites.length}:home);return}
 const p=new URLSearchParams({q:state.q,type:state.type,genre:state.genre,mode:state.mode,page:String(state.page)}),key=p.toString();
 if(!force&&clientCache.has(key)){pending(false);draw(clientCache.get(key));return}
 controller=new AbortController();const signal=controller.signal;pending(true);$('results').innerHTML='';$('pagination').hidden=true;$('count').textContent='';
 try{
  const response=await fetch(state.mode==='sheets'?'/api/song-sheet?list=1&page='+state.page:'/api/catalog?'+p,{signal});
  const data=await response.json();if(!response.ok)throw new Error(data.error);if(ticket!==request)return;
  if(data.items?.length&&!data.fallback&&!data.stale&&!data.items.some(song=>song.local)){clientCache.set(key,data);if(clientCache.size>30)clientCache.delete(clientCache.keys().next().value)}
  pending(false);
  const saved=state.q&&!data.items?.length?downloadedResults():null;
  draw(saved?.items.length?saved:data);
 }catch(e){
  if(ticket!==request||e.name==='AbortError')return;
  pending(false);const saved=state.q?downloadedResults():null;
  if(saved?.items.length){draw(saved);return;}
  $('empty').hidden=true;error(e.message||undefined);
 }
}
function save(id){const s=registry.get(id);if(!s||s.local)return;favorites=favorites.some(x=>x.id===id)?favorites.filter(x=>x.id!==id):[s,...favorites];try{localStorage.setItem('anh-live-favorites',JSON.stringify(favorites))}catch{}
 if(state.mode==='favorites')draw({items:favorites,total:favorites.length});else $('results').innerHTML=items.map(row).join('');window.dispatchEvent(new CustomEvent('bookmarks:update',{detail:favorites}));if(current)readerSaved()}
function readerSaved(){
 const saved=favorites.some(s=>s.id===current?.id);$('reader-save').hidden=!!current?.local;$('reader-save').textContent=saved?'★ Đã lưu':'☆ Lưu bài';$('reader-save').setAttribute('aria-pressed',saved);
 const download=$('reader-download'),available=validSong(readerSong),downloaded=available&&!!getDownloads()[valid(readerSong.sourceUrl)];
 download.hidden=!available;download.setAttribute('aria-pressed',String(downloaded));download.textContent=downloaded?'Đã tải · Bỏ tải':'Tải ngoại tuyến';
}
async function toggleDownload(){
 const song=readerSong,download=$('reader-download');
 if(!song||download.disabled)return;
 download.disabled=true;
 try{
  const next=await updateWebOfflineSong({...song,singer:song.singer||current?.singer},localStorage,navigator.locks);
  readerSaved();
  if(readerSong===song)$('reader-notice').textContent=next[valid(song.sourceUrl)]?'Đã tải lời và hợp âm vào thiết bị.':'Đã bỏ bản tải trên thiết bị.';
  if(state.mode==='offline')draw(downloadedResults());
 }catch(e){if(readerSong===song)$('reader-notice').textContent=e.message||'Chưa lưu được bài.'}finally{download.disabled=false}
}
function readerBusy(on){$('reader-tools').hidden=on;for(const b of $('reader-tools').querySelectorAll('button'))b.disabled=on;$('reader-body').setAttribute('aria-busy',on)}
function applyFont(){const body=$('reader-body'),position=body.scrollTop/Math.max(1,body.scrollHeight-body.clientHeight);$('reader-lyrics').style.fontSize=font+'px';$('reader-font-size').textContent=font+'px';$('reader-font-up').disabled=font>=40;$('reader-font-down').disabled=font<=14;body.scrollTop=position*Math.max(0,body.scrollHeight-body.clientHeight);try{localStorage.setItem('goc-reader-font',String(font))}catch{}}
function renderSong(){if(!readerSong)return;$('reader-key').textContent=transpose(readerSong.key,shift);$('reader-shift').textContent=shift?(shift>0?'+':'')+shift+' nửa cung':'Tông gốc';$('reader-lyrics').innerHTML=renderLyrics(readerSong.content,shift,hideChords);rootFollow.refresh();songSheet.refresh();applyFont();$('reader-chords').setAttribute('aria-pressed',hideChords);$('reader-chords').textContent=hideChords?'Hiện hợp âm':'Chỉ lời hát'}
function stopScroll(){clearInterval(scrollTimer);scrollTimer=null;$('reader-scroll').textContent='▶ Tự cuộn';$('reader-scroll').setAttribute('aria-pressed','false')}
async function openSong(id,{force=false,listen=false}={}){
 const s=registry.get(id);if(!s||!valid(s.url))return;
 readerController?.abort();const ticket=++readerRequest;readerController=new AbortController();const signal=readerController.signal;
 stopScroll();current=s;readerSong=null;shift=0;hideChords=false;songSheet.setSong();
 media.setSong(s,{reset:true});
 $('songtitle').textContent=decodeEntities(s.title);$('songmeta').textContent=decodeEntities([s.author,s.singer].filter(Boolean).join(' · '));readerSaved();$('reader-notice').textContent='Đang tải lời và hợp âm…';$('reader-notice').classList.remove('error');$('reader-lyrics').textContent='';$('reader-credit').hidden=true;readerBusy(true);
 if(!$('reader').open)$('reader').showModal();$('reader-body').scrollTop=0;pathState();
 if(listen)media.open();
 const saved=getDownloads()[s.url];
 const savedSong=saved&&{...saved,id:s.id,offline:true};
 try{
  if(savedSong&&!force){presentSong(savedSong,s);return;}
  if(navigator.onLine===false)throw new Error('Bài này chưa tải. Hãy kết nối mạng để mở.');
  let song=!force?songCache.get(s.url):null;
  if(!song){
   const response=await fetch(songReaderPath(s.url),{signal});const data=await response.json();if(!response.ok)throw new Error(data.error);
   song=data.song;if(!validSong(song)||song.id!==s.id||valid(song.sourceUrl)!==s.url)throw new Error('Nội dung bài hát chưa sẵn sàng.');
   song={...song,stale:data.stale,cachedAt:data.cachedAt};
   if(!s.local){songCache.set(s.url,song);if(songCache.size>20)songCache.delete(songCache.keys().next().value)}
  }
  if(ticket!==readerRequest||!$('reader').open)return;
  presentSong(song,s);
 }catch(e){if(ticket!==readerRequest||e.name==='AbortError')return;if(savedSong){presentSong(savedSong,s);return}$('reader-notice').classList.add('error');$('reader-notice').innerHTML='<strong>Chưa tải được bài hát</strong><p>'+esc(e.message||'Vui lòng thử lại sau.')+'</p><button id="reader-retry">Thử lại</button>';readerBusy(true)}
}
function presentSong(song,summary=song){readerSong=song;readerSaved();songSheet.setSong();rootFollow.onSong(song);media.setSong({...summary,...song});$('songtitle').textContent=decodeEntities(song.title);$('songmeta').textContent=decodeEntities([song.author||summary.author,summary.singer,song.rhythm].filter(Boolean).join(' · '));$('reader-notice').textContent=song.offline?'Bản ngoại tuyến trên thiết bị.':song.stale?'Bản đã lưu ngày '+new Date(song.cachedAt).toLocaleDateString('vi-VN')+' · kết nối đang gián đoạn.':'';$('reader-notice').classList.remove('error');$('reader-credit').hidden=true;readerBusy(false);renderSong();if(followEnabled&&followVideo)rootFollow.videoReady()}
window.addEventListener('library:open-local',e=>{const song=e.detail;if(!song||typeof song.content!=='string')return;readerController?.abort();++readerRequest;stopScroll();const ref=communitySongRef(song.id);current={...song,id:songReferenceId(ref)||song.id,url:ref,local:true};shift=0;hideChords=false;presentSong({...song,sourceUrl:ref},current);if(!$('reader').open)$('reader').showModal();$('reader-body').scrollTop=0});
$('reader-up').onclick=()=>{shift++;renderSong()};$('reader-down').onclick=()=>{shift--;renderSong()};$('reader-reset').onclick=()=>{shift=0;renderSong()};
$('reader-font-up').onclick=()=>{font=Math.min(40,font+2);applyFont()};$('reader-font-down').onclick=()=>{font=Math.max(14,font-2);applyFont()};$('reader-chords').onclick=()=>{hideChords=!hideChords;renderSong()};
$('reader-font-reset').onclick=()=>{font=20;applyFont()};
$('reader-scroll').onclick=()=>{if(scrollTimer){stopScroll();return}if(!readerSong)return;$('reader-scroll').textContent='Ⅱ Dừng cuộn';$('reader-scroll').setAttribute('aria-pressed','true');scrollTimer=setInterval(()=>{const body=$('reader-body');body.scrollTop+=1;if(body.scrollTop+body.clientHeight>=body.scrollHeight-1)stopScroll()},Number($('reader-speed').value))};
$('reader-speed').onchange=()=>{if(scrollTimer){stopScroll();$('reader-scroll').click()}};
function reset(){clearTimeout(typing);state={q:'',type:'title',genre:'',mode:'home',page:0};$('query').value='';load({scroll:true})}
function search(){clearTimeout(typing);state.q=$('query').value.trim();state.genre='';if(state.mode!=='offline')state.mode=state.q?'search':'home';state.page=0;load({scroll:true})}
$('search').onsubmit=e=>{e.preventDefault();search()};
$('query').oninput=()=>{clearTimeout(typing);typing=setTimeout(()=>{const q=$('query').value.trim();if(q.length>=3||!q)search()},750)};
$('close').onclick=()=>$('reader').close();$('reader').onclose=()=>{songSheet.stop();rootFollow.stop();readerController?.abort();++readerRequest;stopScroll();media.clear();setExpanded(false);if(ownsFullscreen&&document.fullscreenElement===document.documentElement)document.exitFullscreen?.().catch(()=>{});ownsFullscreen=false;readerSong=null;current=null;pathState()};$('reader-save').onclick=()=>{if(current)save(current.id)};
$('reader').addEventListener('click',e=>{if(e.target===$('reader'))$('reader').close()});
$('theme').onclick=()=>{document.body.classList.toggle('light');try{localStorage.setItem('goc-theme',document.body.classList.contains('light')?'light':'dark')}catch{}};
function setExpanded(on){$('reader').classList.toggle('is-expanded',on);$('reader-fullscreen').setAttribute('aria-pressed',String(on));$('reader-fullscreen').textContent=on?'⛶ Thu gọn':'⛶ Mở rộng lời';$('reader-fullscreen').setAttribute('aria-label',on?'Thu gọn khung lời bài hát':'Phóng to khung lời bài hát')}
$('reader-fullscreen').onclick=async()=>{const on=!$('reader').classList.contains('is-expanded');setExpanded(on);if(on&&!document.fullscreenElement&&document.fullscreenEnabled){try{await document.documentElement.requestFullscreen();ownsFullscreen=true;if(!$('reader').open){await document.exitFullscreen();ownsFullscreen=false}}catch{/* The expanded reading layout also works without the browser fullscreen API. */}}else if(!on&&ownsFullscreen&&document.fullscreenElement===document.documentElement){ownsFullscreen=false;await document.exitFullscreen?.().catch(()=>{})}};
document.addEventListener('fullscreenchange',()=>{if(ownsFullscreen&&!document.fullscreenElement){ownsFullscreen=false;setExpanded(false)}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopScroll()});
window.addEventListener('account:bookmarks',e=>{const merged=new Map([...favorites,...e.detail.filter(s=>s&&valid(s.url))].map(s=>[s.id,s]));favorites=[...merged.values()];favorites.forEach(s=>registry.set(s.id,s));try{localStorage.setItem('anh-live-favorites',JSON.stringify(favorites))}catch{}if(home&&(state.mode==='home'||state.mode==='favorites'))draw(state.mode==='favorites'?{items:favorites,total:favorites.length}:{...home,items});window.dispatchEvent(new CustomEvent('bookmarks:update',{detail:favorites}));if(current)readerSaved()});
$('sheet-catalog').onclick=()=>{state={q:'',type:'title',genre:'',mode:'sheets',page:0};$('query').value='';load({scroll:true})};
$('favorites').onclick=()=>{clearTimeout(typing);state={...state,q:'',genre:'',mode:'favorites',page:0};$('query').value='';load({scroll:true})};
$('reader-download').onclick=toggleDownload;
window.addEventListener('storage',e=>{if(e.key===offlineSongStorageKey){if(state.mode==='offline')draw(downloadedResults());if(current)readerSaved();}});
function closeMenu(){if($('site-menu').open)$('site-menu').close()}
$('menu').onclick=()=>{$('site-menu').showModal();$('menu').setAttribute('aria-expanded','true')};
$('menu-close').onclick=closeMenu;$('site-menu').onclose=()=>{$('menu').setAttribute('aria-expanded','false')};
$('site-menu').addEventListener('click',e=>{if(e.target===$('site-menu'))closeMenu()});
$('all').onclick=()=>{clearTimeout(typing);state={q:'',type:'title',genre:'',mode:'hot',page:0};$('query').value='';load({scroll:true})};
$('next').onclick=()=>{if(loading||$('next').disabled)return;state.page++;load({scroll:true})};$('previous').onclick=()=>{if(loading||state.page===0)return;state.page--;load({scroll:true})};
document.addEventListener('click',e=>{const o=e.target.closest('[data-open]'),s=e.target.closest('[data-save]'),g=e.target.closest('[data-genre]'),a=e.target.closest('[data-artist]'),t=e.target.closest('[data-type]');
 if(o)openSong(o.dataset.open);const score=e.target.closest('[data-song-sheet]');if(score)openSong(score.dataset.songSheet).then(()=>{if(readerSong&&current?.id===score.dataset.songSheet) songSheet.open()});if(s)save(s.dataset.save);
 const listen=e.target.closest('[data-listen]');if(listen)openSong(listen.dataset.listen,{listen:true});
 if(g){closeMenu();clearTimeout(typing);state={q:'',type:'title',genre:g.dataset.genre,mode:g.dataset.genre?'browse':'home',page:0};$('query').value='';load({scroll:true})}
 if(a){clearTimeout(typing);state={q:a.dataset.artist,type:'composer',genre:'',mode:'search',page:0};$('query').value=state.q;load({scroll:true})}
 if(t){clearTimeout(typing);state.type=t.dataset.type;filters();if($('query').value.trim())search()}
 const nav=e.target.closest('[data-nav]'),jump=e.target.closest('[data-jump]');
 if(nav){closeMenu();clearTimeout(typing);state={q:'',type:'title',genre:'',mode:nav.dataset.nav,page:0};$('query').value='';load({scroll:true})}
 if(jump){closeMenu();$(jump.dataset.jump)?.scrollIntoView({behavior:'smooth'});$(jump.dataset.jump)?.focus({preventScroll:true})}
 if(e.target.closest('#clear-results'))reset();if(e.target.closest('#retry'))load({force:true});if(e.target.closest('#reader-retry')&&current)openSong(current.id,{force:true});
});
function setup(data){home=data;genres=data.genres||[];data.items.forEach(s=>registry.set(s.id,s));$('total').textContent=data.inventory?format(data.inventory):'Toàn kho';$('total').title='Số bài tại nguồn · '+new Date(data.checkedAt).toLocaleString('vi-VN');
 $('featured').innerHTML=(data.featured||[]).slice(0,18).map(s=>`<button class="card" data-open="${esc(s.id)}"><div class="art">${s.thumbnail?`<img loading="lazy" src="${esc(s.thumbnail)}" alt="${esc(s.title)}">`:esc(s.title)}<span>▶</span></div><div class="cardbody"><h3>${esc(s.title)}</h3><p class="meta">${esc(s.author)}</p><p class="meta">${esc(s.singer)}</p><div class="tag">Mở lời & hợp âm ›</div></div></button>`).join('');
 $('genres').innerHTML='<button class="chip active" data-genre="">♫ Tất cả</button>'+genres.map(g=>`<button class="chip" data-genre="${g.id}">${g.icon} ${esc(g.name)}</button>`).join('');
 $('menu-genres').innerHTML=genres.map(g=>`<button data-genre="${g.id}"><span aria-hidden="true">${g.icon}</span> ${esc(g.name)}</button>`).join('');
 const artists=['Trịnh Công Sơn','Anh Bằng','Lam Phương','Ngô Thụy Miên','Phạm Duy','Hoàng Dũng','Đức Trí','Đông Thiên Đức','Trần Thiện Thanh','Vũ Thành An'];
 $('artists').innerHTML=artists.map(a=>`<button class="artist" data-artist="${esc(a)}"><div class="avatar">${esc(a.split(' ').map(x=>x[0]).slice(-2).join(''))}</div>${esc(a)}</button>`).join('');
}
async function refreshHome(){try{const response=await fetch('/api/catalog?mode=home');if(!response.ok)return;const data=await response.json();if(!data.items?.length)return;setup(data);filters();if(state.mode==='home'&&!state.q&&!state.genre)draw(data)}catch{}}
(async()=>{
 try{const response=await fetch('/catalog-seed.json');if(response.ok)setup(await response.json())}catch{}
 const p=new URLSearchParams(location.search),shared=valid(p.get('song')),songId=location.hash.match(/^#bai\/([A-Za-z0-9_-]+)$/)?.[1];
 state={q:(p.get('q')||'').slice(0,120),type:['title','singer','composer'].includes(p.get('type'))?p.get('type'):'title',genre:genres.some(g=>String(g.id)===p.get('genre'))?p.get('genre'):'',mode:['home','search','browse','hot','latest','favorites','offline'].includes(p.get('mode'))?p.get('mode'):'home',page:Math.max(0,Math.min(2000,parseInt(p.get('page')||'0',10)||0))};
 if(state.mode!=='offline'){if(state.q)state.mode='search';else if(state.genre)state.mode='browse'}
 $('query').value=state.q;await load();
 if(shared){const id=songReferenceId(shared);if(!registry.has(id))registry.set(id,{id,url:shared,title:'Đang mở bài…',local:!!communitySongId(shared)});openSong(id)}else if(songId&&registry.has(songId))openSong(songId);
 if(navigator.onLine!==false)refreshHome();
})();
})();
