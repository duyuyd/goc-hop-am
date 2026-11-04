export function lyricWords(text){return String(text||'').replace(/\[[^\]\n]*\]/g,' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[^a-z0-9\s]/g,' ').trim().split(/\s+/).filter(Boolean)}
export function matchLyric(lines,spoken,from=0){
 const words=lyricWords(spoken).slice(-14);if(words.length<3)return null;
 let best=null;for(let i=Math.max(0,from-1);i<Math.min(lines.length,from+15);i++){
  const target=lyricWords(lines[i]).slice(0,120);if(target.length<3)continue;
  const row=Array(target.length+1).fill(0);for(const word of words){let prior=0;for(let j=1;j<=target.length;j++){const old=row[j];row[j]=word===target[j-1]?prior+1:Math.max(row[j],row[j-1]);prior=old;}}
  const common=row[target.length],score=common/Math.min(target.length,words.length);if(common>=3&&score>=.6&&(!best||score>best.score))best={index:i,score};
 }return best;
}
export function cleanTimeline(value,lineCount=2000){
 if(!Array.isArray(value))return [];
 return value.filter(v=>v&&Number.isFinite(v.time)&&v.time>=0&&v.time<86400&&Number.isInteger(v.line)&&v.line>=0&&v.line<lineCount).slice(0,2000).map(v=>({time:Math.round(v.time*100)/100,line:v.line})).sort((a,b)=>a.time-b.time);
}
export function timedLine(timeline,time){if(!Number.isFinite(time)||time<0)return null;let found=null;for(const cue of timeline){if(cue.time>time)break;found=cue.line}return found}
export function parseLrc(text,lines){
 if(String(text).length>60000)throw new Error('Dữ liệu LRC quá lớn.');const cues=[];let from=0;
 for(const line of String(text).split(/\r?\n/)){const matches=[...line.matchAll(/\[(\d{1,3}):(\d{2}(?:\.\d{1,3})?)\]/g)];if(!matches.length)continue;const phrase=line.replace(/\[[^\]]*\]/g,'').trim();if(!phrase)continue;let result=matchLyric(lines,phrase,from);if(!result)result=matchLyric(lines,phrase,0);if(!result)continue;from=result.index;for(const m of matches){if(Number(m[2])<60)cues.push({time:Number(m[1])*60+Number(m[2]),line:from})}}
 return cleanTimeline(cues,lines.length);
}
export function captionTimeline(lines,cues){
 const targets=lines.slice(0,1200).map(text=>lyricWords(text));let from=0,last=-1;const result=[],recent=[];
 for(const cue of (Array.isArray(cues)?cues:[]).slice(0,3000)){
  if(!cue||!Number.isFinite(cue.start)||cue.start<0||typeof cue.text!=='string')continue;
  recent.push(cue);if(recent.length>3)recent.shift();
  const options=[{words:lyricWords(cue.text),start:cue.start},{words:lyricWords(recent.map(c=>c.text).join(' ')),start:recent[0].start}];let best=null;
  for(const option of options){const words=option.words.slice(-40),heard=new Set(words);if(words.length<3)continue;
   const find=(start,end)=>{for(let i=start;i<end;i++){const target=targets[i];if(target.length<3)continue;let common=0;const unique=new Set(target);for(const word of unique)if(heard.has(word))common++;
    const score=common/Math.max(3,Math.min(unique.size,heard.size));if(common>=3&&score>=.68){const rank=score+(i>=from&&i<from+5?.04:0)-Math.abs(i-from)*.0001;if(!best||rank>best.rank)best={line:i,time:option.start,rank};}}};
   find(Math.max(0,from-1),Math.min(targets.length,from+16));if(!best)find(0,targets.length);
  }
  if(best){from=best.line;if(last!==best.line){result.push({time:best.time,line:best.line});last=best.line;recent.length=0;}}
 }
 return cleanTimeline(result,lines.length);
}
export function createFollow({call,native,toast,getSong,getVideo,onHighlight,stopRegular}){
 const e=id=>document.getElementById(id);let mode='off',line=0,clock=null,settings={},lines=[],saveTimer,generation=0;
 const key=()=>{const song=getSong(),video=getVideo();return song&&video?song.sourceUrl+'|'+video:null};
 function status(text){e('follow-status').textContent=text;e('follow-live').hidden=!text;e('mark-line').hidden=mode!=='mark'}
 function highlight(index){line=Math.max(0,Math.min(lines.length-1,index));onHighlight(line)}
 function save(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>call('settingsSave',{value:JSON.stringify(settings)}).catch(error=>toast(error.message)),150)}
 function stop(){++generation;mode='off';call('speechStop').catch(()=>{});e('follow-mode').value='off';status('')}
 async function videoReady(){
  const k=key(),id=getVideo();if(!k||!lines.length){toast('Mở video YouTube trước khi theo lời.');return}
  const ticket=++generation;stopRegular();mode='time';e('follow-mode').value='time';
  if(cleanTimeline(settings[k],lines.length).length){status('Lời đang theo thời gian YouTube · không dùng micro');return}
  status('Đang khớp lời với phụ đề của video YouTube…');
  try{const data=await call('api',{path:'/api/video-captions?'+new URLSearchParams({id})});if(ticket!==generation||id!==getVideo())return;
   const timeline=captionTimeline(lines,data.cues);
   if(!data.available||timeline.length<2){mode='off';status(data.reason||'Video này chưa có phụ đề khớp lời. Chọn bản khác hoặc nhập LRC.');return}
   settings[k]=timeline;save();status('Đang theo lời YouTube · '+timeline.length+' mốc khớp từ phụ đề');
  }catch{if(ticket===generation){mode='off';status('Chưa có mốc lời cho video này. Chọn bản khác hoặc nhập LRC.')}}
 }
 function apply(){
  const selected=e('follow-mode').value;call('speechStop').catch(()=>{});stopRegular();
  if(selected==='time'){videoReady();e('follow-dialog').close();return}
  ++generation;mode=selected==='mark'?'mark':'off';if(mode==='mark'&&!key()){mode='off';toast('Mở bản thu YouTube trước khi đánh dấu câu.');return}
  status(mode==='mark'?'Chọn dòng lời, đánh dấu khi câu trong video bắt đầu.':'');e('follow-dialog').close();
 }
 e('follow-open').addEventListener('click',()=>{e('follow-mode').value=mode==='off'?'time':mode;e('follow-dialog').showModal()});e('follow-close').addEventListener('click',()=>e('follow-dialog').close());e('follow-apply').addEventListener('click',apply);
 e('follow-next').addEventListener('click',()=>highlight(line+1));
 e('mark-line').addEventListener('click',()=>{const k=key();if(!k||!clock||!Number.isFinite(clock.time)){toast('Chưa nhận được thời gian thật của video.');return}const cues=cleanTimeline(settings[k],lines.length).filter(c=>c.line!==line);cues.push({time:clock.time,line});settings[k]=cleanTimeline(cues,lines.length);save();status(`Đã ghi mốc ${clock.time.toFixed(1)} giây · câu ${line+1}`);highlight(line+1)});
 e('lrc-import').addEventListener('click',()=>{const k=key();if(!k){toast('Mở bản thu YouTube trước.');return}try{const cues=parseLrc(e('lrc-input').value,lines);if(!cues.length)throw new Error('Chưa khớp được câu nào. Hãy kiểm tra nội dung LRC.');settings[k]=cues;save();e('follow-mode').value='time';toast(`Đã nhập ${cues.length} mốc từ LRC.`)}catch(error){toast(error.message)}});
 call('settingsLoad').then(value=>{try{const object=JSON.parse(value);if(object&&typeof object==='object'&&!Array.isArray(object))settings=object}catch{}}).catch(()=>{});
 return {stop,videoReady,onSong(song){stop();lines=String(song?.content||'').split('\n');line=0;clock=null},select(index){highlight(index)},onTick(event){clock=event;if(mode==='time'&&event.id===getVideo()){const next=timedLine(cleanTimeline(settings[key()],lines.length),event.time);if(next!==null&&next!==line)highlight(next)}},get permissionPending(){return false},get mode(){return mode}};
}
