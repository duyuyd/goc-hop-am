import test from 'node:test';
import assert from 'node:assert/strict';
import {captionTracks,parseCaptionCues,videoCaptions} from '../lib/video-captions.mjs';
import {captionTimeline,timedLine} from '../public/mobile/follow.js';
const id='M7lc1UVf-VE';
test('public caption parsing handles quoted braces and ignores scripts around the player data',()=>{
 const response={captions:{playerCaptionsTracklistRenderer:{captionTracks:[{baseUrl:'https://www.youtube.com/api/timedtext?v='+id,languageCode:'vi',name:{simpleText:'A } B'}}]}}};
 assert.equal(captionTracks('before <script>var ytInitialPlayerResponse = '+JSON.stringify(response)+';</script> after')[0].languageCode,'vi');
 assert.deepEqual(captionTracks('<script>no player here</script>'),[]);
 assert.deepEqual(parseCaptionCues({events:[{tStartMs:1200,dDurationMs:2500,segs:[{utf8:'Câu '},{utf8:'thử nghiệm'}]},{tStartMs:-1,segs:[{utf8:'invalid'}]}]}),[{start:1.2,duration:2.5,text:'Câu thử nghiệm'}]);
});
test('captions stay tied to the requested video and arbitrary URLs are rejected',async()=>{
 const html='<script>var ytInitialPlayerResponse = '+JSON.stringify({captions:{playerCaptionsTracklistRenderer:{captionTracks:[{languageCode:'vi',baseUrl:'https://www.youtube.com/api/timedtext?v='+id}]}}})+';</script>';
 let calls=0;const fetcher=async url=>{calls++;return new Response(url.includes('/watch?')?html:JSON.stringify({events:[{tStartMs:5000,dDurationMs:1000,segs:[{utf8:'Một câu kiểm thử'}]}]}))};
 const result=await videoCaptions(id,fetcher);assert.equal(result.videoId,id);assert.equal(result.cues[0].start,5);await videoCaptions(id,fetcher);assert.equal(calls,2);
 await assert.rejects(()=>videoCaptions('bad',fetcher),/invalid/);
 const unsafe='<script>var ytInitialPlayerResponse = '+JSON.stringify({captions:{playerCaptionsTracklistRenderer:{captionTracks:[{baseUrl:'http://localhost/private'}]}}})+';</script>';
 await assert.rejects(()=>videoCaptions('A1b2C3d4E5f',async()=>new Response(unsafe)),/invalid_caption_track/);
});
test('lyric position follows actual caption times, including pauses, seeks and repeated verses',()=>{
 const lines=['[C]Một ngày ta cùng chơi nhạc','[F]Câu hát bay qua mùa nắng','[G]Mình giữ một chút bình yên'];
 const cues=[{start:5,text:'Một ngày ta cùng chơi nhạc'},{start:12,text:'Câu hát bay qua mùa nắng'},{start:20,text:'Mình giữ một chút bình yên'},{start:36,text:'Một ngày ta cùng chơi nhạc'}];
 const timeline=captionTimeline(lines,cues);
 assert.deepEqual(timeline,[{time:5,line:0},{time:12,line:1},{time:20,line:2},{time:36,line:0}]);
 assert.equal(timedLine(timeline,3),null);assert.equal(timedLine(timeline,13),1);assert.equal(timedLine(timeline,6),0);assert.equal(timedLine(timeline,40),0);
 assert.deepEqual(captionTimeline(lines,[{start:1,text:'unrelated captions with no matching words'}]),[]);
});
