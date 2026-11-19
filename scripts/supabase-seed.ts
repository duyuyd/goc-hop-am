import { randomBytes } from 'node:crypto';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';

const url = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!/^https:\/\/[a-z0-9.-]+$/.test(url) || !serviceRoleKey || !process.env.GITHUB_ENV)
  throw new Error('FAIL: Supabase Admin API credentials unavailable');
const email = 'e2e-user+' + Date.now() + '@test.com';
const password = randomBytes(32).toString('base64url') + 'Aa1!';
console.log('::add-mask::' + password);
const res = await fetch(url + '/auth/v1/admin/users', {
  method: 'POST',
  headers: { apikey: serviceRoleKey, Authorization: 'Bearer ' + serviceRoleKey, 'content-type': 'application/json' },
  body: JSON.stringify({ email, password, email_confirm: true, app_metadata: { purpose: 'goc-hop-am-e2e' } }),
  signal: AbortSignal.timeout(25000),
});
if (!res.ok) throw new Error('FAIL: Supabase Admin API HTTP ' + res.status);
const user = await res.json() as { id?: string; email?: string };
if (!user.id || user.email?.toLowerCase() !== email) throw new Error('FAIL: new Supabase user was not verified');
await appendFile(process.env.GITHUB_ENV,
  'E2E_EMAIL=' + email + '\nE2E_PASSWORD=' + password + '\nE2E_SUPABASE_USER_ID=' + user.id + '\n');
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/supabase-account.json', JSON.stringify({ email, id: user.id, createdBy: 'Supabase Admin API' },null,2) + '\n');
console.log('Real test user created: ' + email + ' id=' + user.id);
