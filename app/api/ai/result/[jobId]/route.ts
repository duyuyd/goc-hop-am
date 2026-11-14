import { aiConfig, type Job } from '../../../../../lib/ai-jobs';
import { failure, requireAccount, AppError } from '../../../../../lib/accounts';
import { protectionHeaders } from '../../../../../lib/security';

export const dynamic = 'force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{jobId:string}>}) {
  try {
    const user=await requireAccount(request);const {jobId}=await params;const config=aiConfig();
    if (!config || !/^[0-9a-f-]{36}$/.test(jobId)) throw new AppError(404,'Không tìm thấy bản phổ.');
    const job=await config.db.prepare("SELECT * FROM ai_jobs WHERE id=? AND account_id=? AND status='completed'").bind(jobId,user.id).first<Job>();
    if (!job?.result_key) throw new AppError(404,'Không tìm thấy bản phổ.');
    const object=await config.bucket.get(job.result_key);if (!object) throw new AppError(404,'Không tìm thấy bản phổ.');
    return new Response(object.body,{headers:{...protectionHeaders,'Content-Type':'application/vnd.recordare.musicxml+xml','Cache-Control':'private, no-store','X-Robots-Tag':'noindex','Content-Security-Policy':"sandbox; default-src 'none'"}});
  } catch(error) { return failure(error); }
}
