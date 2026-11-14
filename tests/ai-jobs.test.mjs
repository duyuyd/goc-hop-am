import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {testRuntime} from './helpers/runtime.mjs';

const pair=generateKeyPairSync('ed25519');
const privateKey=pair.privateKey.export({type:'pkcs8',format:'der'}).toString('base64url');
const runtime=testRuntime({AI_TRANSCRIBE_PRIVATE_KEY:privateKey,AI_TRANSCRIBE_URL:'https://audio.example.test/'});
const {authAction}=await import('../lib/accounts.ts');
const {callbackToken}=await import('../lib/ai-jobs.ts');
const generate=await import('../app/api/ai/generate/route.ts');
const status=await import('../app/api/ai/status/[jobId]/route.ts');
const worker=await import('../app/api/ai/worker/route.ts');
const result=await import('../app/api/ai/result/[jobId]/route.ts');
const origin='https://app.test';
async function register(username){
  const r=await authAction(new Request(origin+'/api/auth',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({action:'register',username,name:username,password:'Test-only-123456'})}));
  assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];
}
function generateRequest(cookie){return new Request(origin+'/api/ai/generate',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({song_id:'goc-song:demo',title:'Bài thử nghiệm',author:'Nhạc sĩ'})})}
function params(jobId){return {params:Promise.resolve({jobId})};}

test('job is durable, user-scoped, and only an authenticated callback can publish a result',async()=>{
  const alice=await register('qa_alice'),bob=await register('qa_bob');
  const created=await generate.POST(generateRequest(alice));assert.equal(created.status,202);
  const {jobId}=await created.json();assert.match(jobId,/^[0-9a-f-]{36}$/);
  assert.equal((await (await generate.POST(generateRequest(alice))).json()).jobId,jobId);
  assert.equal(runtime.sql.prepare('SELECT count(*) AS n FROM ai_jobs').get().n,1);
  const lookup=cookie=>status.GET(new Request(origin+'/api/ai/status/'+jobId,{headers:{Cookie:cookie}}),params(jobId));
  assert.equal((await (await lookup(alice)).json()).status,'pending');assert.equal((await lookup(bob)).status,404);
  const call=(state,token,body='')=>worker.POST(new Request(origin+'/api/ai/worker?id='+jobId+'&status='+state,{method:'POST',headers:{'X-Job-Token':token},body}));
  assert.equal((await call('processing','not-a-token')).status,401);
  const token=await callbackToken(privateKey,jobId);assert.equal((await call('processing',token)).status,204);
  assert.equal((await (await lookup(alice)).json()).status,'processing');
  const xml='<?xml version="1.0"?><score-partwise version="4.0"></score-partwise>';
  const duplicates=await Promise.all([call('completed',token,xml),call('completed',token,xml)]);
  assert.deepEqual(duplicates.map(response=>response.status).sort(),[204,409]);
  assert.equal(runtime.objects.size,1);
  const done=await (await lookup(alice)).json();assert.equal(done.status,'completed');
  const get=cookie=>result.GET(new Request(origin+done.resultUrl,{headers:{Cookie:cookie}}),params(jobId));
  assert.equal((await get(alice)).status,200);assert.equal((await get(bob)).status,404);
  assert.equal((await call('failed',token)).status,409);
});
