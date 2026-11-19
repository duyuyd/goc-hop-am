import { env } from 'cloudflare:workers';
import { issueSession, db, body, rate, failure, AppError } from '../../../../lib/accounts';
import { hashPassword } from '../../../../lib/passwords.mjs';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
 try {
  const input = await body(request);
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  if (!/^[^@\\s]+@[^@\\s]+\\.[a-z]{2,}$/.test(email) || email.length > 254 || password.length < 8 || password.length > 128)
   throw new AppError(400, 'Thông tin đăng nhập không hợp lệ.');
  await rate(request, 'supabase:login:' + email, 10);
  const origin = String(env.SUPABASE_URL || '').replace(/\\/+$/, '');
  const anon = String(env.SUPABASE_ANON_KEY || '');
  if (!origin.startsWith('https://') || !anon) throw new AppError(503, 'Supabase chưa cấu hình.');
  const response = await fetch(origin + '/auth/v1/token?grant_type=password', {
   method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' },
   body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new AppError(401, 'Email hoặc mật khẩu không đúng.');
  const session = await response.json() as { access_token?: string };
  if (!session.access_token) throw new AppError(401, 'Supabase không cấp phiên.');
  const verification = await fetch(origin + '/auth/v1/user', {
   headers: { apikey: anon, Authorization: 'Bearer ' + session.access_token },
   signal: AbortSignal.timeout(15000),
  });
  if (!verification.ok) throw new AppError(401, 'Phiên Supabase không hợp lệ.');
  const remoteUser = await verification.json() as { id?: string; email?: string };
  if (!remoteUser.id || !/^[a-f0-9-]{36}$/i.test(remoteUser.id) || remoteUser.email?.toLowerCase() !== email)
   throw new AppError(401, 'Tài khoản Supabase không trùng khớp.');
  const id = 'supabase:' + remoteUser.id;
  const username = 'sb-' + remoteUser.id.replaceAll('-', '');
  await db().prepare("INSERT OR IGNORE INTO accounts(id,username,name,password_hash,role,created_at) VALUES(?,?,?,?,'member',?)")
    .bind(id, username, email, await hashPassword(crypto.randomUUID()), Date.now()).run();
  const member = await db().prepare('SELECT id,username,name,role,created_at FROM accounts WHERE id=?')
    .bind(id).first<{id:string;username:string;name:string;role:'admin'|'member';created_at:number}>();
  if (!member || member.role !== 'member') throw new AppError(403, 'Không thể tạo phiên tài khoản.');
  return issueSession(request, member);
 } catch (error) { return failure(error); }
}
