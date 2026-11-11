import {transcribeMusicAudio,readMusicAudio} from './pitch.js?v=145';
import {readMusicText} from './follow.js';
import {transpose} from './logic.js?v=142';
import {sheetDurations,sheetMaxNotes,sheetHarmonyKinds,midiToSheet,musicXmlToSheet,chordAccompaniment} from './sheet-input.js';
import {sheetPdfFromSvg} from './score-pdf.js';
import {createSongSheet} from './song-sheet.js?v=145';
// Góc Hợp Âm music workspace. Project developer: NPT Duy.
const musicNames=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const musicQualities={'':[0,4,7],m:[0,3,7],'7':[0,4,7,10],maj7:[0,4,7,11],m7:[0,3,7,10],dim:[0,3,6],aug:[0,4,8],sus2:[0,2,7],sus4:[0,5,7],'6':[0,4,7,9],m6:[0,3,7,9],add9:[0,4,7,14]};
const musicEscape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
export function musicChord(root,quality=''){const r=musicNames.indexOf(root),q=musicQualities[quality];if(r<0||!q)return [];return q.map(n=>60+r+n)}
const musicOrigins = {
 'midi-import': 'Chuyển từ MIDI do bạn chọn',
 'musicxml-import': 'Chuyển từ MusicXML do bạn chọn',
 'audio-draft': 'Bản nháp nhận dạng âm thanh · Cần đối chiếu',
 'piano-draft': 'Bè đệm piano từ hợp âm · Nhịp đệm quy ước',
 'organ-draft': 'Bè đệm organ từ hợp âm · Nhịp đệm quy ước'
};
const musicSyllabic = ['single','begin','middle','end'];
const musicChordSymbol = /^[A-G][#b]?[a-zA-Z0-9+°øΔ-]*(?:\/[A-G][#b]?)?$/u;
export function cleanScore(value) {
 if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Tệp sheet không hợp lệ.');
 const input = Array.isArray(value.notes) ? value.notes : [];
 if (input.length > sheetMaxNotes) throw new Error('Bản phổ vượt quá 1.024 nốt và dấu lặng.');
 const notes = [];
 let beat = 0;
 for (const [index, n] of input.entries()) {
  if (!n || !sheetDurations.includes(n.beats) || !(n.midi === null || Number.isInteger(n.midi) && n.midi >= 48 && n.midi <= 84)) throw new Error('Nốt trong sheet không hợp lệ.');
  if (beat % 4 + n.beats > 4) throw new Error('Nốt vượt quá ô nhịp 4/4.');
  const note = {midi: n.midi, beats: n.beats};
  if (n.midi !== null && n.tie === true && input[index + 1]?.midi === n.midi) note.tie = true;
  if (typeof n.chord === 'string' && n.chord.length <= 24 && musicChordSymbol.test(n.chord)) note.chord = n.chord;
  if (typeof n.lyric === 'string' && n.lyric) {
   note.lyric = n.lyric.slice(0,120);
   if (musicSyllabic.includes(n.syllabic)) note.syllabic = n.syllabic;
  }
  notes.push(note);
  beat += n.beats;
 }
 const score = {format:'goc-score-1',title:String(value.title || 'Giai điệu của tôi').slice(0,100),author:String(value.author || '').slice(0,100),bpm:Math.max(40,Math.min(240,Number(value.bpm) || 80)),notes};
 if (typeof value.origin === 'string' && Object.hasOwn(musicOrigins, value.origin)) score.origin = value.origin;
 return score;
}

const musicXmlText = value => musicEscape(value.replace(/[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu,''));
const musicNoteType = {0.25:'16th',0.5:'eighth',0.75:'eighth',1:'quarter',1.5:'quarter',2:'half',3:'half',4:'whole'};
const musicDotted = [0.75,1.5,3];
function musicHarmonyXml(symbol) {
 if (!symbol) return '';
 const [,root,alter,quality,bass,bassAlter] = /^([A-G])([#b]?)([^/]*)(?:\/([A-G])([#b]?))?$/.exec(symbol);
 const alteration = (prefix, accidental) => accidental ? '<'+prefix+'-alter>'+(accidental === '#' ? 1 : -1)+'</'+prefix+'-alter>' : '';
 const kind = Object.hasOwn(sheetHarmonyKinds, quality) ? sheetHarmonyKinds[quality] : 'other';
 return '<harmony><root><root-step>'+root+'</root-step>'+alteration('root',alter)+'</root><kind text="'+musicXmlText(quality)+'">'+kind+'</kind>'+
  (bass ? '<bass><bass-step>'+bass+'</bass-step>'+alteration('bass',bassAlter)+'</bass>' : '')+
  (quality === 'add9' ? '<degree><degree-value>9</degree-value><degree-alter>0</degree-alter><degree-type>add</degree-type></degree>' : '')+'</harmony>';
}

export function scoreMusicXml(value) {
 const score = cleanScore(value);
 if (!score.notes.length) throw new Error('Thêm nốt vào sheet trước khi xuất.');
 const divisions = score.notes.some(n => !Number.isInteger(n.beats*2)) ? 4 : 2;
 const bars = [];
 let events = [], beats = 0;
 for (const [index, note] of score.notes.entries()) {
  const pitchName = note.midi === null ? null : musicNames[note.midi%12];
  const pitch = pitchName === null ? '<rest/>' : '<pitch><step>'+pitchName[0]+'</step>'+(pitchName.length === 2 ? '<alter>1</alter>' : '')+'<octave>'+(Math.floor(note.midi/12)-1)+'</octave></pitch>';
  const ties = [score.notes[index-1]?.tie && 'stop', note.tie && 'start'].filter(Boolean);
  const lyric = note.lyric ? '<lyric>'+(note.syllabic ? '<syllabic>'+note.syllabic+'</syllabic>' : '')+'<text>'+musicXmlText(note.lyric)+'</text></lyric>' : '';
  events.push(musicHarmonyXml(note.chord)+'<note>'+pitch+'<duration>'+(note.beats*divisions)+'</duration>'+
   ties.map(type => '<tie type="'+type+'"/>').join('')+'<type>'+musicNoteType[note.beats]+'</type>'+(musicDotted.includes(note.beats) ? '<dot/>' : '')+
   (ties.length ? '<notations>'+ties.map(type => '<tied type="'+type+'"/>').join('')+'</notations>' : '')+lyric+'</note>');
  beats += note.beats;
  if (beats === 4) { bars.push({events,beats}); events = []; beats = 0; }
 }
 if (events.length) bars.push({events,beats});
 const setup = '<attributes><divisions>'+divisions+'</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes><direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>'+score.bpm+'</per-minute></metronome></direction-type><sound tempo="'+score.bpm+'"/></direction>';
 const creator = score.author ? '<creator type="composer">'+musicXmlText(score.author)+'</creator>' : '';
 const provenance = score.origin ? '<miscellaneous><miscellaneous-field name="source-status">'+musicXmlText(musicOrigins[score.origin])+'</miscellaneous-field><miscellaneous-field name="goc-sheet-origin">'+score.origin+'</miscellaneous-field></miscellaneous>' : '';
 const measures = bars.map((bar,i) => '<measure number="'+(i+1)+'"'+(bar.beats===4 ? '' : ' implicit="yes"')+'>'+(i===0 ? setup : '')+bar.events.join('')+'</measure>').join('\n');
 return '<?xml version="1.0" encoding="UTF-8"?>\n<score-partwise version="4.0"><work><work-title>'+musicXmlText(score.title)+'</work-title></work><identification>'+creator+'<encoding><software>Góc Hợp Âm · NPT Duy</software></encoding>'+provenance+'</identification><part-list><score-part id="P1"><part-name>'+(score.origin?.endsWith('-draft') && score.origin !== 'audio-draft' ? 'Bè đệm' : 'Giai điệu')+'</part-name></score-part></part-list><part id="P1">\n'+measures+'\n</part></score-partwise>\n';
}

const musicBarsPerRow = score => score.notes.some(note => note.beats < .5 || note.beats === .75) ? 2 : 4;
function musicSvg(score, {blank=false, firstBar=1, page='', tieIn=false, barsPerRow=musicBarsPerRow(score)}={}) {
 const total = score.notes.reduce((s,n) => s+n.beats,0);
 const rowBeats = barsPerRow*4, barWidth = 668/barsPerRow;
 const systems = blank ? 6 : Math.max(1,Math.ceil(total/rowBeats));
 const height = 150+systems*147, title = blank ? 'Giấy kẻ nhạc' : score.title;
 const label = blank ? 'Góc Hợp Âm · NPT Duy' : musicOrigins[score.origin] || 'Bản soạn tại Góc Hợp Âm · NPT Duy';
 let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="'+height+'" viewBox="0 0 800 '+height+'" role="img" aria-label="Sheet '+musicXmlText(title)+'"><rect width="800" height="'+height+'" fill="white"/><g fill="#19151d" font-family="Noto Sans, DejaVu Sans, sans-serif"><text x="48" y="31" fill="#a43b15" font-size="12" font-weight="700">GÓC HỢP ÂM  /  STUDIO BẢN PHỔ</text><text x="48" y="65" font-size="'+Math.min(25,1320/Math.max(1,title.length)).toFixed(1)+'" font-weight="700">'+musicXmlText(title)+'</text><text x="752" y="87" text-anchor="end" font-size="13">'+musicXmlText(score.author)+'</text><text x="48" y="88" font-size="13">4/4 · '+score.bpm+' BPM</text><path d="M48 98H752" stroke="#dccec4"/>';
 for (let row=0;row<systems;row++) {
  const top = 131+row*147;
  for (let line=0;line<5;line++) svg += '<path d="M48 '+(top+line*10)+'H752" stroke="#393039"/>';
  svg += '<g transform="translate(48 '+(top-6)+')"><path d="M15 52 C23 56 23 43 22 35 L16 8 C13 -4 22 -10 23 -1 C25 8 14 17 8 23 C-4 36 8 49 20 45 C32 42 31 24 21 24 C11 23 8 33 14 38" fill="none" stroke="#19151d" stroke-width="2.4" stroke-linecap="round"/><circle cx="13" cy="52" r="3" fill="#19151d"/></g>';
  for (let bar=0;bar<=barsPerRow;bar++) svg += '<path d="M'+(84+bar*barWidth)+' '+top+'v40" stroke="#393039"/>';
  svg += '<text x="48" y="'+(top-13)+'" font-size="10" fill="#68574d">'+(firstBar+row*barsPerRow)+'</text>';
 }
 const point = beat => {
  const row = Math.floor(beat/rowBeats), bar = Math.floor(beat%rowBeats/4);
  return {row,x:108+bar*barWidth+(beat%4)*(barWidth-27)/4,top:131+row*147};
 };
 const tie = (x,y,end) => '<path d="M'+x+' '+y+' Q'+((x+end)/2)+' '+(y+11)+' '+end+' '+y+'" fill="none" stroke="#19151d" stroke-width="1.2"/>';
 let beat = 0, accidentals = new Map();
 for (const [index,n] of (blank ? [] : score.notes).entries()) {
  const {row,x,top} = point(beat);
  if (beat%4 === 0) accidentals = new Map();
  if (n.chord) svg += '<text x="'+x+'" y="'+(top-13)+'" font-size="14" fill="#a43b15" font-weight="700">'+musicXmlText(n.chord)+'</text>';
  if (n.midi === null) {
   if (n.beats >= 2) svg += '<rect x="'+(x-6)+'" y="'+(top+(n.beats === 4 ? 20 : 15))+'" width="12" height="5"/>';
   else if (n.beats >= 1) svg += '<path transform="translate('+x+' '+top+')" d="M-3 5l7 9 -6 8 5 6q-7 0 -3 7" fill="none" stroke="#19151d" stroke-width="2.4"/>';
   else {
    svg += '<path d="M'+(x+4)+' '+(top+13)+'l-8 22" stroke="#19151d" stroke-width="1.5"/><circle cx="'+(x-4)+'" cy="'+(top+15)+'" r="3"/><path d="M'+(x-4)+' '+(top+17)+'q4 2 8 -4" fill="none" stroke="#19151d"/>';
    if (n.beats === .25) svg += '<circle cx="'+(x-7)+'" cy="'+(top+24)+'" r="3"/><path d="M'+(x-7)+' '+(top+26)+'q4 2 8 -4" fill="none" stroke="#19151d"/>';
   }
   if (musicDotted.includes(n.beats)) svg += '<circle cx="'+(x+11)+'" cy="'+(top+17)+'" r="1.8"/>';
  } else {
   const pitch = n.midi%12, step = [0,0,1,1,2,3,3,4,4,5,5,6][pitch]+Math.floor((n.midi-60)/12)*7, y = top+50-step*5;
   for (let ledger=top+50;y>=ledger;ledger+=10) svg += '<path d="M'+(x-10)+' '+ledger+'h20" stroke="#333"/>';
   for (let ledger=top-10;y<=ledger;ledger-=10) svg += '<path d="M'+(x-10)+' '+ledger+'h20" stroke="#333"/>';
   const sharp = [1,3,6,8,10].includes(pitch);
   if ((accidentals.get(step) || false) !== sharp) svg += '<text x="'+(x-15)+'" y="'+(y+5)+'" font-size="17">'+(sharp ? '♯' : '♮')+'</text>';
   accidentals.set(step,sharp);
   svg += '<ellipse cx="'+x+'" cy="'+y+'" rx="6.6" ry="4.4" transform="rotate(-18 '+x+' '+y+')" fill="'+(n.beats>=2 ? 'white' : '#19151d')+'" stroke="#19151d" stroke-width="1.5"/>';
   if (n.beats<4) {
    const down = y<top+20, stemx=x+(down?-6:6), end=y+(down?28:-28);
    svg += '<path d="M'+stemx+' '+y+'V'+end+'" stroke="#19151d" stroke-width="1.4"/>';
    if (n.beats<1) svg += '<path d="M'+stemx+' '+end+'q'+(down?-10:10)+' 7 '+(down?-4:4)+' 16" fill="none" stroke="#19151d" stroke-width="1.7"/>';
    if (n.beats===.25) svg += '<path d="M'+stemx+' '+(end+(down?-6:6))+'q'+(down?-10:10)+' 7 '+(down?-4:4)+' 16" fill="none" stroke="#19151d" stroke-width="1.7"/>';
   }
   if (musicDotted.includes(n.beats)) svg += '<circle cx="'+(x+11)+'" cy="'+(y-2)+'" r="1.8"/>';
   if (n.tie) {
    const next = point(beat+n.beats);
    svg += tie(x+3,y+7,next.row===row ? next.x-3 : 750);
   }
   if ((!index && tieIn) || (score.notes[index-1]?.tie && beat%rowBeats===0)) svg += tie(89,y+7,x-3);
  }
  if (n.lyric) svg += '<text x="'+x+'" y="'+(top+102)+'" font-size="11" text-anchor="middle">'+musicXmlText(n.lyric)+(n.syllabic==='begin'||n.syllabic==='middle'?' −':'')+'</text>';
  beat += n.beats;
 }
 return svg+'<path d="M48 '+(height-48)+'H752" stroke="#dccec4"/><text x="48" y="'+(height-26)+'" font-size="11" fill="#615149">'+musicXmlText(label)+'</text><text x="752" y="'+(height-26)+'" text-anchor="end" font-size="11">'+page+'</text></g></svg>';
}
export function scoreSvg(value, blank=false) {
 return musicSvg(cleanScore(value),{blank});
}
export function scorePages(value) {
 const score = cleanScore(value), pages = [[]];
 const barsPerRow = musicBarsPerRow(score), barsPerPage = 6*barsPerRow;
 let beat = 0;
 for (const note of score.notes) {
  if (beat && beat % (barsPerPage*4) === 0) pages.push([]);
  pages.at(-1).push(note);
  beat += note.beats;
 }
 return pages.map((notes,index) => musicSvg({...score,notes},{firstBar:1+barsPerPage*index,barsPerRow,page:(index+1)+' / '+pages.length,tieIn:pages[index-1]?.at(-1)?.tie}));
}
const musicStudioActions = [
 ['music-find-pdf','Tìm bản phổ PDF','Tìm theo bài đang mở'],
 ['music-local-pdf','Mở PDF trên máy','Đọc bản phổ trong tệp của bạn'],
 ['music-import-midi','MIDI → bản phổ','Đọc nốt và nhịp từ tệp'],
 ['music-import-xml','MusicXML → bản phổ','Mở và chỉnh nốt có sẵn'],
 ['music-transcribe','Audio → nháp giai điệu','Nhận nốt ngay trên máy'],
 ['music-make-piano','Tạo bè đệm piano','Rải nốt từ hợp âm bài đang mở'],
 ['music-make-organ','Tạo bè đệm organ','Âm trầm và nốt đỡ từ hợp âm']
];
function musicStudioPanel() {
 return '<div class="music-studio-banner"><span class="music-kicker">STUDIO GÓC HỢP ÂM</span><h3>Từ nguồn nhạc đến bản phổ</h3><p id="music-source-song">Chọn một nguồn để bắt đầu.</p></div>'+
  '<div class="music-studio-grid" aria-label="Công cụ tạo và tìm bản phổ">'+musicStudioActions.map(([id,title,description])=>
   '<button type="button" id="'+id+'"><strong>'+title+'</strong><small>'+description+'</small></button>').join('')+'</div>'+
  '<p class="music-muted">Nhập một bè C3–C6, nhịp 4/4. Audio hát hoặc đàn riêng dưới 3 MB, tối đa 60 giây theo BPM đã chọn. Bè đệm dùng một ô nhịp cho mỗi hợp âm.</p>'+
  '<div class="music-fields music-studio-controls"><label>Audio bắt đầu từ giây<input id="music-audio-start" type="number" min="0" max="3600" value="0"></label>'+
  '<label>Bản phổ trên máy<select id="music-saved-sheets"></select></label><button id="music-open-saved">Mở bản đã lưu</button></div>'+
  '<p id="music-job-status" role="status" aria-live="polite"></p><div id="music-local-view"></div><h3>Chỉnh, nghe và xuất bản phổ</h3>';
}
export function createMusicTools({native=false,call=async()=>true,toast=()=>{},getSong=()=>null,getShift=()=>0,onFindPdf=()=>{}}={}){
 let data={score:{format:'goc-score-1',title:'Giai điệu của tôi',author:'',bpm:80,notes:[]},notes:'',sessions:[],savedSheets:[],activeSheet:''};
 try{const v=JSON.parse(localStorage.getItem('goc-music-workspace-v1')||'null');if(v){data={...data,score:cleanScore(v.score),notes:String(v.notes||'').slice(0,15000),sessions:Array.isArray(v.sessions)?v.sessions.filter(s=>s&&Number.isFinite(s.minutes)&&s.minutes>0&&typeof s.date==='string').slice(-30):[]};
  for(const entry of Array.isArray(v.savedSheets)?v.savedSheets:[]){
   try{if(typeof entry?.id==='string' && !data.savedSheets.some(item=>item.id===entry.id))data.savedSheets.push({id:entry.id,score:cleanScore(entry.score)})}catch{}
  }
  if(data.savedSheets.some(entry=>entry.id===v.activeSheet))data.activeSheet=v.activeSheet;
 }}catch{}
 const dialog=document.createElement('dialog');dialog.id='music-tools';dialog.className='music-tools';dialog.setAttribute('aria-labelledby','music-title');
 dialog.innerHTML=`<div class="music-head"><div><span class="music-kicker">GÓC HỢP ÂM · NPT DUY</span><h2 id="music-title">Studio bản phổ</h2></div><button data-music-close aria-label="Đóng công cụ">×</button></div><nav class="music-tabs" aria-label="Công cụ âm nhạc"><button data-music-tab="chords" aria-pressed="true">Hợp âm</button><button data-music-tab="score" aria-pressed="false">Sheet nhạc</button><button data-music-tab="practice" aria-pressed="false">Buổi tập</button></nav><section data-music-panel="chords"><p class="music-muted">12 giọng · 12 loại hợp âm · phát bằng âm tổng hợp trên thiết bị.</p><div class="music-fields"><label>Âm gốc<select id="music-root">${musicNames.map(n=>`<option>${n}</option>`).join('')}</select></label><label>Loại hợp âm<select id="music-quality">${Object.keys(musicQualities).map(q=>`<option value="${q}">${q||'Trưởng'}${q==='m'?' · thứ':''}</option>`).join('')}</select></label></div><div class="music-chord"><strong id="music-chord-name">C</strong><p id="music-tones"></p><div id="music-piano" aria-label="Các nốt của hợp âm"></div><button id="music-play-chord">▶ Nghe hợp âm</button></div><h3>Gam & vòng hòa âm</h3><p id="music-scale"></p><p id="music-progression"></p><button id="music-play-progression">▶ Nghe vòng I – vi – IV – V</button><p class="music-muted">Ký hiệu phím thăng (#); các nốt đồng âm có thể được viết khác trong bản nhạc.</p></section><section data-music-panel="score" hidden>${musicStudioPanel()}<div class="music-fields"><label>Tên bản soạn<input id="music-score-title" maxlength="100"></label><label>Người soạn<input id="music-score-author" maxlength="100" placeholder="Tên của bạn"></label></div><div class="music-fields"><label>Nốt<select id="music-note">${Array.from({length:37},(_,i)=>`<option value="${48+i}">${musicNames[i%12]}${3+Math.floor(i/12)}</option>`).join('')}<option value="rest">Dấu lặng</option></select></label><label>Trường độ<select id="music-duration"><option value="1">Nốt đen · 1 phách</option><option value="0.25">Móc kép · ¼ phách</option><option value="0.5">Móc đơn · ½ phách</option><option value="0.75">Móc đơn chấm · ¾ phách</option><option value="1.5">Nốt đen chấm · 1½ phách</option><option value="2">Nốt trắng · 2 phách</option><option value="3">Nốt trắng chấm · 3 phách</option><option value="4">Nốt tròn · 4 phách</option></select></label><label>BPM<input id="music-score-bpm" type="number" min="40" max="240" value="80"></label></div><div class="music-keyboard-wrap"><div id="music-keyboard" class="music-keyboard" aria-label="Đàn piano hai quãng tám"></div></div><p id="music-current-note" class="music-muted" aria-live="polite">Chạm phím để chơi · Khi phát sheet, phím sáng theo từng nốt.</p><div class="music-actions"><button id="music-add-note">＋ Thêm nốt</button><button id="music-undo">↶ Bỏ nốt cuối</button><button id="music-play-score">▶ Nghe sheet</button><button id="music-stop">■ Dừng</button></div><div class="music-fields"><label>Nốt cần chỉnh<select id="music-edit-index" aria-label="Chọn nốt cần chỉnh"></select></label><button id="music-edit-note">Sửa bằng nốt &amp; trường độ đã chọn</button></div><p id="music-score-info" role="status"></p><div id="music-score-preview" class="music-score-preview"></div><div class="music-actions"><button id="music-print-score">In / lưu PDF</button>${native?'':'<button id="music-download-pdf">Tải PDF</button>'}<button id="music-save-score">Lưu bản này</button><button id="music-blank">Giấy kẻ nhạc</button><button id="music-export">↓ Sao lưu sheet JSON</button>${native?'<button id="music-export-xml">Xuất MusicXML</button>':'<a class="music-download" id="music-export-xml" href="#" download="Goc_Hop_Am_Sheet.musicxml">Xuất MusicXML</a>'}<button id="music-import">↑ Mở sheet JSON</button><button id="music-print-lyrics">In lời & hợp âm đang mở</button></div><div class="music-actions"><button id="music-library">Mở kho bản phổ ↗</button></div><p class="music-muted">Bản nhập và bản nháp ở trên thiết bị này. Xuất PDF, MusicXML hoặc JSON để giữ bản riêng.</p></section><section data-music-panel="practice" hidden><h3>Nhật ký luyện tập</h3><label>Mục tiêu, vòng hợp âm, ghi chú<textarea id="music-practice-notes" rows="6" maxlength="15000" placeholder="Hôm nay tập chuyển Am – F – C – G…"></textarea></label><div class="music-fields"><label>Số phút đã tập<input id="music-minutes" type="number" min="1" max="600" value="15"></label><button id="music-log">Lưu buổi tập</button></div><div id="music-session-list"></div><p class="music-muted">Bản soạn và ghi chú tự lưu trên thiết bị này. Xuất JSON để giữ bản soạn khi đổi máy. Không tự đăng lên mạng.</p></section><p id="music-message" role="status" aria-live="polite"></p><p class="music-byline">Dự án do NPT Duy phát triển.</p>`;
 document.body.append(dialog);const el=id=>dialog.querySelector('#'+id);let audio,timers=[],picking=false;
 const localSheet=createSongSheet({host:el('music-local-view')});
 dialog.addEventListener('close',()=>localSheet.setSong());
 function message(text){
  const inScore=dialog.querySelector('[data-music-tab="score"]').getAttribute('aria-pressed')==='true';
  el('music-message').textContent=inScore?'':text;
  el('music-job-status').textContent=inScore?text:'';
  toast(text);
 }
 function save(){
  const current=data.savedSheets.find(entry=>entry.id===data.activeSheet);
  if(current)current.score=data.score;
  try{localStorage.setItem('goc-music-workspace-v1',JSON.stringify(data));return true}
  catch{message('Chưa lưu được trên thiết bị. Hãy xuất JSON để giữ bản soạn.');return false}
 }
 function rememberScore(){
  if(!data.score.notes.length||data.activeSheet)return;
  data.activeSheet=globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2);
  data.savedSheets.push({id:data.activeSheet,score:data.score});
 }
 function useDraft(value,text){
  const draft=cleanScore(value);
  rememberScore();
  data.activeSheet='';
  data.score=draft;
  rememberScore();
  if(save())message(text+' Đã lưu trên thiết bị.');
  score();
 }
 function sheetPicker(){
  const picker=el('music-saved-sheets');
  picker.replaceChildren();
  for(const entry of [...data.savedSheets].reverse()){
   const option=document.createElement('option');
   option.value=entry.id;
   option.textContent=entry.score.title;
   picker.append(option);
  }
  if(data.activeSheet)picker.value=data.activeSheet;
  picker.disabled=!picker.options.length;
  el('music-open-saved').disabled=picker.disabled;
 }
 async function loadDraft(task){
  if(picking)return;
  picking=true;
  for(const id of ['music-transcribe','music-import-midi','music-import-xml','music-import','music-local-pdf'])el(id).disabled=true;
  try{await task()}catch(error){message(error.message)}
  finally{
   picking=false;
   for(const id of ['music-transcribe','music-import-midi','music-import-xml','music-import','music-local-pdf'])el(id).disabled=false;
  }
 }
 function stop(){for(const timer of timers)clearTimeout(timer);timers=[];if(audio){audio.close().catch(()=>{});audio=null}dialog.querySelectorAll('.music-key.active').forEach(k=>k.classList.remove('active'))}
 async function context(){stop();audio=new (window.AudioContext||window.webkitAudioContext)();await audio.resume();return audio}
 function sound(ctx,midi,start,length=.7,timbre='triangle'){if(midi===null)return;const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=timbre;osc.frequency.value=440*2**((midi-69)/12);gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.12,start+.02);gain.gain.exponentialRampToValueAtTime(.001,start+Math.max(.05,length));osc.connect(gain).connect(ctx.destination);osc.start(start);osc.stop(start+length+.03)}
 function lightNote(midi){for(const key of dialog.querySelectorAll('.music-key'))key.classList.toggle('active',Number(key.dataset.midi)===midi);el('music-current-note').textContent=midi===null?'Dấu lặng':musicNames[midi%12]+(Math.floor(midi/12)-1)}
 let white=0;for(let midi=60;midi<=84;midi++){const pitch=midi%12,black=[1,3,6,8,10].includes(pitch),key=document.createElement('button');key.className='music-key '+(black?'is-black':'is-white');key.dataset.midi=midi;key.style.left=((black?white-.32:white)/15*100)+'%';key.style.width=((black?.64:1)/15*100)+'%';key.textContent=musicNames[pitch];key.setAttribute('aria-label',musicNames[pitch]+(Math.floor(midi/12)-1));if(!black)white++;key.onpointerdown=async event=>{event.preventDefault();try{if(!audio)await context();await audio.resume();sound(audio,midi,audio.currentTime,.65);lightNote(midi);el('music-note').value=String(midi)}catch{message('Chưa phát được tiếng đàn.')}};el('music-keyboard').append(key)}
 el('music-library').onclick=()=>{if(native)call('scoreLibrary').catch(error=>message(error.message));else window.open('/ban-pho/','_blank','noopener')};
 function finish(ctx,seconds){timers.push(setTimeout(()=>{if(audio===ctx)stop()},(seconds+.3)*1000))}
 function chord(){const root=el('music-root').value,q=el('music-quality').value,notes=musicChord(root,q),classes=new Set(notes.map(n=>n%12));el('music-chord-name').textContent=root+q;el('music-tones').textContent=notes.map(n=>musicNames[n%12]).join(' · ');el('music-piano').innerHTML=musicNames.map((n,i)=>`<span class="${n.includes('#')?'black':'white'} ${classes.has(i)?'on':''}">${n}</span>`).join('');const r=musicNames.indexOf(root);el('music-scale').textContent='Gam trưởng: '+[0,2,4,5,7,9,11].map(n=>musicNames[(r+n)%12]).join(' – ');el('music-progression').textContent=[root,musicNames[(r+9)%12]+'m',musicNames[(r+5)%12],musicNames[(r+7)%12]].join(' → ')}
 function score(){
  const v=data.score;
  el('music-score-title').value=v.title;
  el('music-score-author').value=v.author;
  el('music-score-bpm').value=v.bpm;
  el('music-score-preview').innerHTML=scorePages(v).join('');
  const beats=v.notes.reduce((sum,note)=>sum+note.beats,0);
  el('music-score-info').textContent=(v.origin?musicOrigins[v.origin]+' · ':'')+v.notes.length+' nốt/dấu lặng · '+Math.ceil(beats/4)+' ô nhịp';
  el('music-undo').disabled=el('music-edit-note').disabled=!v.notes.length;
  el('music-edit-index').innerHTML=v.notes.map((n,i)=>'<option value="'+i+'">'+(i+1)+'. '+(n.midi===null?'Lặng':musicNames[n.midi%12]+(Math.floor(n.midi/12)-1))+' · '+n.beats+' phách</option>').join('');
  sheetPicker();
 }
 async function printHTML(body){const html='<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'"><title>Góc Hợp Âm · Sheet</title><style>@page{size:A4;margin:12mm}body{font:16px/1.7 Georgia,serif;color:#19151d}svg{display:block;width:100%;height:auto;break-inside:avoid;page-break-inside:avoid}svg+svg{break-before:page;page-break-before:always}pre{white-space:pre-wrap;font:inherit}small{font-family:sans-serif}h1{font-size:25px}</style></head><body>'+body+'</body></html>';
  if(native){await call('printSheet',{html});return}const frame=document.createElement('iframe');frame.style.cssText='position:fixed;width:1px;height:1px;bottom:0;left:0;border:0';frame.srcdoc=html;frame.onload=()=>{frame.contentWindow.focus();frame.contentWindow.print();setTimeout(()=>frame.remove(),60000)};document.body.append(frame);
 }
 async function printLyrics(){const song=getSong();if(!song?.content){message('Mở bài hát trước rồi chọn in lời & hợp âm.');return}try{await printHTML('<h1>'+musicEscape(song.title)+'</h1><p>'+musicEscape(song.author||'')+'</p><pre>'+musicEscape(song.content)+'</pre><small>Góc Hợp Âm · NPT Duy</small>')}catch(error){message(error.message)}}
 function sessions(){el('music-session-list').replaceChildren();for(const session of [...data.sessions].reverse()){const p=document.createElement('p');p.textContent=new Date(session.date).toLocaleDateString('vi-VN')+' · '+session.minutes+' phút';el('music-session-list').append(p)}}
 dialog.querySelector('[data-music-close]').onclick=()=>dialog.close();dialog.addEventListener('close',stop);dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});for(const b of dialog.querySelectorAll('[data-music-tab]'))b.onclick=()=>{for(const tab of dialog.querySelectorAll('[data-music-tab]'))tab.setAttribute('aria-pressed',String(tab===b));for(const p of dialog.querySelectorAll('[data-music-panel]'))p.hidden=p.dataset.musicPanel!==b.dataset.musicTab;stop()};
 el('music-root').onchange=chord;el('music-quality').onchange=chord;
 el('music-play-chord').onclick=async()=>{try{const ctx=await context();musicChord(el('music-root').value,el('music-quality').value).forEach((n,i)=>sound(ctx,n,ctx.currentTime+i*.035));finish(ctx,1)}catch{message('Chưa phát được âm thanh. Kiểm tra âm lượng thiết bị.')}};
 el('music-play-progression').onclick=async()=>{try{const ctx=await context(),r=musicNames.indexOf(el('music-root').value);[0,9,5,7].forEach((n,i)=>musicChord(musicNames[(r+n)%12],i===1?'m':'').forEach(note=>sound(ctx,note,ctx.currentTime+i*1.1,.9)));finish(ctx,4.5)}catch{message('Chưa phát được vòng hòa âm.')}};
 for(const id of ['music-score-title','music-score-author','music-score-bpm'])el(id).onchange=()=>{data.score=cleanScore({...data.score,title:el('music-score-title').value,author:el('music-score-author').value,bpm:Number(el('music-score-bpm').value)});save();score()};
 el('music-add-note').onclick=()=>{try{if(data.score.notes.length>=sheetMaxNotes)throw new Error('Bản soạn đã đủ 1.024 nốt.');const value=el('music-note').value,n={midi:value==='rest'?null:Number(value),beats:Number(el('music-duration').value)};data.score=cleanScore({...data.score,notes:[...data.score.notes,n]});save();score();el('music-message').textContent=''}catch(error){message(error.message)}};
 el('music-edit-index').onchange=()=>{const n=data.score.notes[Number(el('music-edit-index').value)];if(n){el('music-note').value=n.midi===null?'rest':String(n.midi);el('music-duration').value=String(n.beats)}};
 el('music-edit-note').onclick=()=>{try{const i=Number(el('music-edit-index').value),notes=data.score.notes.map(n=>({...n})),value=el('music-note').value;if(!notes[i])return;notes[i]={...notes[i],midi:value==='rest'?null:Number(value),beats:Number(el('music-duration').value)};data.score=cleanScore({...data.score,notes});save();score();message('Đã chỉnh nốt '+(i+1)+'.')}catch(e){message(e.message)}};
 el('music-undo').onclick=()=>{data.score=cleanScore({...data.score,notes:data.score.notes.slice(0,-1)});save();score()};el('music-stop').onclick=stop;
 el('music-play-score').onclick=async()=>{
  if(!data.score.notes.length){message('Thêm nốt vào sheet trước.');return}
  try{
   const ctx=await context(),base=ctx.currentTime+.08,score=data.score;
   let time=0;
   for(let i=0;i<score.notes.length;i++){
    const note=score.notes[i];
    let beats=note.beats;
    while(score.notes[i].tie){beats+=score.notes[++i].beats}
    const length=beats*60/score.bpm;
    sound(ctx,note.midi,base+time,length*.92,score.origin==='organ-draft'?'sine':'triangle');
    timers.push(setTimeout(()=>lightNote(note.midi),(time+.08)*1000));
    time+=length;
   }
   finish(ctx,time+.08);
  }catch{message('Chưa phát được sheet.')}
 };
 el('music-print-score').onclick=()=>printHTML(scorePages(data.score).join('')).catch(e=>message(e.message));
 el('music-blank').onclick=()=>printHTML(scoreSvg(data.score,true)).catch(e=>message(e.message));
 el('music-print-lyrics').onclick=printLyrics;
 function downloadScore(bytes,name,type){
  const url=URL.createObjectURL(new Blob([bytes],{type}));
  const link=document.createElement('a');
  link.href=url;link.download=name;
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
 }
 async function exportScore(text,name,type){
  if(native){await call('saveText',{text,name});return}
  downloadScore(text,name,type);
 }
 if(!native)el('music-download-pdf').onclick=async()=>{
  if(!data.score.notes.length){message('Thêm nốt vào sheet trước khi tải PDF.');return}
  const button=el('music-download-pdf');
  button.disabled=true;
  try{
   message('Đang kết xuất PDF trên thiết bị…');
   const pages=scorePages(data.score);
   const pdf=await sheetPdfFromSvg(pages,data.score);
   downloadScore(pdf,'Goc_Hop_Am_Ban_Pho.pdf','application/pdf');
   message('PDF A4 '+pages.length+' trang đã sẵn sàng.');
  }catch(error){message(error.message||'Chưa xuất được PDF. Hãy thử In / lưu PDF.')}
  finally{button.disabled=false}
 };
 el('music-save-score').onclick=()=>{
  if(!data.score.notes.length){message('Thêm nốt trước khi lưu.');return}
  rememberScore();
  if(save())message('Đã lưu bản phổ trên thiết bị.');
  sheetPicker();
 };
 el('music-open-saved').onclick=()=>{
  const entry=data.savedSheets.find(item=>item.id===el('music-saved-sheets').value);
  if(!entry)return;
  rememberScore();
  stop();
  data.score=cleanScore(entry.score);
  data.activeSheet=entry.id;
  if(save())message('Đã mở bản phổ trên thiết bị.');
  score();
 };
 el('music-export').onclick=()=>exportScore(JSON.stringify(data.score,null,2),'Goc_Hop_Am_Sheet.json','application/json').catch(e=>message(e.message));
 const xmlExport=el('music-export-xml');
 xmlExport.onclick=event=>{
  const name='Goc_Hop_Am_Sheet.musicxml',type='application/vnd.recordare.musicxml+xml';
  try{
   const text=scoreMusicXml(data.score);
   if(native){exportScore(text,name,type).catch(e=>message(e.message));return;}
   if(xmlExport.href.startsWith('blob:'))URL.revokeObjectURL(xmlExport.href);
   xmlExport.href=URL.createObjectURL(new Blob([text],{type}));
  }catch(e){event.preventDefault();message(e.message)}
 };
 el('music-find-pdf').onclick=()=>{dialog.close();onFindPdf()};
 el('music-local-pdf').onclick=()=>loadDraft(async()=>{
  const file=await readMusicAudio({native,call,kind:'pdf'});
  if(file&&dialog.open)await localSheet.openLocal(file.bytes,file.name);
 });
 for(const instrument of ['piano','organ'])el('music-make-'+instrument).onclick=()=>{
  try{
   stop();
   const shift=getShift();
   const draft=chordAccompaniment(getSong(),instrument,{transpose:symbol=>shift?transpose(symbol,shift):symbol,chord:musicChord,bpm:data.score.bpm});
   useDraft(draft,'Đã tạo bè đệm '+instrument+'. Mỗi hợp âm một ô nhịp.');
  }catch(error){message(error.message)}
 };
 el('music-import-midi').onclick=()=>loadDraft(async()=>{
  const file=await readMusicAudio({native,call,kind:'midi'});
  if(!file)return;
  const draft=midiToSheet(file.bytes,file.name);
  useDraft(draft,'Đã đọc MIDI · độ lệch lưới '+draft.maxError.toFixed(3).replace('.',',')+' phách.');
 });
 el('music-import-xml').onclick=()=>loadDraft(async()=>{
  const file=await readMusicAudio({native,call,kind:'musicxml'});
  if(!file)return;
  const text=new TextDecoder('utf-8',{fatal:true}).decode(file.bytes);
  useDraft(musicXmlToSheet(text,file.name),'Đã nhập MusicXML.');
 });
 el('music-transcribe').onclick=()=>loadDraft(async()=>{
  const file=await readMusicAudio({native,call});
  if(!file)return;
  message('Đang đọc âm thanh trên thiết bị…');
  const bpm=data.score.bpm, start=Number(el('music-audio-start').value);
  const ctx=await context();
  try{
   let decoded;
   try{decoded=await ctx.decodeAudioData(file.bytes)}
   catch{throw new Error('Thiết bị chưa đọc được tệp này. Thử WAV, MP3 hoặc M4A.')}
   const result=await transcribeMusicAudio(decoded,{bpm,start,onProgress(percent){el('music-job-status').textContent='Đang nhận nốt '+percent+'%'}});
   useDraft({title:file.name,author:'',bpm,notes:result.notes,origin:'audio-draft'},'Đã tạo sheet nháp '+result.notes.length+' nốt/dấu lặng. '+(result.limited?'Đã giới hạn đoạn ở 60 giây hoặc 128 nốt.':'Nghe lại và đối chiếu.'));
  }finally{stop()}
 });
 el('music-import').onclick=()=>loadDraft(async()=>{
  const text=await readMusicText({native,call});
  if(!text)return;
  const parsed=JSON.parse(text);
  if(parsed?.format!=='goc-score-1'||!Array.isArray(parsed.notes))throw new Error('Cần tệp sheet Góc Hợp Âm đã xuất.');
  useDraft(parsed,'Đã mở tệp sheet JSON.');
 });
 el('music-practice-notes').value=data.notes;el('music-practice-notes').oninput=()=>{data.notes=el('music-practice-notes').value;save()};el('music-log').onclick=()=>{const minutes=Math.round(Number(el('music-minutes').value));if(!Number.isFinite(minutes)||minutes<1||minutes>600){message('Nhập thời gian tập từ 1 đến 600 phút.');return}data.sessions.push({date:new Date().toISOString(),minutes});data.sessions=data.sessions.slice(-30);save();sessions();message('Đã lưu buổi tập trên thiết bị.')};
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&!picking)stop()});el('music-quality').value='';el('music-note').value='60';chord();score();sessions();
 return {
  open(panel='score'){
   const song=getSong();
   el('music-source-song').textContent=song?.title?'Đang mở '+song.title:'Chọn PDF, MIDI, MusicXML hoặc audio để bắt đầu.';
   dialog.querySelector('[data-music-tab="'+panel+'"]').click();
   dialog.showModal();
   dialog.scrollTop=0;
  },
  printLyrics,stop,get permissionPending(){return picking}
 };
}
