import { failure, json, requireAccount, AppError } from '../../../../../lib/accounts';
import { aiConfig, scheduleJob, type Job } from '../../../../../lib/ai-jobs';

export const dynamic = 'force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{jobId:string}>}) {
  try {
    const user=await requireAccount(request); const {jobId}=await params; const config=aiConfig();
    if (!config) throw new AppError(503,'Dịch vụ đang chờ kết nối.');
    if (!/^[0-9a-f-]{36}$/.test(jobId)) throw new AppError(404,'Không tìm thấy công việc.');
    const job=await config.db.prepare('SELECT * FROM ai_jobs WHERE id=? AND account_id=?').bind(jobId,user.id).first<Job>();
    if (!job) throw new AppError(404,'Không tìm thấy công việc.');
    if (job.status==='processing' && job.updated_at<Date.now()-1200000) {
      await config.db.prepare("UPDATE ai_jobs SET status='failed',error=?,updated_at=? WHERE id=? AND status='processing'").bind('Xử lý mất quá lâu. Hãy thử lại.',Date.now(),job.id).run();
      return json({jobId:job.id,status:'failed',error:'Xử lý mất quá lâu. Hãy thử lại.'});
    }
    if (job.status==='pending' && job.attempts>=3 && job.lease_until<Date.now()) {
      await config.db.prepare("UPDATE ai_jobs SET status='failed',error=?,updated_at=? WHERE id=? AND status='pending'").bind('Chưa kết nối được dịch vụ. Hãy thử lại.',Date.now(),job.id).run();
      return json({jobId:job.id,status:'failed',error:'Chưa kết nối được dịch vụ. Hãy thử lại.'});
    }
    if (job.status==='pending') scheduleJob(job.id);
    return json({jobId:job.id,status:job.status,resultUrl:job.status==='completed'?job.result_url:null,error:job.status==='failed'?job.error:null});
  } catch(error) { return failure(error); }
}
