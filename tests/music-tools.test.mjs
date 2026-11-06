import test from 'node:test';
import assert from 'node:assert/strict';
import {musicChord,cleanScore,scoreSvg,songToPrintableHTML,renderChordDiagramSVG,guitarChordShapes} from '../public/mobile/music-tools.js';
import {detectMusicPitch,scoreFromPitches,transcribeMusicAudio} from '../public/mobile/pitch.js';
test('chord notes and score rendering preserve pitch, rhythm and escaped user titles',()=>{
 assert.deepEqual(musicChord('C','maj7'),[60,64,67,71]);assert.deepEqual(musicChord('A','m'),[69,72,76]);assert.deepEqual(musicChord('bad',''),[]);
 const value=cleanScore({title:'<script>bad</script>',author:'NPT Duy',notes:[{midi:60,beats:1},{midi:63,beats:1},{midi:null,beats:2}]});
 const svg=scoreSvg(value);assert.ok(svg.includes('&lt;script&gt;'));assert.ok(!svg.includes('<script>'));assert.ok(svg.includes('♯'));assert.ok(svg.includes('NPT Duy'));
 assert.throws(()=>cleanScore({notes:[{midi:60,beats:1},{midi:60,beats:4}]}),/ô nhịp/);
 assert.throws(()=>cleanScore({notes:[{midi:120,beats:1}]}),/không hợp lệ/);
});
test('local melody recognition finds musical notes in synthetic sound and rejects silence',()=>{
 const rate=11025;for(const midi of [48,60,64,69,72,79,84]){const hz=440*2**((midi-69)/12),samples=Float32Array.from({length:1024},(_,i)=>.3*Math.sin(2*Math.PI*hz*i/rate)+.08*Math.sin(4*Math.PI*hz*i/rate));assert.equal(detectMusicPitch(samples,rate),midi,'MIDI '+midi)}
 assert.equal(detectMusicPitch(new Float32Array(1024),rate),null);
 const notes=scoreFromPitches([...Array(40).fill(60),...Array(20).fill(null),...Array(40).fill(64)],.025,60);
 assert.ok(notes.some(n=>n.midi===60));assert.ok(notes.some(n=>n.midi===null));assert.ok(notes.some(n=>n.midi===64));assert.doesNotThrow(()=>cleanScore({notes}));
});
test('full audio pipeline produces an editable melody without fabricated silent notes',async()=>{
 const rate=11025,data=Float32Array.from({length:rate*2},(_,i)=>.25*Math.sin(2*Math.PI*(i<rate?261.6256:329.6276)*i/rate));
 const result=await transcribeMusicAudio({sampleRate:rate,duration:2,numberOfChannels:1,getChannelData:()=>data},{bpm:60});
 assert.ok(result.notes.some(n=>n.midi===60));assert.ok(result.notes.some(n=>n.midi===64));assert.doesNotThrow(()=>cleanScore({notes:result.notes}));
 await assert.rejects(()=>transcribeMusicAudio({sampleRate:rate,duration:1,numberOfChannels:1,getChannelData:()=>new Float32Array(rate)}),/Chưa nhận/);
});
test('songToPrintableHTML generates complete printable A4 HTML with chord diagrams and transposition',()=>{
 const song = {
  title: 'Nàng <Thơ>',
  author: 'Hoàng Dũng',
  key: 'C',
  content: '[C]Em ngày em đánh rơi [Am]nụ cười vào [G/B]anh\nCó [F]nghe mùa thu vừa ghé.'
 };
 const html = songToPrintableHTML(song, 2); // Shift by +2 semitones
 assert.ok(html.includes('Nàng &lt;Thơ&gt;'));
 assert.ok(!html.includes('Nàng <Thơ>'));
 assert.ok(html.includes('Hoàng Dũng'));
 assert.ok(html.includes('Tông: D (+2)'));
 assert.ok(html.includes('[D]'));
 assert.ok(html.includes('[Bm]'));
 assert.ok(html.includes('[A/C#]'));
 assert.ok(html.includes('BẢNG HỢP ÂM TRONG BÀI'));
 assert.ok(html.includes('chord-diagram'));
 assert.ok(html.includes('@page{size:A4 portrait'));

 // Test chord diagram generator directly
 const diagC = renderChordDiagramSVG('C');
 assert.ok(diagC.includes('<svg'));
 assert.ok(diagC.includes('circle'));
 const diagUnknown = renderChordDiagramSVG('CustomX99');
 assert.ok(diagUnknown.includes('CustomX99'));
});

