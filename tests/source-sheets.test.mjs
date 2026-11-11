import test from 'node:test';
import assert from 'node:assert/strict';
import {safeSheetFile,sheetPage,parseSourceSheet,parseSheetIndex,sourceSheet,sheetPdf,pdfChunk} from '../lib/source-sheets.mjs';
import {openScoreFile,parseOpenScoreCatalog} from '../lib/openscore-catalog.mjs';

test('orchestral catalogue distinguishes the full score and melody edition', () => {
 const home='https://github.com/MarkGotham/Hauptstimme/blob/main/data/Bach/BWV232/01/';
 const row='<tr><td>Bach, Johann Sebastian</td><td>B Minor Mass, BWV.232</td><td>01</td><td>.mscz</td>'+
  '<td><a href="'+home+'Bach_01.mxl">.mxl</a></td><td><a href="'+home+'Bach_01_melody.mxl">melody.mxl</a></td></tr>';
 const [score]=parseOpenScoreCatalog(row,'orchestra');
 assert.equal(score.id,'orchestra-bach-01');
 assert.equal(score.file,'https://raw.githubusercontent.com/MarkGotham/Hauptstimme/main/data/Bach/BWV232/01/Bach_01.mxl');
 assert.equal(score.parts[0].name,'Giai điệu');
 assert.match(score.parts[0].url,/Bach_01_melody\.mxl$/);
 assert.equal(openScoreFile(home.replace('github.com','github.com.example.test')+'Bach_01.mxl','orchestra','mxl'),null);
 assert.equal(openScoreFile(home.replace('/main/data/','/main/private/')+'Bach_01.mxl','orchestra','mxl'),null);
});
const song='https://hopamviet.vn/chord/song/bai-kiem-thu/ABC123.html',pdf='https://hopamviet.vn/assets/images/sheets/Score.pdf';
test('sheet discovery uses actual linked PDF files and never fabricates notation or remote URLs',()=>{
 assert.equal(sheetPage(song),'https://hopamviet.vn/sheet/song/bai-kiem-thu/ABC123.html');
 for(const bad of ['http://127.0.0.1/private.pdf','https://hopamviet.vn.evil.test/assets/images/sheets/a.pdf','https://u:p@hopamviet.vn/assets/images/sheets/a.pdf','https://hopamviet.vn/private/a.pdf','https://hopamviet.vn/assets/images/sheets/a.pdf?secret=1'])assert.equal(safeSheetFile(bad),null);
 const value=parseSourceSheet('<h1>Sheet nhạc bài Bài kiểm thử</h1><iframe src="/assets/images/sheets/Score.pdf"></iframe><a href="https://evil.test/private.pdf">Bad</a>',sheetPage(song));assert.deepEqual(value.files,[pdf]);assert.equal(value.title,'Bài kiểm thử');assert.deepEqual(parseSourceSheet('<h1>Chưa có tệp</h1>',sheetPage(song)).files,[]);
 const items=parseSheetIndex('<a href="/sheet/song/bai-kiem-thu/ABC123.html">PDF</a><h3><a href="/sheet/song/bai-kiem-thu/ABC123.html">Bài kiểm thử</a></h3>');assert.equal(items.length,1);assert.equal(items[0].url,song);
});
test('PDF bytes and rests remain in the original file, with bounded native bridge chunks',async()=>{
 const bytes=new TextEncoder().encode('%PDF-1.7\nOriginal engraving bytes, notes and rests.\n%%EOF');
 const fetcher=async url=>url===pdf?new Response(bytes):new Response('<h1>Sheet nhạc Bài kiểm thử</h1><iframe src="'+pdf+'"></iframe>');
 const data=await sourceSheet(song,fetcher);assert.equal(data.available,true);const actual=await sheetPdf(song,0,fetcher);assert.deepEqual(actual,bytes);
 const chunk=pdfChunk(actual,0);assert.equal(chunk.totalBytes,bytes.length);assert.deepEqual(Uint8Array.from(atob(chunk.base64),c=>c.charCodeAt(0)),bytes);assert.throws(()=>pdfChunk(bytes,10),/invalid_part/);
 await assert.rejects(()=>sheetPdf(song,4,fetcher),/missing_file/);
 const missing=await sourceSheet('https://hopamviet.vn/chord/song/khong-co-sheet/NoSheet.html',async()=>new Response('missing',{status:404}));assert.equal(missing.available,false);assert.deepEqual(missing.files,[]);
});
