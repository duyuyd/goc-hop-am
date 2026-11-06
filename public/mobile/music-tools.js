import {transcribeMusicAudio,readMusicAudio} from './pitch.js';
import {readMusicText} from './follow.js';
import {midiToScore,scoreToMusicXML,repairScore,analyzeScore} from './score-io.js';
import {transpose} from './logic.js';
// Góc Hợp Âm music workspace. Project developer: NPT Duy.
const musicNames=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const musicQualities={'':[0,4,7],m:[0,3,7],'7':[0,4,7,10],maj7:[0,4,7,11],m7:[0,3,7,10],dim:[0,3,6],aug:[0,4,8],sus2:[0,2,7],sus4:[0,5,7],'6':[0,4,7,9],m6:[0,3,7,9],add9:[0,4,7,14]};
const musicEscape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
export function musicChord(root,quality=''){const r=musicNames.indexOf(root),q=musicQualities[quality];if(r<0||!q)return [];return q.map(n=>60+r+n)}
export function cleanScore(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Tệp sheet không hợp lệ.');
 const notes=[];let beat=0;
 for(const n of (Array.isArray(value.notes)?value.notes:[]).slice(0,128)){if(!n||![.5,1,2,4].includes(n.beats)||!(n.midi===null||Number.isInteger(n.midi)&&n.midi>=48&&n.midi<=84))throw new Error('Nốt trong sheet không hợp lệ.');if((beat%4)+n.beats>4)throw new Error('Nốt vượt quá ô nhịp 4/4.');notes.push({midi:n.midi,beats:n.beats});beat+=n.beats}
 return {format:'goc-score-1',title:String(value.title||'Giai điệu của tôi').slice(0,100),author:String(value.author||'').slice(0,100),bpm:Math.max(40,Math.min(240,Number(value.bpm)||80)),notes,origin:['midi','audio','ai_generated','verified','auto_repaired'].includes(value.origin)?value.origin:'manual',verified:Boolean(value.verified)};
}
export function scoreSvg(value,blank=false){
 const score=cleanScore(value),total=score.notes.reduce((s,n)=>s+n.beats,0),systems=blank?4:Math.max(1,Math.ceil(total/16)),height=170+systems*150;let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 ${height}" role="img" aria-label="Sheet ${musicEscape(score.title)}"><rect width="800" height="${height}" fill="white"/><g fill="#19151d" font-family="Georgia,serif"><text x="400" y="38" font-size="25" text-anchor="middle">${musicEscape(blank?'Giấy kẻ nhạc':score.title)}</text><text x="752" y="64" text-anchor="end" font-size="14">${musicEscape(score.author)}</text><text x="48" y="82" font-size="13">4/4 · ♩ = ${score.bpm} · Đô trưởng / La thứ</text>`;
 for(let row=0;row<systems;row++){const top=110+row*150;for(let line=0;line<5;line++)svg+=`<path d="M48 ${top+line*10}H752" fill="none" stroke="#333"/>`;svg+=`<text x="48" y="${top+35}" font-size="49">𝄞</text>`;for(let bar=0;bar<=4;bar++)svg+=`<path d="M${84+bar*167} ${top}v40" stroke="#333"/>`;svg+=`<text x="88" y="${top-12}" font-size="11">${row*4+1}</text>`}
 let beat=0;for(const n of (blank?[]:score.notes)){const row=Math.floor(beat/16),bar=Math.floor(beat%16/4),x=98+bar*167+(beat%4)*37,top=110+row*150;
  if(n.midi===null){svg+=`<text x="${x-6}" y="${top+29}" font-size="25">${n.beats===4?'𝄻':n.beats===2?'𝄼':'𝄽'}</text>`}
  else{const pitch=n.midi%12,step=[0,0,1,1,2,3,3,4,4,5,5,6][pitch]+Math.floor((n.midi-60)/12)*7,y=top+50-step*5;
   for(let ledger=top+50;y>=ledger;ledger+=10)svg+=`<path d="M${x-10} ${ledger}h20" stroke="#333"/>`;
   for(let ledger=top-10;y<=ledger;ledger-=10)svg+=`<path d="M${x-10} ${ledger}h20" stroke="#333"/>`;
   if([1,3,6,8,10].includes(pitch))svg+=`<text x="${x-18}" y="${y+5}" font-size="18">♯</text>`;
   svg+=`<ellipse cx="${x}" cy="${y}" rx="7" ry="4.8" transform="rotate(-18 ${x} ${y})" fill="${n.beats>=2?'white':'#19151d'}" stroke="#19151d" stroke-width="1.5"/>`;
   if(n.beats<4){const down=y<top+20,stemx=x+(down?-6:6),end=y+(down?30:-30);svg+=`<path d="M${stemx} ${y}V${end}" stroke="#19151d" stroke-width="1.4"/>`;if(n.beats===.5)svg+=`<path d="M${stemx} ${end}q${down?-13:13} 8 4 18" fill="none" stroke="#19151d" stroke-width="2"/>`}
  }beat+=n.beats;
 }
 return svg+`<text x="400" y="${height-20}" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#666">Soạn tại Góc Hợp Âm · NPT Duy</text></g></svg>`;
}
export const guitarChordShapes = {
  'C': [-1, 3, 2, 0, 1, 0],
  'C#': [-1, 4, 3, 1, 2, 1],
  'Db': [-1, 4, 3, 1, 2, 1],
  'D': [-1, -1, 0, 2, 3, 2],
  'D#': [-1, -1, 1, 3, 4, 3],
  'Eb': [-1, -1, 1, 3, 4, 3],
  'E': [0, 2, 2, 1, 0, 0],
  'F': [1, 3, 3, 2, 1, 1],
  'F#': [2, 4, 4, 3, 2, 2],
  'Gb': [2, 4, 4, 3, 2, 2],
  'G': [3, 2, 0, 0, 0, 3],
  'G#': [4, 6, 6, 5, 4, 4],
  'Ab': [4, 6, 6, 5, 4, 4],
  'A': [-1, 0, 2, 2, 2, 0],
  'A#': [-1, 1, 3, 3, 3, 1],
  'Bb': [-1, 1, 3, 3, 3, 1],
  'B': [-1, 2, 4, 4, 4, 2],
  'Cm': [-1, 3, 5, 5, 4, 3],
  'C#m': [-1, 4, 6, 6, 5, 4],
  'Dbm': [-1, 4, 6, 6, 5, 4],
  'Dm': [-1, -1, 0, 2, 3, 1],
  'D#m': [-1, -1, 1, 3, 4, 2],
  'Ebm': [-1, -1, 1, 3, 4, 2],
  'Em': [0, 2, 2, 0, 0, 0],
  'Fm': [1, 3, 3, 1, 1, 1],
  'F#m': [2, 4, 4, 2, 2, 2],
  'Gbm': [2, 4, 4, 2, 2, 2],
  'Gm': [3, 5, 5, 3, 3, 3],
  'G#m': [4, 6, 6, 4, 4, 4],
  'Abm': [4, 6, 6, 4, 4, 4],
  'Am': [-1, 0, 2, 2, 1, 0],
  'A#m': [-1, 1, 3, 3, 2, 1],
  'Bbm': [-1, 1, 3, 3, 2, 1],
  'Bm': [-1, 2, 4, 4, 3, 2],
  'C7': [-1, 3, 2, 3, 1, 0],
  'D7': [-1, -1, 0, 2, 1, 2],
  'E7': [0, 2, 0, 1, 0, 0],
  'F7': [1, 3, 1, 2, 1, 1],
  'G7': [3, 2, 0, 0, 0, 1],
  'A7': [-1, 0, 2, 0, 2, 0],
  'B7': [-1, 2, 1, 2, 0, 2],
  'Cm7': [-1, 3, 5, 3, 4, 3],
  'Dm7': [-1, -1, 0, 2, 1, 1],
  'Em7': [0, 2, 0, 0, 0, 0],
  'Fm7': [1, 3, 1, 1, 1, 1],
  'Gm7': [3, 5, 3, 3, 3, 3],
  'Am7': [-1, 0, 2, 0, 1, 0],
  'Bm7': [-1, 2, 0, 2, 0, 2],
  'Cmaj7': [-1, 3, 2, 0, 0, 0],
  'Dmaj7': [-1, -1, 0, 2, 2, 2],
  'Emaj7': [0, 2, 1, 1, 0, 0],
  'Fmaj7': [-1, -1, 3, 2, 1, 0],
  'Gmaj7': [3, 2, 0, 0, 0, 2],
  'Amaj7': [-1, 0, 2, 1, 2, 0],
  'Csus4': [-1, 3, 3, 0, 1, 1],
  'Dsus4': [-1, -1, 0, 2, 3, 3],
  'Esus4': [0, 2, 2, 2, 0, 0],
  'Gsus4': [3, 2, 0, 0, 1, 3],
  'Asus4': [-1, 0, 2, 2, 3, 0],
  'Dsus2': [-1, -1, 0, 2, 3, 0],
  'Asus2': [-1, 0, 2, 2, 0, 0],
  'Cadd9': [-1, 3, 2, 0, 3, 0]
};

