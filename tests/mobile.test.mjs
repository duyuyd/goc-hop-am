import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {songUrl,communitySongRef,songReferenceId,songReaderPath,validSong,offlineLibrary,parseOfflineSongs,updateWebOfflineSong,findOfflineSongs,catalogItems,transpose,bpmValue,libraryBytes,videoId,videoList,videoEmbed} from '../public/mobile/logic.js';
const url='https://hopamviet.vn/chord/song/nang-tho/W8IU6E0B.html';
const song={title:'Nàng thơ',author:'Hoàng Dũng',content:'[C]Bài tập [G/B]',key:'C',sourceUrl:url};
test('offline imports reject foreign hosts, credentials, private URLs and malformed songs',()=>{
 for(const value of ['https://example.com/chord/song/nang-tho/W8IU6E0B.html','https://hopamviet.vn.evil.test/chord/song/nang-tho/W8IU6E0B.html','https://user@hopamviet.vn/chord/song/nang-tho/W8IU6E0B.html','javascript:alert(1)','https://hopamviet.vn/admin'])assert.equal(songUrl(value),null);
 assert.equal(validSong({...song,content:''}),false);
 assert.equal(validSong({...song,content:'a'.repeat(80001)}),false);
 const value=offlineLibrary({good:{...song,token:'must-not-persist',videos:['private']},bad:{...song,sourceUrl:'https://example.com/'}});
 assert.equal(Object.keys(value).length,1);assert.equal(value[url].content,song.content);assert.equal('token' in value[url],false);assert.deepEqual(value[url].videos,[]);assert.equal(Object.getPrototypeOf(value),null);
 assert.deepEqual(Object.keys(offlineLibrary(null)),[]);assert.deepEqual(Object.keys(offlineLibrary([])),[]);
});
test('offline library bounds and UTF-8 accounting work for Vietnamese lyrics',()=>{
 const songs=Object.fromEntries(Array.from({length:120},(_,i)=>[i,{...song,sourceUrl:`https://hopamviet.vn/chord/song/bai-hat/A${i}.html`} ]));
 assert.equal(Object.keys(offlineLibrary(songs)).length,100);
 assert.ok(libraryBytes({text:'Âm nhạc'})>JSON.stringify({text:'Âm nhạc'}).length);
});
test('existing saved songs reopen and search locally by the selected field after serialization',async()=>{
 const local={...song,title:'Đường về',author:'Nguyễn An',singer:'Thu Hà',sourceUrl:communitySongRef('first-party-42')};
 let raw=JSON.stringify({[url]:song});
 const store={getItem:()=>raw,setItem:(_,value)=>{raw=value}};
 let lockName;
 const locks={request:async(name,update)=>{lockName=name;return update()}};
 await updateWebOfflineSong(local,store,locks);
 const library=parseOfflineSongs(raw);
 assert.equal(lockName,'goc-mobile-offline');
 assert.equal(library[url].content,song.content);
 assert.equal(library[local.sourceUrl].content,local.content);
 for(const q of ['Nàng thơ','Nàng thơ','Nang tho','Nagn tho'])assert.deepEqual(findOfflineSongs(library,{q}).map(x=>x.title),['Nàng thơ']);
 assert.deepEqual(findOfflineSongs(library,{q:'Thu Ha',type:'singer'}).map(x=>x.title),['Đường về']);
 assert.deepEqual(findOfflineSongs(library,{q:'Nguyen An',type:'composer'}).map(x=>x.title),['Đường về']);
 assert.deepEqual(findOfflineSongs(library,{q:'Nguyen An',type:'singer'}),[]);
 assert.deepEqual(findOfflineSongs(library,{q:'???'}),[]);
 assert.equal(songReferenceId(local.sourceUrl),'goc-first-party-42');
 assert.equal(songReaderPath(local.sourceUrl),'/api/reader?id=first-party-42');
 assert.equal(songReaderPath('goc-song:../../admin'),null);
 assert.equal(songReaderPath('goc-song:private?x=1'),null);
 raw='["incompatible older data"]';
 assert.throws(()=>updateWebOfflineSong(local,store),/Chưa đọc/);
 assert.equal(raw,'["incompatible older data"]');
});
test('transposition preserves slash bass and chord quality through negative and octave shifts',()=>{
 assert.equal(transpose('Am/G',1),'A#m/G#');assert.equal(transpose('Bbmaj7/D',-2),'Abmaj7/C');assert.equal(transpose('C',-13),'B');assert.equal(transpose('F#m7',12),'F#m7');
 for(const value of [-20,0,999,NaN])assert.ok(bpmValue(value)>=40&&bpmValue(value)<=240);
});
test('catalog ignores non-song links and limits rendering to bounded pages',()=>{
 assert.equal(catalogItems({items:[{title:'A',url},{title:'Bad',url:'https://example.com'}]}).length,1);assert.deepEqual(catalogItems({items:null}),[]);
});
test('YouTube accepts official video links and rejects injected, credentialed and lookalike URLs',()=>{
 const id='M7lc1UVf-VE';
 for(const link of [id,`https://youtu.be/${id}`,`https://www.youtube.com/watch?v=${id}&t=20`,`https://m.youtube.com/shorts/${id}`,`https://www.youtube-nocookie.com/embed/${id}`])assert.equal(videoId(link),id);
 for(const link of ['javascript:alert(1)',`https://youtube.com.evil.test/watch?v=${id}`,`https://youtube.com@evil.test/watch?v=${id}`,`https://u:p@youtube.com/watch?v=${id}`,`https://youtube.com:444/watch?v=${id}`,`https://youtu.be/${id}/bad`,"x' onload='bad"])assert.equal(videoId(link),null);
 const saved=offlineLibrary({song:{...song,videos:[{id,label:'Bản chính'},id,{id:'javascript:bad'}],videoId:id}});
 assert.deepEqual(saved[url].videos,[{id,label:'Bản chính'}]);
 assert.equal(videoList({videoId:id}).length,1);
 const embed=new URL(videoEmbed(id,'https://gochopam.pages.dev'));assert.equal(embed.hostname,'www.youtube-nocookie.com');assert.equal(embed.searchParams.get('origin'),'https://gochopam.pages.dev');assert.equal(embed.searchParams.get('autoplay'),'0');assert.equal(videoEmbed('bad','https://gochopam.pages.dev'),null);
});
test('delivered bundle matches sources and native shells have no purchasing or private API bridge',async()=>{
 const logic=(await Promise.all(['logic.js','follow.js','studio.js','pitch.js','sheet-input.js','score-pdf.js','music-tools.js','song-sheet.js'].map(async name=>(await readFile(new URL('../public/mobile/'+name,import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'').replace(/^export /gm,'')))).join('\n');
 const app=(await readFile(new URL('../public/mobile/app.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');
 const bundle=await readFile(new URL('../public/mobile/bundle.js',import.meta.url),'utf8');
 assert.equal(bundle,'// Generated by mobile/scripts/prepare-web.mjs.\n(()=>{\n"use strict";\n'+logic+'\n'+app+'\n})();\n');
 const java=await readFile(new URL('../mobile/android/app/src/main/java/vn/gochopam/app/MainActivity.java',import.meta.url),'utf8');
 const swift=await readFile(new URL('../mobile/ios/MusicViewController.swift',import.meta.url),'utf8');
 for(const source of [java,swift]){assert.ok(source.includes('catalog|reader|video-captions'));assert.ok(!source.includes('/api/auth'));assert.ok(!source.includes('/api/commerce'));}
});


test('real lyric cues track time and reject invented or invalid positions',async()=>{
 const {cleanTimeline,timedLine,parseLrc,matchLyric}=await import('../public/mobile/follow.js');
 const lines=['[C]Ngày hôm qua anh đã mơ','[G]Từng câu hát còn trong tim','Em đi qua mùa thu ấy'];
 assert.deepEqual(parseLrc('[00:05.50]Ngày hôm qua anh đã mơ\n[00:14.20]Từng câu hát còn trong tim',lines),[{time:5.5,line:0},{time:14.2,line:1}]);
 assert.equal(timedLine([{time:5.5,line:0},{time:14.2,line:1}],3),null);
 assert.equal(timedLine([{time:5.5,line:0},{time:14.2,line:1}],15),1);
 assert.equal(timedLine([{time:5.5,line:0},{time:14.2,line:1}],7),0);
 assert.deepEqual(cleanTimeline([{time:-1,line:0},{time:3,line:99},{time:NaN,line:0},{time:2,line:1}],3),[{time:2,line:1}]);
 assert.equal(matchLyric(lines,'từng câu hát còn trong tim',0)?.index,1);
 assert.equal(matchLyric(lines,'chưa',0),null);
 assert.equal(matchLyric(lines,'nội dung hoàn toàn không khớp',0),null);
});
