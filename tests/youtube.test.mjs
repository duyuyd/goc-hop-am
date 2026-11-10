import assert from 'node:assert/strict';
import {youtubeId,youtubeEmbed,songVideos} from '../public/youtube.js';
import {parseSong} from '../lib/song-reader.mjs';

const id='KJ2bEReIZko';
for(const url of [id,'https://youtu.be/'+id+'?t=12','https://www.youtube.com/watch?v='+id+'&amp;feature=share','https://www.youtube.com/shorts/'+id,'https://www.youtube.com/embed/'+id,'https://img.youtube.com/vi/'+id+'/mqdefault.jpg'])assert.equal(youtubeId(url),id);
for(const bad of ['javascript:alert(1)','https://evil.test/watch?v='+id,'https://youtube.com.evil.test/watch?v='+id,'https://user:pass@youtube.com/watch?v='+id,'https://youtube.com:8080/watch?v='+id,'bad-short-id','https://youtube.com/results?search_query=anything'])assert.equal(youtubeId(bad),null);
const embed=new URL(youtubeEmbed(id,'https://music.test/path'));
assert.equal(embed.origin,'https://www.youtube-nocookie.com');assert.equal(embed.pathname,'/embed/'+id);assert.equal(embed.searchParams.get('origin'),'https://music.test');assert.equal(embed.searchParams.get('playsinline'),'1');assert.equal(embed.searchParams.get('autoplay'),'0');assert.equal(youtubeEmbed('bad','https://music.test'),null);
assert.equal(songVideos({videoId:id,thumbnail:'https://img.youtube.com/vi/'+id+'/mqdefault.jpg',videos:[{id,label:'Bản thu'}]}).length,1);
const html='<h1>Bài kiểm thử</h1><div id="lyric-version-0">[C]Lời do người thử viết</div><script>var songSources = [{"music_id":"'+id+'","host":"ytb","html":"UNTRUSTED_MARKUP"},{"music_id":"'+id+'","host":"ytb"},{"music_id":"BAD","host":"ytb"},{"music_id":"M7lc1UVf-VE","host":"other"}];</script>';
const song=parseSong(html,'https://hopamviet.vn/chord/song/fixture/TESTVID1.html');assert.equal(song.videoId,id);assert.equal(song.videos.length,1);assert.ok(!JSON.stringify(song).includes('UNTRUSTED_MARKUP'));
console.log('Passed: validated YouTube links/IDs, trusted embed origin, inline playback parameters, no autoplay, no arbitrary frames, recording extraction/deduplication, and script markup exclusion.');
