import test from 'node:test';
import assert from 'node:assert/strict';
test('lyrics below the video highlight the first cue, remain fixed on pause and clear when seeking before the first cue',async()=>{
 const {createFollow}=await import('../public/mobile/follow.js');
 const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,{textContent:'',hidden:false,value:'',addEventListener(){},close(){},showModal(){}});return elements.get(id)};
 const prior=globalThis.document;globalThis.document={getElementById:get};const seen=[];let cleared=0;
 try{const f=createFollow({call:async action=>action==='settingsLoad'?JSON.stringify({'song|abcdefghijk':[{time:5,line:0},{time:10,line:1}]}):true,native:false,toast(){},getSong:()=>({sourceUrl:'song'}),getVideo:()=>'abcdefghijk',onHighlight:i=>seen.push(i),onClear:()=>cleared++,stopRegular(){}});f.onSong({content:'Câu đầu\nCâu sau'});await f.videoReady();f.onTick({id:'abcdefghijk',time:5,state:1});f.onTick({id:'abcdefghijk',time:5,state:2});assert.deepEqual(seen,[0]);f.onTick({id:'abcdefghijk',time:10,state:1});assert.deepEqual(seen,[0,1]);f.onTick({id:'abcdefghijk',time:1,state:2});assert.ok(cleared>=2);f.onTick({id:'abcdefghijk',time:5,state:1});assert.deepEqual(seen,[0,1,0]);f.refresh();f.onTick({id:'abcdefghijk',time:5,state:2});assert.deepEqual(seen,[0,1,0,0]);}finally{globalThis.document=prior}
});
