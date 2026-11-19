import { writeFile, appendFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const timestamp = Date.now();
const slug = 'live-e2e-' + timestamp;
const otp = 'OTP-' + timestamp;
const quote = (value: string): string => "'" + value.replaceAll("'", "''") + "'";
const lyrics = 'Dữ liệu xác thực từ cơ sở dữ liệu trực tiếp. ' + otp +
  ' Đây là bản ghi kiểm chứng tìm kiếm và hiển thị nội dung thực tế.';
const values = [
  quote(randomUUID()), quote(slug), quote('E2E CI'), quote(slug),
  quote('[C] ' + lyrics), quote(lyrics), '0', 'NULL',
  quote('Kiểm chứng E2E'), String(timestamp),
];
const sql = 'INSERT INTO songs(id,title,artist,slug,chords_text,lyrics_text,has_pdf,pdf_url,source_name,created_at)' +
  ' VALUES (' + values.join(',') + ');\n';
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/e2e-seed.sql', sql);
if (!process.env.GITHUB_ENV) throw new Error('Expected GitHub Actions environment');
await appendFile(process.env.GITHUB_ENV, 'E2E_SLUG=' + slug + '\nE2E_OTP=' + otp + '\n');
console.log('Dynamic D1 row slug=' + slug + ' otp=' + otp);
