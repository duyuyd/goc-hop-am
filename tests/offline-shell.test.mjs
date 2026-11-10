import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const publicRoot = new URL('../public/', import.meta.url);

test('the offline worker uses only public static files and falls back on a disconnected reader navigation', async () => {
  const source = await readFile(new URL('service-worker.js',publicRoot),'utf8');
  const html = await readFile(new URL('live.html',publicRoot),'utf8');
  const origin='https://goc.example';
  const events=new Map();
  const cached=new Map();
  let upstreamStatus=null;
  runInNewContext(source,{
    URL,Response,
    self:{location:{origin},addEventListener:(name,handler)=>events.set(name,handler)},
    caches:{
      open:async()=>({addAll:async paths=>{
        for(const path of paths){
          assert.ok(path!=='/'&&!path.startsWith('/api/')&&!path.startsWith('/quan-tri'));
          await access(new URL(path.split('?')[0].slice(1),publicRoot));
          cached.set(path,path==='/live.html'?html:path);
        }
      }}),
      match:async key=>{const path=typeof key==='string'?key:new URL(key.url).pathname+new URL(key.url).search;return cached.has(path)?new Response(cached.get(path)):undefined},
    },
    fetch:async()=>{if(upstreamStatus==null)throw new Error('offline');return new Response('server',{status:upstreamStatus})},
  });
  let installed;
  events.get('install')({waitUntil:promise=>{installed=promise}});
  await installed;
  assert.ok(cached.has('/live.js?v=144'));
  assert.ok(cached.has('/mobile/bundle.js?v=144'));
  const fetchEvent=(path,mode='navigate')=>{
    let response;
    events.get('fetch')({request:{url:origin+path,method:'GET',mode},respondWith:value=>{response=value}});
    return response;
  };
  const offline=await fetchEvent('/?mode=offline');
  assert.equal(offline.status,200);
  assert.match(await offline.text(),/id="reader-download"/);
  assert.equal(await (await fetchEvent('/mobile/')).text(),'/mobile/index.html');
  assert.equal(fetchEvent('/api/auth','cors'),undefined);
  assert.equal(fetchEvent('/quan-tri'),undefined);
  upstreamStatus=503;
  assert.match(await (await fetchEvent('/')).text(),/Góc Hợp Âm/);
  upstreamStatus=403;
  assert.equal((await fetchEvent('/')).status,403);
});
