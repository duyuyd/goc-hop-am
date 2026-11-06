import test from 'node:test';
import assert from 'node:assert/strict';
import {STARTER_EXERCISES,offlineFind,offlineSearch,offlineSearchKey} from '../public/mobile/offline-catalog.js';
import {songUrl,validSong,offlineLibrary} from '../public/mobile/logic.js';

test('original chord exercises are included locally and never mislabelled verified',()=>{
 assert.equal(STARTER_EXERCISES.length,12);
 for(const item of STARTER_EXERCISES){
  assert.equal(validSong(item),true);
  assert.equal(item.sheets.melody.status,'missing');
  assert.ok(item.title.startsWith('Bài tập hợp âm'));
  assert.ok(item.sourceUrl.startsWith('local:practice-'));
 }
});

test('offline search handles NFC/NFD, no accents, and partial titles',()=>{
 const title='Bài tập hợp âm 01';
 assert.equal(offlineSearchKey(title),'bai tap hop am 01');
 assert.equal(offlineSearchKey(title.normalize('NFD')),'bai tap hop am 01');
 const found=offlineSearch({}, {query:'bai tap hop am 01'});
 assert.equal(found.total,1);
 assert.equal(found.items[0].sourceUrl,'local:practice-01');
});

test('the native app can search, open and store its own songs without a site',()=>{
 const sourceUrl='local:custom-test-offline';
 const song={title:'Giai điệu riêng',author:'Chính tôi',key:'C',content:'[C]Tôi tự tập [G]ở nhà',sourceUrl};
 assert.equal(songUrl(sourceUrl),sourceUrl);
 assert.equal(validSong(song),true);
 const saved=offlineLibrary({[sourceUrl]:song});
 assert.equal(offlineFind(saved,sourceUrl).content,song.content);
 assert.equal(offlineSearch(saved,{query:'giai dieu rieng'}).items[0].sourceUrl,sourceUrl);
 assert.equal(offlineSearch(saved,{query:'khong tim thay'}).total,0);
 assert.equal(offlineFind({},'local:practice-02')?.sourceUrl,'local:practice-02');
 assert.equal(offlineFind({},'site:fake'),null);
 assert.equal(songUrl('local:../../admin'),null);
 assert.equal(songUrl('local:custom-<script>'),null);
});

test('saved songs and exercises are distinct and results are paginated',()=>{
 const saved={'local:practice-01':{...STARTER_EXERCISES[0],title:'Bài tập tôi chỉnh',savedAt:1}};
 assert.equal(offlineSearch(saved).total,12);
 assert.equal(offlineSearch(saved,{limit:5,page:0}).items.length,5);
 assert.equal(offlineSearch(saved,{limit:5,page:1}).items.length,5);
 assert.equal(offlineSearch(saved,{limit:5,page:2}).items.length,2);
 assert.equal(offlineSearch(saved,{query:'bai tap toi chinh'}).total,1);
});
