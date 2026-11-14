import { aiConfig, verifyCallback, type Job } from '../../../../lib/ai-jobs';
import { boundedBytes, protectionHeaders } from '../../../../lib/security';

export const dynamic = 'force-dynamic';
export async function POST(request:Request) {
  const config=aiConfig(); if (!config) return new Response(null,{status:503});
  const params=new URL(request.url).searchParams,id=params.get('id')||'',status=params.get('status')||'';
  if (!/^[0-9a-f-]{36}$/.test(id) || !['processing','completed','failed'].includes(status) ||
      !await verifyCallback(config.privateKey,id,request.headers.get('X-Job-Token')||'')) return new Response(null,{status:401});
  const job=await config.db.prepare('SELECT * FROM ai_jobs WHERE id=?').bind(id).first<Job>();
  if (!job || !['pending','processing'].includes(job.status)) return new Response(null,{status:409});
  const now=Date.now();
  if (status==='processing') {
    await config.db.prepare("UPDATE ai_jobs SET status='processing',updated_at=? WHERE id=? AND status IN ('pending','processing')").bind(now,id).run();
    return new Response(null,{status:204});
  }
  if (status==='failed') {
    await config.db.prepare("UPDATE ai_jobs SET status='failed',error=?,updated_at=? WHERE id=? AND status IN ('pending','processing')").bind('Chưa tìm hoặc xử lý được bản thu phù hợp. Hãy thử lại sau.',now,id).run();
    return new Response(null,{status:204});
  }
  let bytes:Uint8Array;
  try { bytes=await boundedBytes(request,6*1024*1024); } catch { return new Response(null,{status:413}); }
  const preview=new TextDecoder().decode(bytes.subarray(0,Math.min(bytes.length,1000)));
  if (!bytes.length || !preview.includes('<score-partwise')) return new Response(null,{status:422});
  // Each callback gets its own object so a duplicate cannot delete the winner's result.
  const key='ai-jobs/'+job.account_id+'/'+id+'/'+crypto.randomUUID()+'.musicxml',resultUrl='/api/ai/result/'+id;
  await config.bucket.put(key,bytes,{httpMetadata:{contentType:'application/vnd.recordare.musicxml+xml'}});
  const updated=await config.db.prepare("UPDATE ai_jobs SET status='completed',result_url=?,result_key=?,updated_at=? WHERE id=? AND status IN ('pending','processing')").bind(resultUrl,key,now,id).run();
  if (!updated.meta?.changes) { await config.bucket.delete(key); return new Response(null,{status:409}); }
  return new Response(null,{status:204,headers:protectionHeaders});
}
