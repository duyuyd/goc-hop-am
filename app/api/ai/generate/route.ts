import { body, failure, json, rate, requireAccount, AppError } from '../../../../lib/accounts';
import { aiConfig, scheduleJob, type Job } from '../../../../lib/ai-jobs';
import { songUrl } from '../../../../public/mobile/logic.js';

export const dynamic = 'force-dynamic';
export async function POST(request:Request) {
  try {
    const user=await requireAccount(request); const data=await body(request); const config=aiConfig();
    if (!config) throw new AppError(503,'Dịch vụ tạo bản phổ đang chờ kết nối.');
    const song=typeof data.song_id==='string'?songUrl(data.song_id):null;
    const title=typeof data.title==='string'?data.title.trim().replace(/[\x00-\x1f\x7f]/g,' '):'';
    const author=typeof data.author==='string'?data.author.trim().replace(/[\x00-\x1f\x7f]/g,' '):'';
    if (!song || !title || title.length>180 || author.length>120) throw new AppError(400,'Thông tin bài hát chưa hợp lệ.');
    await rate(request,'ai-generate:'+user.id,5);
    let job=await config.db.prepare("SELECT * FROM ai_jobs WHERE account_id=? AND song_id=? AND status IN ('pending','processing','completed') ORDER BY created_at DESC LIMIT 1").bind(user.id,song).first<Job>();
    if (!job) {
      const id=crypto.randomUUID(),now=Date.now();
      try { await config.db.prepare("INSERT INTO ai_jobs(id,account_id,song_id,title,author,status,created_at,updated_at) VALUES(?,?,?,?,?,'pending',?,?)").bind(id,user.id,song,title,author,now,now).run(); }
      catch { /* A concurrent request can have created the same active job. */ }
      job=await config.db.prepare("SELECT * FROM ai_jobs WHERE account_id=? AND song_id=? AND status IN ('pending','processing') ORDER BY created_at DESC LIMIT 1").bind(user.id,song).first<Job>();
    }
    if (!job) throw new AppError(503,'Chưa tạo được công việc. Hãy thử lại.');
    if (job.status==='pending') scheduleJob(job.id);
    return json({jobId:job.id,status:job.status},202);
  } catch(error) { return failure(error); }
}
