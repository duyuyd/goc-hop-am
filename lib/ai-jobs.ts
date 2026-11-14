import { env } from 'cloudflare:workers';
import { getRequestExecutionContext } from 'vinext/shims/request-context';
import { audioAuthorization } from './audio-signature.mjs';

export type Job = {id:string; account_id:string; song_id:string; title:string; author:string; status:string; result_url:string|null; result_key:string|null; error:string|null; created_at:number; updated_at:number; lease_until:number; attempts:number};
const origin = 'https://goc-hop-am.onwardcrust.chatgpt.site';
const enc = new TextEncoder();

export function aiConfig() {
  const privateKey = env.AI_TRANSCRIBE_PRIVATE_KEY || '';
  if (!env.DB || !env.BUCKET || !/^[A-Za-z0-9_-]{64}$/.test(privateKey)) return null;
  try {
    const url = new URL(env.AI_TRANSCRIBE_URL || '');
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    return {db: env.DB, bucket: env.BUCKET, privateKey, endpoint: new URL('/jobs', url)};
  } catch { return null; }
}

async function callbackKey(privateKey:string) {
  return crypto.subtle.importKey('raw', enc.encode(privateKey), {name:'HMAC',hash:'SHA-256'}, false, ['sign','verify']);
}
function b64url(bytes:Uint8Array) {
  let binary=''; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export async function callbackToken(privateKey:string, id:string) {
  const signature = await crypto.subtle.sign('HMAC', await callbackKey(privateKey), enc.encode('goc-hop-am:job:v1:'+id));
  return b64url(new Uint8Array(signature));
}
export async function verifyCallback(privateKey:string,id:string,token:string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  try {
    const bytes = Uint8Array.from(atob(token.replace(/-/g,'+').replace(/_/g,'/')+'='), c=>c.charCodeAt(0));
    return await crypto.subtle.verify('HMAC', await callbackKey(privateKey), bytes, enc.encode('goc-hop-am:job:v1:'+id));
  } catch { return false; }
}

export async function dispatchJob(id:string) {
  const config=aiConfig(); if (!config) return;
  const now=Date.now();
  const row=await config.db.prepare("UPDATE ai_jobs SET lease_until=?,attempts=attempts+1,updated_at=? WHERE id=? AND status='pending' AND lease_until<? AND attempts<3 RETURNING *").bind(now+70000,now,id,now).first<Job>();
  if (!row) return;
  try {
    const auth=await audioAuthorization(config.privateKey,'120','enqueue');
    const response=await fetch(config.endpoint,{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({id:row.id,title:row.title,author:row.author,callback_origin:origin,callback_token:await callbackToken(config.privateKey,id)}),redirect:'error',signal:AbortSignal.timeout(28000)});
    if (!response.ok) throw new Error('worker_unavailable');
    await config.db.prepare("UPDATE ai_jobs SET status='processing',updated_at=? WHERE id=? AND status='pending'").bind(Date.now(),id).run();
  } catch {
    await config.db.prepare("UPDATE ai_jobs SET lease_until=0,updated_at=? WHERE id=? AND status='pending'").bind(Date.now(),id).run();
  }
}
export function scheduleJob(id:string) {
  const ctx=getRequestExecutionContext();
  if (ctx) ctx.waitUntil(dispatchJob(id).catch(()=>{}));
}
