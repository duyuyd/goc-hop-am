import assert from 'node:assert/strict';
import { testRuntime } from './helpers/runtime.mjs';

const runtime = testRuntime();
const stamp = Date.now();
const slug = 'live-e2e-' + stamp;
const otp = 'OTP-' + stamp;
const content = '[C] Đây là bài hát kiểm thử D1 và hiển thị đúng nốt nhạc ' + otp;
runtime.sql.prepare('INSERT INTO songs (id,title,artist,slug,chords_text,lyrics_text,has_pdf,pdf_url,source_name,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
  .run('test-import-' + stamp,slug,'Test',slug,content,content,0,null,'D1 test',stamp);
const { GET } = await import('../app/api/reader/route.ts');
const response = await GET(new Request('https://local.test/api/reader?imported=' + slug));
const payload = await response.json();
assert.equal(response.status, 200);
assert.equal(payload.song.key, 'C');
assert.equal(payload.song.sourceUrl, 'goc-import:' + slug);
assert.equal(payload.song.id, 'goc-import-' + slug);
assert.ok(payload.song.content.includes(otp));
assert.equal(response.headers.get('Cache-Control'), 'no-store');
const missing = await GET(new Request('https://local.test/api/reader?imported=not-found'));
assert.equal(missing.status, 404);
console.log('PASS: actual D1 imported reader includes musical key and dynamic OTP.');
