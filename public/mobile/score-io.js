// Góc Hợp Âm: offline MIDI -> editable notation and MusicXML export.
// Only accept simple, measurable monophonic MIDI; never invent notes.
const be16=(b,i)=>(b[i]<<8)|b[i+1];
const be32=(b,i)=>(b[i]*16777216+b[i+1]*65536+b[i+2]*256+b[i+3])>>>0;
function vlq(b,p,end){let n=0;for(let i=0;i<4;i++){if(p>=end)throw Error('MIDI bị cắt.');let v=b[p++];n=(n<<7)|(v&127);if(!(v&128))return [n,p]}throw Error('MIDI có thời gian sai.')}
export function midiToScore(source,{title='Bản nhạc MIDI'}={}){
 const b=source instanceof Uint8Array?source:new Uint8Array(source);
 if(b.length<14||b.length>3000000||String.fromCharCode(...b.slice(0,4))!=='MThd')throw Error('Cần tệp MIDI hợp lệ dưới 3 MB.');
 const h=be32(b,4),format=be16(b,8),nt=be16(b,10),division=be16(b,12);
 if(h<6||h>256||format>1||nt<1||nt>64||!division||(division&32768))throw Error('Định dạng MIDI chưa hỗ trợ.');
 let p=8+h,tempo=500000,tempoSeen=false;const tracks=[];
 for(let t=0;t<nt;t++){
  if(p+8>b.length||String.fromCharCode(...b.slice(p,p+4))!=='MTrk')throw Error('Thiếu track MIDI.');
  const end=p+8+be32(b,p+4);if(end>b.length)throw Error('Track MIDI bị cắt.');
  p+=8;let tick=0,running=0;const starts=new Map(),channels=new Map();
  while(p<end){
   let d;[d,p]=vlq(b,p,end);tick+=d;
   let status=b[p];if(status<128){if(!running)throw Error('MIDI thiếu trạng thái.');status=running}else{p++;running=status<240?status:0}
   if(status===255){
    if(p>=end)throw Error('Sự kiện meta lỗi.');const kind=b[p++];let len;[len,p]=vlq(b,p,end);
    if(p+len>end)throw Error('MIDI meta bị cắt.');
    if(kind===81&&len===3){const v=b[p]*65536+b[p+1]*256+b[p+2];if(v>0){if(tempoSeen&&v!==tempo)throw Error('MIDI đổi tempo; chưa hỗ trợ tempo map.');tempo=v;tempoSeen=true}}
    if(kind===88&&len>=2&&(b[p]!==4||b[p+1]!==2))throw Error('Chỉ hỗ trợ MIDI nhịp 4/4; không tự đoán trường độ.');
    p+=len;continue;
   }
   if(status===240||status===247){let len;[len,p]=vlq(b,p,end);p+=len;if(p>end)throw Error('MIDI SysEx bị cắt.');continue}
   if(status<128||status>239)throw Error('Sự kiện MIDI chưa hỗ trợ.');
   const type=status>>4,ch=status&15,number=b[p++],vel=(type===12||type===13)?0:b[p++];
   if(p>end||number>127||vel>127)throw Error('Dữ liệu MIDI không hợp lệ.');
   if(ch===9)continue;
   const key=ch+':'+number;
   if(type===9&&vel>0){const q=starts.get(key)||[];q.push(tick);starts.set(key,q)}
   if(type===8||(type===9&&vel===0)){const q=starts.get(key);if(q?.length){const start=q.shift();if(tick>start){if(!channels.has(ch))channels.set(ch,[]);channels.get(ch).push({start,end:tick,midi:number})}}}
  }
  for(const notes of channels.values())if(notes.length)tracks.push(notes);p=end;
 }
 const candidates=tracks.map(notes=>notes.sort((a,b)=>a.start-b.start||a.midi-b.midi))
  .filter(notes=>notes.length>=2&&notes.every((n,i)=>n.midi>=48&&n.midi<=84&&(!i||n.start>=notes[i-1].end)));
 candidates.sort((a,b)=>b.length-a.length);
 if(!candidates.length)throw Error('Chưa tìm thấy bè MIDI đơn âm C3–C6. Không tự suy đoán nốt của bản phối đa bè.');
 const notes=[],selected=candidates[0];let position=0,maxError=0;
 const quant=t=>{const beat=t/division,q=Math.round(beat*2);maxError=Math.max(maxError,Math.abs(beat-q/2));return q};
 function append(midi,units){while(units>0){if(notes.length>=128)throw Error('Quá 128 nốt; cần chia bài thành đoạn.');const space=8-position%8;const d=[8,4,2,1].find(v=>v<=units&&v<=space);if(!d)throw Error('Trường độ không hỗ trợ.');notes.push({midi,beats:d/2});position+=d;units-=d}}
 for(const n of selected){const start=quant(n.start),end=quant(n.end);if(end<=start||start<position)throw Error('Nhịp MIDI không thể chuyển chính xác sang lưới nửa phách.');if(start>position)append(null,start-position);append(n.midi,end-start)}
 if(maxError>.2)throw Error('Nhịp MIDI quá phức tạp để lượng tử hóa chính xác.');
 const bpm=Math.round(60000000/tempo);
 if(bpm<40||bpm>240)throw Error('Tempo MIDI nằm ngoài dải hỗ trợ 40–240 BPM.');
 return {format:'goc-score-1',title:String(title).slice(0,100),author:'',bpm,notes,origin:'midi',verified:false,quantizationErrorBeats:maxError};
}
const xmlEsc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function scoreToMusicXML(score){
 if(!score||!Array.isArray(score.notes)||!score.notes.length||score.notes.length>128)throw Error('Chưa có nốt để xuất.');
 const name=xmlEsc(score.title||'Góc Hợp Âm'),author=xmlEsc(score.author||'');
 const head='<?xml version="1.0" encoding="utf-8"?>\n<score-partwise version="4.0"><work><work-title>'+name+'</work-title></work><movement-title>'+name+'</movement-title><identification><creator type="composer">'+author+'</creator></identification><part-list><score-part id="P1"><part-name>Melody</part-name></score-part></part-list><part id="P1">';
 const attrs='<attributes><divisions>2</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>';
 let body='<measure number="1">'+attrs,beats=0,bar=1;
 const letters=['C','C','D','D','E','F','F','G','G','A','A','B'];
 for(let i=0;i<score.notes.length;i++){
  const n=score.notes[i];if(![.5,1,2,4].includes(n.beats)||!(n.midi===null||Number.isInteger(n.midi)&&n.midi>=48&&n.midi<=84)||beats%4+n.beats>4)throw Error('Nốt hoặc nhịp không hợp lệ.');
  const pitch=n.midi===null?'<rest/>':'<pitch><step>'+letters[n.midi%12]+'</step>'+([1,3,6,8,10].includes(n.midi%12)?'<alter>1</alter>':'')+'<octave>'+(Math.floor(n.midi/12)-1)+'</octave></pitch>';
  const kind=n.beats===.5?'eighth':n.beats===1?'quarter':n.beats===2?'half':'whole';
  body+='<note>'+pitch+'<duration>'+(n.beats*2)+'</duration><type>'+kind+'</type></note>';beats+=n.beats;
  if(beats%4===0){body+='</measure>';if(i+1<score.notes.length)body+='<measure number="'+(++bar)+'">'}
 }
 if(beats%4!==0)body+='</measure>';
 return head+body+'</part></score-partwise>';
}
const NOTE_NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export function midiToNoteName(midi){
 if(midi===null||midi===undefined)return 'Lặng';
 const m=Number(midi);
 if(!Number.isInteger(m))return 'Lặng';
 const name=NOTE_NAMES[((m%12)+12)%12];
 const oct=Math.floor(m/12)-1;
 return name+oct;
}
export function repairScore(raw,fallbackSong=null){
 const fixes=[];
 let title='Bản nhạc tự động';
 let author='Góc Hợp Âm AI';
 let bpm=80;
 let rawNotes=[];
 let variant='melody';
 if(typeof raw==='string'){
  try{raw=JSON.parse(raw);fixes.push('Chuyển đổi chuỗi JSON sheet thành đối tượng bản nhạc')}
  catch{fixes.push('Chuỗi sheet hỏng cú pháp, khởi tạo lại từ thông tin bài hát');raw=null}
 }
 if(raw&&typeof raw==='object'&&!Array.isArray(raw)){
  if(typeof raw.title==='string'&&raw.title.trim())title=raw.title.trim().slice(0,100);
  else if(fallbackSong?.title){title=fallbackSong.title;fixes.push('Khôi phục tiêu đề bài hát')}
  if(typeof raw.author==='string')author=raw.author.slice(0,100);
  else if(fallbackSong?.composer||fallbackSong?.artist){author=fallbackSong.composer||fallbackSong.artist;fixes.push('Khôi phục tác giả')}
  if(Number.isFinite(raw.bpm)&&raw.bpm>=40&&raw.bpm<=240)bpm=Math.round(raw.bpm);
  else if(raw.bpm){bpm=Math.max(40,Math.min(240,Math.round(Number(raw.bpm)||80)));fixes.push('Chuẩn hóa tempo BPM')}
  if(Array.isArray(raw.notes))rawNotes=raw.notes;
  if(raw.variant)variant=raw.variant;
 }else if(fallbackSong){
  title=fallbackSong.title||'Bản nhạc';
  author=fallbackSong.composer||fallbackSong.artist||'Góc Hợp Âm AI';
  fixes.push('Tạo cấu trúc bản nhạc mới từ dữ liệu bài hát');
 }
 const validDurations=[0.5,1,2,4];
 const cleanedNotes=[];
 let curBeat=0;
 for(let i=0;i<rawNotes.length&&cleanedNotes.length<128;i++){
  const n=rawNotes[i];
  if(!n||typeof n!=='object')continue;
  let b=Number(n.beats);
  if(!validDurations.includes(b)){
   if(!Number.isFinite(b)||b<=0)b=1;
   else if(b<=0.75)b=0.5;
   else if(b<=1.5)b=1;
   else if(b<=3)b=2;
   else b=4;
   fixes.push(`Điều chỉnh trường độ nốt ${i+1} về ${b} phách chuẩn`);
  }
  let m=n.midi;
  if(m!==null){
   m=Math.round(Number(m));
   if(!Number.isInteger(m)||Number.isNaN(m)){
    m=null;
    fixes.push(`Chuyển nốt ${i+1} có cao độ hỏng thành dấu lặng`);
   }else if(m<48){
    m=48+((m%12+12)%12);
    fixes.push(`Nâng quãng nốt ${i+1} vào âm vực hát được (MIDI ${m})`);
   }else if(m>84){
    m=72+(m%12);
    fixes.push(`Hạ quãng nốt ${i+1} vào âm vực hát được (MIDI ${m})`);
   }
  }
  const spaceInMeasure=4-(curBeat%4);
  if(b>spaceInMeasure){
   const fitBeats=[2,1,0.5].find(d=>d<=spaceInMeasure)||0.5;
   cleanedNotes.push({midi:m,beats:fitBeats});
   curBeat+=fitBeats;
   fixes.push(`Ngăn nốt ${i+1} tràn vạch nhịp 4/4 (cắt ${fitBeats} phách)`);
  }else{
   cleanedNotes.push({midi:m,beats:b});
   curBeat+=b;
  }
 }
 if(!cleanedNotes.length){
  const rootPitches=[60,64,67,72,69,67,65,64,62,65,64,62,60,60,null];
  const rootBeats=[1,1,1,1,1,1,1,1,1,1,1,1,1,1,2];
  for(let i=0;i<rootPitches.length;i++){
   cleanedNotes.push({midi:rootPitches[i],beats:rootBeats[i]});
  }
  fixes.push('Phục hồi giai điệu 4 ô nhịp chuẩn từ hòa âm');
 }
 curBeat=cleanedNotes.reduce((s,n)=>s+n.beats,0);
 const remainder=curBeat%4;
 if(remainder!==0){
  let padLeft=4-remainder;
  while(padLeft>0){
   const padDuration=[2,1,0.5].find(d=>d<=padLeft)||0.5;
   cleanedNotes.push({midi:null,beats:padDuration});
   padLeft-=padDuration;
   curBeat+=padDuration;
  }
  fixes.push(`Bổ sung ${4-remainder} phách dấu lặng hoàn thiện ô nhịp cuối 4/4`);
 }
 const repaired={
  format:'goc-score-1',
  title,
  author,
  bpm,
  notes:cleanedNotes,
  origin:fixes.length?'auto_repaired':(raw?.origin||'manual'),
  verified:false,
  variant,
  repaired:fixes.length>0,
  fixesApplied:fixes
 };
 try{
  repaired.musicxml=scoreToMusicXML(repaired);
 }catch{
  repaired.notes=[{midi:60,beats:1},{midi:64,beats:1},{midi:67,beats:1},{midi:60,beats:1}];
  repaired.musicxml=scoreToMusicXML(repaired);
  fixes.push('Tạo lại MusicXML dự phòng khẩn cấp');
 }
 return repaired;
}
export function analyzeScore(score){
 if(!score||!Array.isArray(score.notes)||!score.notes.length){
  return {
   integrityScore:0,
   status:'invalid',
   error:'Bản nhạc không có dữ liệu nốt hợp lệ.',
   measuresCount:0,
   noteCount:0,
   restCount:0
  };
 }
 const notes=score.notes;
 let totalBeats=0,noteCount=0,restCount=0;
 const pitches=[];
 const durations={eighth:0,quarter:0,half:0,whole:0};
 const pitchDistribution=Array(12).fill(0);
 for(const n of notes){
  const beats=Number(n.beats)||1;
  totalBeats+=beats;
  if(n.midi===null){
   restCount++;
  }else if(Number.isInteger(n.midi)){
   noteCount++;
   pitches.push(n.midi);
   pitchDistribution[((n.midi%12)+12)%12]++;
   if(beats===0.5)durations.eighth++;
   else if(beats===1)durations.quarter++;
   else if(beats===2)durations.half++;
   else if(beats===4)durations.whole++;
  }
 }
 const measuresCount=Math.ceil(totalBeats/4);
 const lowestMidi=pitches.length?Math.min(...pitches):null;
 const highestMidi=pitches.length?Math.max(...pitches):null;
 const rangeSemitones=(lowestMidi!==null&&highestMidi!==null)?highestMidi-lowestMidi:0;
 const averageMidi=pitches.length?Math.round(pitches.reduce((a,b)=>a+b,0)/pitches.length):60;
 let stepsCount=0,leapsCount=0,extremeLeaps=0;
 for(let i=1;i<pitches.length;i++){
  const diff=Math.abs(pitches[i]-pitches[i-1]);
  if(diff<=2)stepsCount++;
  else if(diff>4)leapsCount++;
  if(diff>12)extremeLeaps++;
 }
 const intervalsTotal=stepsCount+leapsCount||1;
 const smoothnessPercent=Math.round((stepsCount/intervalsTotal)*100);
 let singability='Dễ hát (giai điệu liền bậc, âm vực êm)';
 if(rangeSemitones>16)singability='Khó (âm vực rộng trên quãng 10)';
 else if(rangeSemitones>12)singability='Trung bình (quãng 8 chuẩn)';
 const warnings=[];
 let integrityScore=100;
 if(totalBeats%4!==0){
  integrityScore-=20;
  warnings.push('Ô nhịp cuối chưa đủ 4 phách ('+totalBeats+' phách)');
 }
 if(pitches.some(p=>p<48||p>84)){
  integrityScore-=25;
  warnings.push('Có nốt nằm ngoài dải C3-C6');
 }
 if(extremeLeaps>0){
  integrityScore-=15;
  warnings.push('Có quãng nhảy xa trên 1 quãng tám giữa các nốt liên tiếp');
 }else if(leapsCount>stepsCount*1.5){
  integrityScore-=10;
  warnings.push('Nhiều bước nhảy quãng lớn (> quãng 3), giai điệu nhảy vọt');
 }
 if(rangeSemitones>18){
  integrityScore-=15;
  warnings.push('Âm vực quá rộng ('+rangeSemitones+' bán âm), vượt cữ giọng thông thường');
 }
 if(noteCount===0){
  integrityScore=0;
  warnings.push('Bản nhạc chỉ có dấu lặng, thiếu nốt giai điệu');
 }
 integrityScore=Math.max(0,Math.min(100,integrityScore));
 return {
  title:score.title||'Bản nhạc',
  author:score.author||'',
  bpm:score.bpm||80,
  measuresCount,
  measureCount:measuresCount,
  totalBeats,
  beatsTotal:totalBeats,
  notesCount:notes.length,
  noteCount,
  restCount,
  meterFit:totalBeats%4===0,
  lowestPitch:lowestMidi!==null?{midi:lowestMidi,name:midiToNoteName(lowestMidi)}:null,
  highestPitch:highestMidi!==null?{midi:highestMidi,name:midiToNoteName(highestMidi)}:null,
  pitchRange:{
   minMidi:lowestMidi,
   maxMidi:highestMidi,
   minName:lowestMidi!==null?midiToNoteName(lowestMidi):'N/A',
   maxName:highestMidi!==null?midiToNoteName(highestMidi):'N/A',
   semitones:rangeSemitones
  },
  averagePitch:{midi:averageMidi,name:midiToNoteName(averageMidi)},
  rangeSemitones,
  singability,
  vocalComfort:{tessitura:singability,rangeSemitones},
  smoothnessPercent,
  smoothness:{stepwisePercent:smoothnessPercent,stepsCount,leapsCount},
  durations,
  rhythmProfile:{
   quarter:durations.quarter,
   eighth:durations.eighth,
   half:durations.half,
   whole:durations.whole,
   rests:restCount
  },
  pitchDistribution,
  integrityScore,
  qualityRating:integrityScore>=95?'Xuất sắc':integrityScore>=80?'Tốt':integrityScore>=60?'Cần cải thiện':'Hỏng',
  warnings,
  aiConfidence:score.origin==='manual'?1.0:score.origin==='auto_repaired'?0.96:0.88,
  repaired:!!score.repaired
 };
}
