import assert from 'node:assert/strict';
import test from 'node:test';
import {midiToSheet,chordAccompaniment} from '../public/mobile/sheet-input.js';
import {musicChord,scoreMusicXml,scorePages} from '../public/mobile/music-tools.js';
import {transpose} from '../public/mobile/logic.js';
import {sheetPdfBytes} from '../public/mobile/score-pdf.js';

const midiFile = events => Buffer.concat([
 Buffer.from('4d546864000000060000000101e04d54726b','hex'),
 Buffer.from([(events.length+4)>>>24,(events.length+4)>>>16,(events.length+4)>>>8,events.length+4]),
 Buffer.from(events),Buffer.from([0,255,47,0])
]);

test('MIDI preserves silence, exact pitch, dotted rhythm, running status, and a note sustained over the bar',()=>{
 const midi=midiFile([
  0,255,81,3,7,161,32,
  0,144,60,90,131,96,60,0,
  137,48,69,90,135,64,69,0
 ]);
 const draft=midiToSheet(midi,'Giai điệu');
 assert.equal(draft.bpm,120);
 assert.equal(draft.maxError,0);
 assert.deepEqual(draft.notes,[{midi:60,beats:1},{midi:null,beats:2},{midi:null,beats:.5},{midi:69,beats:.5,tie:true},{midi:69,beats:1.5}]);
 const xml=scoreMusicXml(draft);
 assert.match(xml,/<tie type="start"\/>/);
 assert.match(xml,/<tie type="stop"\/>/);
 assert.match(xml,/<type>quarter<\/type><dot\/>/);
 assert.match(xml,/<measure number="2" implicit="yes">/);
});

test('MIDI rejects overlap, incomplete notes, pedal information and off-grid durations',()=>{
 assert.throws(()=>midiToSheet(midiFile([0,144,60,90,0,64,90,131,96,60,0,0,64,0])),/chồng nốt/);
 assert.throws(()=>midiToSheet(midiFile([0,144,60,90])),/thiếu điểm kết thúc/);
 assert.throws(()=>midiToSheet(midiFile([0,176,64,127])),/pedal ngân/);
 assert.throws(()=>midiToSheet(midiFile([0,144,60,90,55,60,0])),/0,09 phách/);
 assert.throws(()=>midiToSheet(midiFile([0,255,88,4,3,2,24,8])),/nhịp 4\/4/);
});

test('piano and organ use a real transposed chord chart, preserve slash bass, and mark output as accompaniment',()=>{
 const song={title:'Bản tập',content:'[Điệp khúc] [C/E] Một [Dm7b5] hai\n[Am7] ba'};
 const options={transpose:symbol=>transpose(symbol,2),chord:musicChord,bpm:96};
 const piano=chordAccompaniment(song,'piano',options);
 const organ=chordAccompaniment(song,'organ',options);
 assert.equal(piano.origin,'piano-draft');
 assert.equal(organ.origin,'organ-draft');
 assert.equal(piano.notes.length,12);
 assert.equal(organ.notes.length,6);
 assert.deepEqual(piano.notes[0],{midi:54,beats:1,chord:'D/F#'});
 assert.deepEqual(organ.notes[0],{midi:54,beats:2,chord:'D/F#'});
 assert.match(scoreMusicXml(piano),/<harmony><root><root-step>D<\/root-step>.*<bass-step>F<\/bass-step><bass-alter>1<\/bass-alter>/);
 assert.match(scoreMusicXml(organ),/organ-draft/);
 assert.throws(()=>chordAccompaniment({content:'[Điệp khúc] Chỉ có lời'},'piano',options),/Mở bài có hợp âm/);
 assert.throws(()=>chordAccompaniment({content:'[C7alt]'},'piano',options),/C7alt/);
});

test('A4 score pagination preserves all notes and bar numbering; dense 16ths get more room',()=>{
 const notes=Array.from({length:25},()=>({midi:60,beats:4}));
 const pages=scorePages({title:'Bản kiểm thử',notes});
 assert.equal(pages.length,2);
 assert.match(pages[0],/1 \/ 2/);
 assert.match(pages[1],/>25<\/text>/);
 assert.equal(pages.join('').match(/<ellipse /g).length,25);
 const dense=scorePages({notes:Array.from({length:193},()=>({midi:60,beats:.25}))});
 assert.equal(dense.length,2);
 assert.match(dense[1],/>13<\/text>/);
 assert.equal(dense.join('').match(/<ellipse /g).length,193);
});

test('PDF writer records byte-accurate offsets for pages and their binary streams',()=>{
 const bytes=sheetPdfBytes([
  {width:1600,height:2000,bytes:new Uint8Array([255,216,255,217])},
  {width:1600,height:900,bytes:new Uint8Array([255,216,255,217])}
 ]);
 const pdf=Buffer.from(bytes).toString('latin1');
 assert.match(pdf,/%PDF-1\.4/);
 assert.match(pdf,/\/Count 2 \/Kids \[3 0 R 6 0 R\]/);
 const index=Number(pdf.match(/startxref\n(\d+)/)[1]);
 assert.equal(pdf.slice(index,index+4),'xref');
 const rows=pdf.slice(index).split('\n').slice(3,11);
 rows.forEach((row,i)=>assert.equal(pdf.slice(Number(row.slice(0,10)),Number(row.slice(0,10))+7),(i+1)+' 0 obj'));
});