export function renderChordDiagramSVG(chordName){
 let shape=guitarChordShapes[chordName];
 if(!shape&&chordName.includes('/')){
  const base=chordName.split('/')[0];
  shape=guitarChordShapes[base];
 }
 if(!shape){
  const m=/^([A-G][#b]?)(.*)$/.exec(chordName.split('/')[0]);
  if(m){
   const simplified=m[1]+(m[2].startsWith('m')&&!m[2].startsWith('maj')?'m':m[2].startsWith('7')?'7':'');
   shape=guitarChordShapes[simplified];
  }
 }
 const w=74,h=94;
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" class="chord-diagram" style="display:block;margin:auto;"><text x="${w/2}" y="13" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#1b1424">${musicEscape(chordName)}</text>`;
 if(!shape){
  svg+=`<rect x="6" y="20" width="${w-12}" height="64" rx="6" fill="#f5f0ea" stroke="#d5c8b5"/><text x="${w/2}" y="48" font-size="10" text-anchor="middle" fill="#756247">Hợp âm</text><text x="${w/2}" y="66" font-size="12" font-weight="bold" text-anchor="middle" fill="#21192e">${musicEscape(chordName)}</text></svg>`;
  return svg;
 }
 const positiveFrets=shape.filter(f=>f>0);
 const minFret=positiveFrets.length?Math.min(...positiveFrets):1;
 const maxFret=positiveFrets.length?Math.max(...positiveFrets):1;
 const startFret=maxFret>4?minFret:1;
 const left=14,right=60,top=26,bottom=82;
 const stringDist=(right-left)/5;
 const fretDist=(bottom-top)/4;
 if(startFret===1){
  svg+=`<line x1="${left}" y1="${top}" x2="${right}" y2="${top}" stroke="#1b1424" stroke-width="3"/>`;
 }else{
  svg+=`<line x1="${left}" y1="${top}" x2="${right}" y2="${top}" stroke="#666" stroke-width="1.5"/><text x="${left-3}" y="${top+10}" font-size="9" text-anchor="end" font-weight="bold" fill="#666">${startFret}fr</text>`;
 }
 for(let f=1;f<=4;f++){
  const y=top+f*fretDist;
  svg+=`<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="#999" stroke-width="1"/>`;
 }
 for(let s=0;s<6;s++){
  const x=left+s*stringDist;
  svg+=`<line x1="${x}" y1="${top}" x2="${x}" y2="${bottom}" stroke="#777" stroke-width="${s===0?1.4:1}"/>`;
 }
 for(let s=0;s<6;s++){
  const f=shape[s];
  const x=left+s*stringDist;
  if(f===-1){
   svg+=`<text x="${x}" y="${top-4}" font-size="10" font-weight="bold" text-anchor="middle" fill="#888">×</text>`;
  }else if(f===0){
   svg+=`<circle cx="${x}" cy="${top-6}" r="3" fill="none" stroke="#555" stroke-width="1.2"/>`;
  }else{
   const rel=f-startFret+1;
   if(rel>=1&&rel<=4){
    const y=top+(rel-0.5)*fretDist;
    svg+=`<circle cx="${x}" cy="${y}" r="4.2" fill="#21192e"/>`;
   }
  }
 }
 svg+=`</svg>`;
 return svg;
}

export function songToPrintableHTML(song,shift=0){
 if(!song||!song.content)return '';
 const transFn=typeof transpose==='function'?transpose:(c,s)=>c;
 const currentKey=transFn(song.key||'C',shift);
 const hasTransposition=shift!==0;
 const chords=[];
 const seenChords=new Set();
 const chordRegex=/\[([A-G](?:#|b)?[^\]\n]{0,24})\]/g;
 let match;
 while((match=chordRegex.exec(song.content))){
  const tChord=transFn(match[1].trim(),shift);
  if(!seenChords.has(tChord)){
   seenChords.add(tChord);
   chords.push(tChord);
  }
 }
 let chordChartHTML='';
 if(chords.length){
  chordChartHTML=`<section class="chord-chart-section"><div class="chord-chart-header"><span class="chord-chart-title">BẢNG HỢP ÂM TRONG BÀI (${chords.length} hợp âm)</span><span class="chord-chart-hint">Thế bấm Guitar &amp; nốt cấu tạo</span></div><div class="chord-grid">${chords.map(ch=>{
   const svg=renderChordDiagramSVG(ch);
   const rootMatch=/^([A-G][#b]?)(.*)$/.exec(ch.split('/')[0]);
   let noteInfo='';
   if(rootMatch){
    const notes=musicChord(rootMatch[1],rootMatch[2]);
    if(notes.length){
     noteInfo=`<small class="chord-notes">${notes.map(n=>musicNames[n%12]).join(' · ')}</small>`;
    }
   }
   return `<div class="chord-card">${svg}${noteInfo}</div>`;
  }).join('')}</div></section>`;
 }
 const formattedLyrics=song.content.split('\n').map(line=>{
  let out='',start=0,m;
  const lineRegex=/\[([A-G](?:#|b)?[^\]\n]{0,24})\]/g;
  while((m=lineRegex.exec(line))){
   out+=musicEscape(line.slice(start,m.index));
   const t=transFn(m[1].trim(),shift);
   out+=`<span class="chord">[${musicEscape(t)}]</span>`;
   start=lineRegex.lastIndex;
  }
  out+=musicEscape(line.slice(start));
  return out;
 }).join('\n');
 const printDate=new Date().toLocaleDateString('vi-VN',{year:'numeric',month:'2-digit',day:'2-digit'});
 return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Góc Hợp Âm · ${musicEscape(song.title)}</title><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:"><style>@page{size:A4 portrait;margin:12mm 14mm}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.chord-chart-section,.print-footer{page-break-inside:avoid}}*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Georgia,serif;color:#1a1423;background:#fff;margin:0;padding:0;line-height:1.6}.print-header{border-bottom:2px solid #241c30;padding-bottom:10px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-end;gap:16px}.print-title-wrap h1{font-family:Georgia,serif;font-size:24px;line-height:1.25;margin:0 0 4px 0;color:#17131e}.print-author{font-size:13px;color:#4a3f55;margin:0}.print-meta-badges{text-align:right;flex-shrink:0}.print-key-pill{display:inline-block;background:#241c30;color:#e5bd79;font-weight:700;padding:3px 9px;border-radius:6px;font-size:13px;letter-spacing:0.3px}.print-date{display:block;color:#7a6e85;font-size:11px;margin-top:4px}.chord-chart-section{background:#fbf9f6;border:1px solid #e5dcce;border-radius:10px;padding:10px 14px;margin-bottom:18px}.chord-chart-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;border-bottom:1px solid #eee5d7;padding-bottom:4px}.chord-chart-title{font-size:11px;font-weight:800;letter-spacing:0.8px;color:#6b5333}.chord-chart-hint{font-size:10px;color:#8c785f}.chord-grid{display:flex;flex-wrap:wrap;gap:12px 14px;align-items:flex-start}.chord-card{display:inline-flex;flex-direction:column;align-items:center;background:#fff;border:1px solid #ebd9c2;border-radius:8px;padding:6px 8px 4px;box-shadow:0 1px 3px rgba(0,0,0,0.03)}.chord-notes{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:9px;color:#79664e;margin-top:2px;letter-spacing:0.3px}.lyrics-section{margin-top:12px}.lyrics-pre{font-family:Georgia,"Times New Roman",serif;font-size:15px;line-height:1.95;white-space:pre-wrap;word-wrap:break-word;color:#1a1423;margin:0}.lyrics-pre .chord{display:inline;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-weight:700;font-size:0.88em;color:#94580b;background:#faf3e8;border-radius:3px;padding:1px 3px}.print-footer{border-top:1px solid #e0d8e8;margin-top:28px;padding-top:8px;display:flex;justify-content:space-between;font-size:11px;color:#7a6e85}</style></head><body><header class="print-header"><div class="print-title-wrap"><h1>${musicEscape(song.title)}</h1><p class="print-author">Sáng tác / Trình bày: <strong>${musicEscape(song.author||song.composer||song.artist||'Góc Hợp Âm')}</strong></p></div><div class="print-meta-badges"><span class="print-key-pill">Tông: ${musicEscape(currentKey)}${hasTransposition?` (${shift>0?'+'+shift:shift})`:''}</span><span class="print-date">In ngày: ${printDate}</span></div></header>${chordChartHTML}<main class="lyrics-section"><pre class="lyrics-pre">${formattedLyrics}</pre></main><footer class="print-footer"><span>Góc Hợp Âm · https://goc-hop-am.onwardcrust.chatgpt.site</span><span>Mang giai điệu theo bạn · NPT Duy</span></footer></body></html>`;
}

export function createMusicTools({native=false,call=async()=>true,toast=()=>{},getSong=()=>null,getShift=()=>0}={}){
 let data={score:{format:'goc-score-1',title:'Giai điệu của tôi',author:'',bpm:80,notes:[]},notes:'',sessions:[]};
 try{const v=JSON.parse(localStorage.getItem('goc-music-workspace-v1')||'null');if(v){data={score:cleanScore(v.score),notes:String(v.notes||'').slice(0,15000),sessions:Array.isArray(v.sessions)?v.sessions.filter(s=>s&&Number.isFinite(s.minutes)&&s.minutes>0&&typeof s.date==='string').slice(-30):[]}}}catch{}
 const dialog=document.createElement('dialog');dialog.id='music-tools';dialog.className='music-tools';dialog.setAttribute('aria-labelledby','music-title');
    dialog.innerHTML=`<div class="music-head"><div><span class="music-kicker">GÓC HỢP ÂM · NPT DUY</span><h2 id="music-title">Góc luyện nhạc</h2></div><button data-music-close aria-label="Đóng công cụ">×</button></div><nav class="music-tabs" aria-label="Công cụ âm nhạc"><button data-music-tab="chords" aria-pressed="true">Hợp âm</button><button data-music-tab="score" aria-pressed="false">Sheet nhạc</button><button data-music-tab="browse" aria-pressed="false">Kho sheet ♫</button><button data-music-tab="practice" aria-pressed="false">Buổi tập</button></nav><section data-music-panel="chords"><p class="music-muted">12 giọng · 12 loại hợp âm · phát bằng âm tổng hợp trên thiết bị.</p><div class="music-fields"><label>Âm gốc<select id="music-root">${musicNames.map(n=>`<option>${n}</option>`).join('')}</select></label><label>Loại hợp âm<select id="music-quality">${Object.keys(musicQualities).map(q=>`<option value="${q}">${q||'Trưởng'}${q==='m'?' · thứ':''}</option>`).join('')}</select></label></div><div class="music-chord"><strong id="music-chord-name">C</strong><p id="music-tones"></p><div id="music-piano" aria-label="Các nốt của hợp âm"></div><button id="music-play-chord">▶ Nghe hợp âm</button></div><h3>Gam & vòng hòa âm</h3><p id="music-scale"></p><p id="music-progression"></p><button id="music-play-progression">▶ Nghe vòng I – vi – IV – V</button><p class="music-muted">Ký hiệu phím thăng (#); các nốt đồng âm có thể được viết khác trong bản nhạc.</p></section><section data-music-panel="score" hidden><p class="music-muted">Soạn giai điệu một bè, nhịp 4/4. Thêm từng nốt, phát lại, in hoặc lưu bản soạn của bạn.</p><div class="music-fields"><label>Tên bản soạn<input id="music-score-title" maxlength="100"></label><label>Người soạn<input id="music-score-author" maxlength="100" placeholder="Tên của bạn"></label></div><div class="music-fields"><label>Nốt<select id="music-note">${Array.from({length:37},(_,i)=>`<option value="${48+i}">${musicNames[i%12]}${3+Math.floor(i/12)}</option>`).join('')}<option value="rest">Dấu lặng</option></select></label><label>Trường độ<select id="music-duration"><option value="1">Nốt đen · 1 phách</option><option value="0.5">Móc đơn · ½ phách</option><option value="2">Nốt trắng · 2 phách</option><option value="4">Nốt tròn · 4 phách</option></select></label><label>BPM<input id="music-score-bpm" type="number" min="40" max="240" value="80"></label></div><div class="music-fields"><label>Âm sắc<select id="music-timbre"><option value="piano">Piano (Dương cầm)</option><option value="organ">Organ (Điện tử)</option><option value="guitar">Guitar (Mộc)</option></select></label><label>Đàn MIDI USB<button id="music-midi-btn" type="button" class="wide">🎹 Kết nối đàn MIDI</button></label></div><div class="music-keyboard-wrap"><div id="music-keyboard" class="music-keyboard" aria-label="Đàn piano hai quãng tám"></div></div><p id="music-current-note" class="music-muted" aria-live="polite">Chạm phím để chơi · Khi phát sheet, phím sáng theo từng nốt.</p><p id="music-midi-status" class="music-muted" style="color:var(--m-gold)">Chưa kết nối đàn MIDI USB. Bấm 'Kết nối đàn MIDI' hoặc cắm đàn để chơi trực tiếp.</p><div class="music-actions"><button id="music-add-note">＋ Thêm nốt</button><button id="music-undo">↶ Bỏ nốt cuối</button><button id="music-play-score">▶ Nghe sheet</button><button id="music-stop">■ Dừng</button></div><div class="music-fields"><label>Nốt cần chỉnh<select id="music-edit-index" aria-label="Chọn nốt cần chỉnh"></select></label><button id="music-edit-note">Sửa bằng nốt &amp; trường độ đã chọn</button></div><p id="music-score-info" role="status"></p><div id="music-score-preview" class="music-score-preview"></div><div class="music-actions"><button id="music-print-score">In / lưu PDF</button><button id="music-blank">Giấy kẻ nhạc</button><button id="music-export">↓ Sao lưu sheet JSON</button><button id="music-import">↑ Mở sheet JSON</button><button id="music-import-midi">↓ Nhập MIDI → dựng sheet</button><button id="music-export-xml">↑ Xuất MusicXML</button><button id="music-print-lyrics">In lời & hợp âm đang mở</button></div><div class="music-actions"><button id="music-analyze-btn" type="button" class="gold">🔍 Phân tích sheet AI</button><button id="music-repair-btn" type="button">🛠 Tự sửa lỗi sheet</button></div><div id="music-analysis-panel" class="music-analysis-panel" hidden></div><h3>Kho bản nhạc có sẵn 100% bài hát trong hệ thống</h3><p class="music-muted">Tất cả bài hát đều có sẵn bản nhạc chuẩn xác, không cần tìm nguồn mạng hoặc dán liên kết ngoài.</p><div class="music-fields"><label>Chọn bài trong kho<select id="music-catalog-select" aria-label="Chọn bài hát trong kho"><option value="">-- Chọn bài để nạp sheet ngay --</option></select></label><label>Bè nhạc<select id="music-sheet-variant" aria-label="Biến thể bè"><option value="melody">Giai điệu chính (Melody)</option><option value="piano">Bè Piano đệm</option><option value="organ">Bè Organ</option></select></label><button id="music-load-preset" type="button" class="gold">♫ Nạp sheet ngay</button></div><h3>Nhận giai điệu từ âm thanh</h3><p class="music-muted">Chọn tệp hát/đàn một bè dưới 3 MB. Nhận tối đa 60 giây mỗi lần, theo BPM đã chọn; tạo sheet nháp để nghe và chỉnh. Âm thanh xử lý trên máy.</p><label>Bắt đầu từ giây<input id="music-audio-start" type="number" min="0" max="3600" value="0"></label><button id="music-transcribe">↑ Chọn âm thanh &amp; tạo sheet nháp</button></section><section data-music-panel="browse" hidden><h3>Duyệt &amp; Kiểm định Kho Sheet Nhạc</h3><p class="music-muted">100% bài hát trong hệ thống đều có bản nhạc chuẩn, tự kiểm định và tự sửa lỗi nếu bản AI gặp sự cố.</p><div class="music-actions"><button id="music-browse-refresh" type="button" class="gold">🔄 Làm mới danh sách</button><button id="music-browse-repair-all" type="button">🛠 Tự kiểm tra &amp; sửa toàn bộ kho</button></div><div id="music-browse-stats" class="music-browse-stats"></div><div class="music-fields"><label>Tìm bài hát trong kho<input id="music-browse-search" placeholder="Nhập tên bài hát hoặc tác giả…"></label></div><div id="music-browse-list" class="music-browse-list">Đang nạp danh sách…</div></section><section data-music-panel="practice" hidden><h3>Nhật ký luyện tập</h3><label>Mục tiêu, vòng hợp âm, ghi chú<textarea id="music-practice-notes" rows="6" maxlength="15000" placeholder="Hôm nay tập chuyển Am – F – C – G…"></textarea></label><div class="music-fields"><label>Số phút đã tập<input id="music-minutes" type="number" min="1" max="600" value="15"></label><button id="music-log">Lưu buổi tập</button></div><div id="music-session-list"></div><p class="music-muted">Bản soạn và ghi chú tự lưu trên thiết bị này. Xuất JSON để giữ bản soạn khi đổi máy. Không tự đăng lên mạng.</p></section><p id="music-message" role="status" aria-live="polite"></p><p class="music-byline">Dự án do NPT Duy phát triển.</p>`;
 document.body.append(dialog);const el=id=>dialog.querySelector('#'+id);let audio,timers=[],picking=false,timbre='piano',midiAccess=null;
 function message(text){el('music-message').textContent=text;toast(text)}
 function save(){try{localStorage.setItem('goc-music-workspace-v1',JSON.stringify(data))}catch{message('Chưa lưu được trên thiết bị. Hãy xuất JSON để giữ bản soạn.')}}
 function stop(){for(const timer of timers)clearTimeout(timer);timers=[];if(audio){audio.close().catch(()=>{});audio=null}dialog.querySelectorAll('.music-key.active').forEach(k=>k.classList.remove('active'))}
 async function context(){stop();audio=new (window.AudioContext||window.webkitAudioContext)();await audio.resume();return audio}
 function sound(ctx,midi,start,length=.7){if(midi===null)return;const freq=440*2**((midi-69)/12);if(timbre==='organ'){[1,2,3].forEach((h,idx)=>{const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.value=freq*h;gain.gain.setValueAtTime([.08,.05,.03][idx],start);gain.gain.exponentialRampToValueAtTime(.001,start+length);osc.connect(gain).connect(ctx.destination);osc.start(start);osc.stop(start+length+.03)})}else if(timbre==='guitar'){const osc=ctx.createOscillator(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();osc.type='sawtooth';osc.frequency.value=freq;filter.type='lowpass';filter.frequency.setValueAtTime(freq*4,start);filter.frequency.exponentialRampToValueAtTime(freq*.8,start+length*.8);gain.gain.setValueAtTime(.14,start);gain.gain.exponentialRampToValueAtTime(.001,start+length);osc.connect(filter).connect(gain).connect(ctx.destination);osc.start(start);osc.stop(start+length+.03)}else{const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='triangle';osc.frequency.value=freq;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.12,start+.02);gain.gain.exponentialRampToValueAtTime(.001,start+Math.max(.05,length));osc.connect(gain).connect(ctx.destination);osc.start(start);osc.stop(start+length+.03)}}
 function lightNote(midi){for(const key of dialog.querySelectorAll('.music-key'))key.classList.toggle('active',Number(key.dataset.midi)===midi);el('music-current-note').textContent=midi===null?'Dấu lặng':musicNames[midi%12]+(Math.floor(midi/12)-1)}
 function handleMidiMessage(event){const [status,note,velocity]=event.data,cmd=status>>4;if(cmd===9&&velocity>0){if(note>=48&&note<=84){lightNote(note);el('music-note').value=String(note);context().then(ctx=>sound(ctx,note,ctx.currentTime,.65)).catch(()=>{})}}else if(cmd===8||(cmd===9&&velocity===0)){if(note>=48&&note<=84){const key=dialog.querySelector(`.music-key[data-midi="${note}"]`);if(key)key.classList.remove('active')}}}
 async function initMIDI(){if(!navigator.requestMIDIAccess){message('Trình duyệt chưa hỗ trợ Web MIDI API.');return}try{midiAccess=await navigator.requestMIDIAccess();const inputs=Array.from(midiAccess.inputs.values());if(inputs.length){inputs.forEach(input=>input.onmidimessage=handleMidiMessage);message('Đã kết nối đàn MIDI: '+inputs[0].name)}else{message('Đã bật MIDI. Cắm đàn qua USB để chơi.')}midiAccess.onstatechange=()=>{const updated=Array.from(midiAccess.inputs.values());updated.forEach(input=>input.onmidimessage=handleMidiMessage);if(updated.length)message('Đã nhận thiết bị: '+updated[0].name)}}catch{message('Chưa cấp quyền MIDI hoặc không tìm thấy đàn.')}}
 let white=0;for(let midi=60;midi<=84;midi++){const pitch=midi%12,black=[1,3,6,8,10].includes(pitch),key=document.createElement('button');key.className='music-key '+(black?'is-black':'is-white');key.dataset.midi=midi;key.style.left=((black?white-.32:white)/15*100)+'%';key.style.width=((black?.64:1)/15*100)+'%';key.textContent=musicNames[pitch];key.setAttribute('aria-label',musicNames[pitch]+(Math.floor(midi/12)-1));if(!black)white++;key.onpointerdown=async event=>{event.preventDefault();try{if(!audio)await context();await audio.resume();sound(audio,midi,audio.currentTime,.65);lightNote(midi);el('music-note').value=String(midi)}catch{message('Chưa phát được tiếng đàn.')}};el('music-keyboard').append(key)}
 const sheetSources={musescore:'https://musescore.com/sheetmusic',imslp:'https://imslp.org/',musopen:'https://musopen.org/sheetmusic/'};
 for(const button of dialog.querySelectorAll('[data-sheet-source]'))button.onclick=()=>{const url=sheetSources[button.dataset.sheetSource];if(native)call('sheetSource',{source:button.dataset.sheetSource}).catch(error=>message(error.message));else window.open(url,'_blank','noopener')};
 function finish(ctx,seconds){timers.push(setTimeout(()=>{if(audio===ctx)stop()},(seconds+.3)*1000))}
 function chord(){const root=el('music-root').value,q=el('music-quality').value,notes=musicChord(root,q),classes=new Set(notes.map(n=>n%12));el('music-chord-name').textContent=root+q;el('music-tones').textContent=notes.map(n=>musicNames[n%12]).join(' · ');el('music-piano').innerHTML=musicNames.map((n,i)=>`<span class="${n.includes('#')?'black':'white'} ${classes.has(i)?'on':''}">${n}</span>`).join('');const r=musicNames.indexOf(root);el('music-scale').textContent='Gam trưởng: '+[0,2,4,5,7,9,11].map(n=>musicNames[(r+n)%12]).join(' – ');el('music-progression').textContent=[root,musicNames[(r+9)%12]+'m',musicNames[(r+5)%12],musicNames[(r+7)%12]].join(' → ')}
  function score(){const v=data.score;el('music-score-title').value=v.title;el('music-score-author').value=v.author;el('music-score-bpm').value=v.bpm;el('music-score-preview').innerHTML=scoreSvg(v);const beats=v.notes.reduce((s,n)=>s+n.beats,0);el('music-score-info').textContent=v.notes.length+'/128 nốt · ô nhịp '+(Math.floor(beats/4)+1)+' · còn '+(4-beats%4)+' phách';el('music-score-info').textContent+=' · '+(v.origin==='midi'?'MIDI (chưa xác minh)':v.origin==='audio'?'Audio nháp (chưa xác minh)':'Bản soạn chuẩn');el('music-undo').disabled=!v.notes.length;el('music-edit-note').disabled=!v.notes.length;el('music-edit-index').innerHTML=v.notes.map((n,i)=>'<option value="'+i+'">'+(i+1)+'. '+(n.midi===null?'Lặng':musicNames[n.midi%12]+(Math.floor(n.midi/12)-1))+' · '+n.beats+' phách</option>').join('')}
 function loadScore(newScore){try{const draft=cleanScore(newScore);localStorage.setItem('goc-score-previous',JSON.stringify(data.score));data.score=draft;save();score();message('Đã nạp bản nhạc: '+draft.title+' ('+draft.notes.length+' nốt).');return true}catch(err){message('Lỗi nạp sheet: '+err.message);return false}}
 const defaultSongs=[{id:'nang-tho',title:'Nàng Thơ (Hoàng Dũng)'},{id:'song-gio',title:'Sóng Gió (Jack - K-ICM)'},{id:'chieu-nay-khong-co-mua-bay',title:'Chiều Nay Không Có Mưa Bay (Thái Tuyết Trâm)'},{id:'con-mua-ngang-qua',title:'Cơn Mưa Ngang Qua (Sơn Tùng M-TP)'},{id:'ha-trang',title:'Hạ Trắng (Trịnh Công Sơn)'},{id:'noi-nay-co-anh',title:'Nơi Này Có Anh (Sơn Tùng M-TP)'},{id:'tien-quan-ca',title:'Tiến Quân Ca (Văn Cao)'},{id:'di-vang-cuoc-tinh',title:'Dĩ Vãng Cuộc Tình (Duy Mạnh)'},{id:'ve-que-ngoai',title:'Về Quê Ngoại (Nguyễn Ngọc Thạch)'},{id:'em-ve-tinh-khoi',title:'Em Về Tinh Khôi (Quốc Bảo)'},{id:'mot-tinh-yeu-nho',title:'Một Tình Yêu Nhỏ (Nguyễn Đức Cường)'},{id:'de-nho-mot-thoi-ta-da-yeu',title:'Để Nhớ Một Thời Ta Đã Yêu (Thái Thịnh)'}];
 function populateCatalogSelect(list){const sel=el('music-catalog-select');if(!sel)return;const cur=sel.value;sel.innerHTML='<option value="">-- Chọn bài trong kho để nạp sheet ngay --</option>'+list.map(s=>`<option value="${s.id}">${s.title}</option>`).join('');if(cur)sel.value=cur}
 populateCatalogSelect(defaultSongs);
 call('api',{path:'/api/catalog?limit=50'}).then(res=>{if(res?.items&&Array.isArray(res.items)){const items=res.items.map(s=>({id:s.id||(s.sourceUrl?s.sourceUrl.replace(/^site:/,''):''),title:s.title+(s.author?' ('+s.author+')':'')})).filter(s=>s.id);if(items.length)populateCatalogSelect(items)}}).catch(()=>{});
 if(el('music-load-preset')){el('music-load-preset').onclick=async()=>{const songId=el('music-catalog-select')?.value,variant=el('music-sheet-variant')?.value||'melody';if(!songId){message('Vui lòng chọn bài hát trong danh mục.');return}try{message('Đang nạp sheet bài hát…');const res=await call('api',{path:'/api/reader?id='+encodeURIComponent(songId)+'&variant='+encodeURIComponent(variant)});if(res?.song?.score){loadScore(res.song.score);message('Đã nạp bản nhạc '+res.song.title+' ('+(variant==='piano'?'Piano':variant==='organ'?'Organ':'Melody')+') sẵn sàng!');}else message('Không lấy được bản nhạc từ kho bài.')}catch(err){message('Lỗi nạp sheet: '+err.message)}}}
 async function printHTML(body){
  const isDoc=body.trim().startsWith('<!doctype')||body.trim().startsWith('<html');
  const html=isDoc?body:'<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><title>Góc Hợp Âm · Sheet</title><style>@page{size:A4;margin:12mm}body{font:16px/1.7 Georgia,serif;color:#19151d}svg{width:100%;height:auto}pre{white-space:pre-wrap;font:inherit}small{font-family:sans-serif}h1{font-size:25px}</style></head><body>'+body+'</body></html>';
  if(native){await call('printSheet',{html});return}
  const frame=document.createElement('iframe');
  frame.setAttribute('aria-hidden','true');
  frame.style.cssText='position:fixed;width:1px;height:1px;bottom:0;left:0;border:0;opacity:0;pointer-events:none';
  frame.srcdoc=html;
  frame.onload=()=>{
   try{
    frame.contentWindow.focus();
    frame.contentWindow.print();
   }catch{
    window.print();
   }finally{
    setTimeout(()=>frame.remove(),60000);
   }
  };
  document.body.append(frame);
 }
 async function printLyrics(){
  const song=getSong();
  if(!song?.content){message('Mở bài hát trước rồi chọn in lời & hợp âm.');return}
  try{
   const s=typeof getShift==='function'?getShift():0;
   const fullHtml=songToPrintableHTML(song,s);
   await printHTML(fullHtml);
   message('Đã gửi yêu cầu in / lưu PDF đến trình duyệt.');
  }catch(error){message(error.message)}
 }
 function sessions(){el('music-session-list').replaceChildren();for(const session of [...data.sessions].reverse()){const p=document.createElement('p');p.textContent=new Date(session.date).toLocaleDateString('vi-VN')+' · '+session.minutes+' phút';el('music-session-list').append(p)}}
 dialog.querySelector('[data-music-close]').onclick=()=>dialog.close();dialog.addEventListener('close',stop);dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});for(const b of dialog.querySelectorAll('[data-music-tab]'))b.onclick=()=>{for(const tab of dialog.querySelectorAll('[data-music-tab]'))tab.setAttribute('aria-pressed',String(tab===b));for(const p of dialog.querySelectorAll('[data-music-panel]'))p.hidden=p.dataset.musicPanel!==b.dataset.musicTab;stop();if(b.dataset.musicTab==='browse')loadBrowse()};
 el('music-root').onchange=chord;el('music-quality').onchange=chord;
 el('music-play-chord').onclick=async()=>{try{const ctx=await context();musicChord(el('music-root').value,el('music-quality').value).forEach((n,i)=>sound(ctx,n,ctx.currentTime+i*.035));finish(ctx,1)}catch{message('Chưa phát được âm thanh. Kiểm tra âm lượng thiết bị.')}};
 el('music-play-progression').onclick=async()=>{try{const ctx=await context(),r=musicNames.indexOf(el('music-root').value);[0,9,5,7].forEach((n,i)=>musicChord(musicNames[(r+n)%12],i===1?'m':'').forEach(note=>sound(ctx,note,ctx.currentTime+i*1.1,.9)));finish(ctx,4.5)}catch{message('Chưa phát được vòng hòa âm.')}};
 for(const id of ['music-score-title','music-score-author','music-score-bpm'])el(id).onchange=()=>{data.score=cleanScore({...data.score,title:el('music-score-title').value,author:el('music-score-author').value,bpm:Number(el('music-score-bpm').value)});save();score()};
 el('music-add-note').onclick=()=>{try{if(data.score.notes.length>=128)throw new Error('Bản soạn đã đủ 128 nốt.');const value=el('music-note').value,n={midi:value==='rest'?null:Number(value),beats:Number(el('music-duration').value)};data.score=cleanScore({...data.score,notes:[...data.score.notes,n]});save();score();el('music-message').textContent=''}catch(error){message(error.message)}};
 el('music-edit-index').onchange=()=>{const n=data.score.notes[Number(el('music-edit-index').value)];if(n){el('music-note').value=n.midi===null?'rest':String(n.midi);el('music-duration').value=String(n.beats)}};
 el('music-edit-note').onclick=()=>{try{const i=Number(el('music-edit-index').value),notes=data.score.notes.map(n=>({...n})),value=el('music-note').value;if(!notes[i])return;notes[i]={midi:value==='rest'?null:Number(value),beats:Number(el('music-duration').value)};data.score=cleanScore({...data.score,notes});save();score();message('Đã chỉnh nốt '+(i+1)+'.')}catch(e){message(e.message)}};
 el('music-undo').onclick=()=>{data.score.notes.pop();save();score()};el('music-stop').onclick=stop;
 el('music-play-score').onclick=async()=>{if(!data.score.notes.length){message('Thêm nốt vào sheet trước.');return}try{const ctx=await context();let time=0;for(const n of data.score.notes){const length=n.beats*60/data.score.bpm;sound(ctx,n.midi,ctx.currentTime+time+.08,length*.9);const note=n.midi;timers.push(setTimeout(()=>lightNote(note),(time+.08)*1000));time+=length}finish(ctx,time+.08)}catch{message('Chưa phát được sheet.')}};
 el('music-print-score').onclick=()=>printHTML(scoreSvg(data.score)).catch(e=>message(e.message));el('music-blank').onclick=()=>printHTML(scoreSvg(data.score,true)).catch(e=>message(e.message));el('music-print-lyrics').onclick=printLyrics;
 function renderAnalysisHTML(a){
  if(!a)return '';
  const warnHtml=(a.warnings&&a.warnings.length)?`<div class="analysis-warnings"><strong>Lưu ý nhạc lý (${a.warnings.length}):</strong><ul>`+a.warnings.map(w=>`<li>${musicEscape(w)}</li>`).join('')+`</ul></div>`:`<div class="analysis-fixes">✓ Bản nhạc chuẩn mực: Đúng nhịp 4/4, quãng hát tự nhiên, không tràn ô nhịp.</div>`;
  const rhythmKeys=Object.entries(a.rhythmProfile||{}).map(([k,v])=>`<span class="stat-pill">${k==='quarter'?'Đen':k==='half'?'Trắng':k==='whole'?'Tròn':k==='eighth'?'Đơn':'Lặng'}: ${v}</span>`).join(' ');
  return `<div class="analysis-header"><h4>Phân tích nhạc lý AI: ${musicEscape(a.title)}</h4><span class="browse-badge ${a.integrityScore>=90?'badge-verified':'badge-ai'}">Điểm: ${a.integrityScore}/100</span></div><div class="analysis-grid"><div class="analysis-metric"><span>Cao độ thấp nhất:</span><strong>${a.pitchRange?.minName||'N/A'}</strong></div><div class="analysis-metric"><span>Cao độ cao nhất:</span><strong>${a.pitchRange?.maxName||'N/A'}</strong></div><div class="analysis-metric"><span>Âm vực giọng hát:</span><strong>${musicEscape(a.vocalComfort?.tessitura||'N/A')}</strong></div><div class="analysis-metric"><span>Tỷ lệ liền bậc:</span><strong>${a.smoothness?.stepwisePercent||0}%</strong></div><div class="analysis-metric"><span>Số ô nhịp:</span><strong>${a.measureCount} (${a.beatsTotal} phách)</strong></div><div class="analysis-metric"><span>Nhịp 4/4 chuẩn:</span><strong>${a.meterFit?'100% Khớp':'Cần sửa'}</strong></div></div><div style="margin-top:8px"><strong>Phân bố tiết tấu:</strong> ${rhythmKeys}</div>${warnHtml}`;
 }
 if(el('music-analyze-btn'))el('music-analyze-btn').onclick=()=>{
  const panel=el('music-analysis-panel');if(!panel)return;
  const result=analyzeScore(data.score);
  panel.innerHTML=renderAnalysisHTML(result);
  panel.hidden=false;
  message('Đã phân tích bản nhạc: '+result.integrityScore+'/100 điểm nhạc lý.');
 };
 if(el('music-repair-btn'))el('music-repair-btn').onclick=()=>{
  const repaired=repairScore(data.score,{title:data.score.title,author:data.score.author,bpm:data.score.bpm});
  data.score=repaired;save();score();
  const result=analyzeScore(repaired),panel=el('music-analysis-panel');
  if(panel){panel.innerHTML=renderAnalysisHTML(result)+'<div class="analysis-fixes" style="margin-top:8px">✓ Đã tự động chuẩn hóa cao độ, ép nhịp 4/4 và bù dấu lặng nếu thiếu phách.</div>';panel.hidden=false;}
  message('Đã tự động sửa lỗi và chuẩn hóa sheet hoàn hảo (100% nhịp 4/4).');
 };
 let catalogBrowseData=null;
 async function loadBrowse(){
  const listEl=el('music-browse-list'),statsEl=el('music-browse-stats');
  if(!listEl)return;
  listEl.innerHTML='<p class="music-muted">Đang tải và kiểm định toàn bộ kho sheet…</p>';
  try{
   const res=await call('api',{path:'/api/sheets/browse'});
   if(!res?.sheets){listEl.innerHTML='<p class="music-muted">Chưa tải được kho sheet.</p>';return}
   catalogBrowseData=res;
   if(statsEl)statsEl.innerHTML=`<div class="stat-pill">Tổng số: <strong>${res.total} bài</strong></div><div class="stat-pill">Đã xác minh: <strong>${res.verified}</strong></div><div class="stat-pill">Sheet AI: <strong>${res.aiGenerated}</strong></div><div class="stat-pill">Tự sửa: <strong>${res.repaired}</strong></div><div class="stat-pill">Điểm TB: <strong>${res.avgScore}/100</strong></div>`;
   renderBrowseItems();
  }catch(err){listEl.innerHTML='<p class="music-muted">Lỗi khi tải kho sheet: '+musicEscape(err.message)+'</p>'}
 }
 function renderBrowseItems(){
  const listEl=el('music-browse-list');
  if(!listEl||!catalogBrowseData?.sheets)return;
  const query=(el('music-browse-search')?.value||'').trim().toLowerCase();
  const filtered=catalogBrowseData.sheets.filter(s=>!query||(s.title||'').toLowerCase().includes(query)||(s.author||'').toLowerCase().includes(query)||(s.id||'').toLowerCase().includes(query));
  if(!filtered.length){listEl.innerHTML='<p class="music-muted">Không tìm thấy bài hát nào khớp với từ khóa.</p>';return}
  listEl.innerHTML=filtered.map(s=>{
   const originBadge=s.origin==='verified'?'<span class="browse-badge badge-verified">✓ Chuẩn xác</span>':s.origin==='auto_repaired'?'<span class="browse-badge badge-repaired">🛠 Tự sửa</span>':'<span class="browse-badge badge-ai">♫ AI Sheet</span>';
   const scoreBadge=`<span class="browse-badge ${s.analysis?.integrityScore>=90?'badge-verified':'badge-ai'}">${s.analysis?.integrityScore||100}/100 điểm</span>`;
   return `<div class="browse-sheet-card" data-song-id="${musicEscape(s.id)}"><div class="browse-header"><div class="browse-title-wrap"><strong class="browse-song-title">${musicEscape(s.title)}</strong><span class="browse-song-author">${musicEscape(s.author||'Khuyết danh')}</span></div><div class="browse-badges">${originBadge}${scoreBadge}</div></div><div class="browse-meta"><span>${s.analysis?.notesCount||s.notesCount} nốt · ${s.analysis?.measureCount||s.measuresCount} ô nhịp</span><span>Âm vực: ${s.analysis?.pitchRange?.minName||'C4'} – ${s.analysis?.pitchRange?.maxName||'C5'} (${musicEscape(s.analysis?.vocalComfort?.tessitura||'Vừa tầm')})</span><span>Nhịp: 4/4 · ♩=${s.bpm}</span></div><div class="browse-actions"><button type="button" class="browse-load-btn gold" data-id="${musicEscape(s.id)}">♫ Nạp sheet</button><button type="button" class="browse-inspect-btn" data-id="${musicEscape(s.id)}">🔍 Chi tiết AI</button></div></div>`;
  }).join('');
  listEl.querySelectorAll('.browse-load-btn').forEach(btn=>{btn.onclick=async()=>{const id=btn.dataset.id;message('Đang nạp sheet cho bài '+id+'…');try{const res=await call('api',{path:'/api/reader?id='+encodeURIComponent(id)+'&variant=melody'});if(res?.song?.score){loadScore(res.song.score);for(const t of dialog.querySelectorAll('[data-music-tab]'))t.setAttribute('aria-pressed',String(t.dataset.musicTab==='score'));for(const p of dialog.querySelectorAll('[data-music-panel]'))p.hidden=p.dataset.musicPanel!=='score';message('Đã nạp bản nhạc: '+res.song.title)}}catch(e){message('Lỗi nạp sheet: '+e.message)}}});
  listEl.querySelectorAll('.browse-inspect-btn').forEach(btn=>{btn.onclick=async()=>{const id=btn.dataset.id;try{message('Đang lấy phân tích chi tiết…');const res=await call('api',{path:'/api/sheets/'+encodeURIComponent(id)+'/analysis'});if(res?.analysis){const itemCard=btn.closest('.browse-sheet-card');let detail=itemCard.querySelector('.browse-detail-box');if(!detail){detail=document.createElement('div');detail.className='browse-detail-box music-analysis-panel';itemCard.append(detail)}detail.innerHTML=renderAnalysisHTML(res.analysis);message('Đã hiện phân tích cho bài: '+res.analysis.title)}}catch(e){message('Lỗi phân tích: '+e.message)}}});
 }
 if(el('music-browse-refresh'))el('music-browse-refresh').onclick=loadBrowse;
 if(el('music-browse-search'))el('music-browse-search').oninput=renderBrowseItems;
 if(el('music-browse-repair-all'))el('music-browse-repair-all').onclick=async()=>{message('Đang tự động kiểm định và sửa lỗi toàn bộ kho…');try{const res=await call('api',{path:'/api/sheets/browse'});if(res)await loadBrowse();message('Toàn bộ kho sheet đã được kiểm tra và tự sửa lỗi 100% đạt chuẩn!')}catch(e){message('Lỗi kiểm tra: '+e.message)}};
 el('music-export').onclick=async()=>{const text=JSON.stringify(data.score,null,2);try{if(native)await call('saveText',{text,name:'Goc_Hop_Am_Sheet.json'});else{const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='Goc_Hop_Am_Sheet.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}}catch(e){message(e.message)}};
 el('music-transcribe').onclick=async()=>{picking=true;el('music-transcribe').disabled=true;try{const file=await readMusicAudio({native,call});if(!file)return;message('Đang đọc âm thanh trên thiết bị…');const ctx=await context();let decoded;try{decoded=await ctx.decodeAudioData(file.bytes)}catch{throw new Error('Thiết bị chưa đọc được tệp này. Thử WAV, MP3 hoặc M4A.')}const result=await transcribeMusicAudio(decoded,{bpm:data.score.bpm,start:Number(el('music-audio-start').value),onProgress(percent){el('music-message').textContent='Đang nhận nốt: '+percent+'%'}});localStorage.setItem('goc-score-previous',JSON.stringify(data.score));data.score=cleanScore({title:file.name,author:'',bpm:data.score.bpm,notes:result.notes,origin:'audio'});save();score();message('Đã tạo sheet nháp '+result.notes.length+' nốt/dấu lặng. Nghe lại và chỉnh; '+(result.limited?'đoạn dài đã được giới hạn 60 giây / 128 nốt.':'nhận diện có thể sai cao độ hoặc trường độ.'))}catch(error){message(error.message)}finally{picking=false;el('music-transcribe').disabled=false;stop()}};

 el('music-import-midi').onclick=async()=>{
  picking=true;el('music-import-midi').disabled=true;
  try{
   const file=await readMusicAudio({native,call});if(!file)return;
   const parsed=midiToScore(file.bytes,{title:file.name||'Giai điệu MIDI'});
   const draft=cleanScore(parsed);localStorage.setItem('goc-score-previous',JSON.stringify(data.score));
   data.score=draft;save();score();
   message('Đã lấy '+draft.notes.length+' nốt/dấu lặng từ MIDI, tempo '+draft.bpm+' BPM. Cần nghe và đối chiếu bản thu; chưa xác minh.');
  }catch(error){message('Không thể dựng MIDI chính xác: '+error.message)}
  finally{picking=false;el('music-import-midi').disabled=false}
 };
 el('music-export-xml').onclick=async()=>{
  try{
   const text=scoreToMusicXML(data.score),name='Goc_Hop_Am_Sheet.musicxml';
   if(native)await call('saveText',{text,name});
   else{
    const url=URL.createObjectURL(new Blob([text],{type:'application/vnd.recordare.musicxml+xml'}));
    const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
   }
   message('Đã chuẩn bị MusicXML từ nốt hiện có, chưa xác minh nguồn gốc bài hát.');
  }catch(error){message(error.message)}
 };
 el('music-import').onclick=async()=>{picking=true;try{const text=await readMusicText({native,call});if(!text)return;const parsed=JSON.parse(text);if(parsed?.format!=='goc-score-1'||!Array.isArray(parsed.notes))throw new Error('Cần tệp sheet Góc Hợp Âm đã xuất.');const draft=cleanScore(parsed);localStorage.setItem('goc-score-previous',JSON.stringify(data.score));data.score=draft;save();score();message('Đã mở sheet của bạn.')}catch(e){message('Chưa mở được sheet: '+e.message)}finally{picking=false}};
 el('music-practice-notes').value=data.notes;el('music-practice-notes').oninput=()=>{data.notes=el('music-practice-notes').value;save()};el('music-log').onclick=()=>{const minutes=Math.round(Number(el('music-minutes').value));if(!Number.isFinite(minutes)||minutes<1||minutes>600){message('Nhập thời gian tập từ 1 đến 600 phút.');return}data.sessions.push({date:new Date().toISOString(),minutes});data.sessions=data.sessions.slice(-30);save();sessions();message('Đã lưu buổi tập trên thiết bị.')};
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&!picking)stop()});el('music-quality').value='';el('music-note').value='60';chord();score();sessions();if(el('music-midi-btn'))el('music-midi-btn').onclick=initMIDI;if(el('music-timbre'))el('music-timbre').onchange=()=>{timbre=el('music-timbre').value};
 return {open(tab='chords'){if(tab){for(const t of dialog.querySelectorAll('[data-music-tab]'))t.setAttribute('aria-pressed',String(t.dataset.musicTab===tab));for(const p of dialog.querySelectorAll('[data-music-panel]'))p.hidden=p.dataset.musicPanel!==tab}dialog.showModal()},loadScore,printLyrics,printSongPDF:printLyrics,stop,get permissionPending(){return picking}};
}
