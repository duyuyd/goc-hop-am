import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { testRuntime } from './helpers/runtime.mjs';

const token = 'ab'.repeat(32);
const { sql, objects, env } = testRuntime({ SHEET_SYNC_TOKEN: token });
const admin = await import('../app/api/admin/sync/route.ts');
const songDetail = await import('../app/api/songs/[slug]/route.ts');
const songList = await import('../app/api/songs/route.ts');
const assets = await import('../app/api/song-sheets/[file]/route.ts');
const stats = await import('../app/api/stats/route.ts');
const { issueSession } = await import('../lib/accounts.ts');

const origin = 'https://backend.test';
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWFsAAAAASUVORK5CYII=', 'base64');

function blankPdf() {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  for (const [i, object] of objects.entries()) {
    offsets.push(pdf.length);
    pdf += (i + 1) + ' 0 obj\n' + object + '\nendobj\n';
  }
  const start = pdf.length;
  pdf += 'xref\n0 4\n0000000000 65535 f \n';
  for (const offset of offsets) pdf += String(offset).padStart(10, '0') + ' 00000 n \n';
  return Buffer.from(pdf + 'trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n' + start + '\n%%EOF\n');
}

const pdf = blankPdf();
function item(i, data = i % 2 === 0 ? pdf : tinyPng, mime = i % 2 === 0 ? 'application/pdf' : 'image/png') {
  return {
    title: 'Bản thử ' + i,
    artist: 'Tác giả thử nghiệm',
    slug: 'ban-thu-' + i,
    sheet: {
      mime,
      data: data.toString('base64'),
      sha256: createHash('sha256').update(data).digest('hex'),
      license: 'CC0-1.0',
      source_url: 'https://publisher.example/score/' + i,
      credit: 'Người soạn thử nghiệm',
    },
  };
}

function post(items, credential = token) {
  return admin.POST(new Request(origin + '/api/admin/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + credential },
    body: JSON.stringify({ format: 'song-sheets-v1', songs: items }),
  }));
}

async function song(slug) {
  const response = await songDetail.GET(new Request(origin + '/api/songs/' + slug), { params: Promise.resolve({ slug }) });
  assert.equal(response.status, 200);
  return (await response.json()).song;
}

test('10 fixture songs persist in D1, serve PDF and PNG, and replay idempotently', async () => {
  const items = Array.from({ length: 10 }, (_, i) => item(i));
  assert.equal((await post(items, 'ff'.repeat(32))).status, 401);
  assert.equal(sql.prepare('SELECT COUNT(*) AS total FROM songs').get().total, 0);
  assert.equal((await admin.GET(new Request(origin + '/api/admin/sync', {
    headers: { authorization: 'Bearer ' + token },
  }))).status, 401);

  const response = await post(items);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true, processed: 10, inserted: 10, attached: 0, skipped: 0, total_songs: 10,
  });
  assert.equal(objects.size, 2);
  assert.deepEqual(await (await stats.GET()).json(), { total_songs: 10, total_pdfs: 5 });
  for (const [i, bytes] of [pdf, tinyPng].entries()) {
    const row = await song('ban-thu-' + i);
    assert.equal(row.sheet_license, 'CC0-1.0');
    assert.equal(row.sheet_credit, 'Người soạn thử nghiệm');
    assert.equal(row.sheet_source_url, 'https://publisher.example/score/' + i);
    assert.equal(row.pdf_url, i === 0 ? row.sheet_url : null);
    const asset = await assets.GET(new Request(origin + row.sheet_url), {
      params: Promise.resolve({ file: row.sheet_url.split('/').at(-1) }),
    });
    assert.equal(asset.status, 200);
    assert.equal(asset.headers.get('content-type'), i === 0 ? 'application/pdf' : 'image/png');
    assert.deepEqual(Buffer.from(await asset.arrayBuffer()), bytes);
  }
  const repeat = await post(items);
  assert.deepEqual(await repeat.json(), {
    ok: true, processed: 10, inserted: 0, attached: 0, skipped: 10, total_songs: 10,
  });
  assert.equal(objects.size, 2);
  const list = await songList.GET(new Request(origin + '/api/songs?limit=10'));
  assert.equal((await list.json()).items.filter(row => row.sheet_url).length, 10);
});

test('service writes preserve existing sheets and browser admin imports', async () => {
  const startingCount = sql.prepare('SELECT COUNT(*) AS total FROM songs').get().total;
  const user = { id: 'pipeline-test-admin', username: 'pipeline-test', name: 'NPT Duy', role: 'admin', created_at: 1 };
  sql.prepare('INSERT INTO accounts (id,username,name,password_hash,role,created_at) VALUES (?,?,?,?,?,?)')
    .run(user.id, user.username, user.name, 'fixture', user.role, user.created_at);
  const session = await issueSession(new Request(origin), user);
  const cookie = session.headers.get('set-cookie').split(';')[0];
  const manual = await admin.POST(new Request(origin + '/api/admin/sync', {
    method: 'POST',
    headers: { 'content-type': 'text/csv', cookie, origin },
    body: 'title,artist,slug,pdf_url,chords_text\nTên gốc,Tác giả,ban-thu-11,https://publisher.example/old.pdf,[C] lời gốc\n'
      + 'Tên giữ nguyên,Tác giả,ban-thu-12,,[G] lời có sẵn\n',
  }));
  assert.equal(manual.status, 200);
  const response = await post([item(11), item(12)]);
  assert.deepEqual(await response.json(), {
    ok: true, processed: 2, inserted: 0, attached: 1, skipped: 1, total_songs: startingCount + 2,
  });
  assert.equal((await song('ban-thu-11')).pdf_url, 'https://publisher.example/old.pdf');
  const updated = await song('ban-thu-12');
  assert.equal(updated.title, 'Tên giữ nguyên');
  assert.equal(updated.chords_text, '[G] lời có sẵn');
  assert.match(updated.sheet_url, /^\/api\/song-sheets\/[a-f0-9]{64}\.pdf$/);
  const logs = await admin.GET(new Request(origin + '/api/admin/sync', { headers: { cookie } }));
  assert.equal(logs.status, 200);
});

test('invalid content or checksum prevents any batch from reaching R2 and D1', async () => {
  const wrongHash = item(21);
  wrongHash.sheet.sha256 = '00'.repeat(32);
  const before = objects.size;
  assert.equal((await post([item(20), wrongHash])).status, 400);
  const html = Buffer.from('<html>403</html>');
  assert.equal((await post([item(20), item(21, html, 'image/png')])).status, 400);
  assert.equal(sql.prepare("SELECT COUNT(*) AS total FROM songs WHERE slug='ban-thu-20'").get().total, 0);
  assert.equal(objects.size, before);
});

test('an R2 write failure leaves song records intact and unlisted assets stay private', async () => {
  const newPdf = Buffer.concat([pdf.subarray(0, -6), Buffer.from('% fixture\n%%EOF\n')]);
  const candidate = item(30, newPdf);
  const put = env.BUCKET.put;
  env.BUCKET.put = async () => { throw new Error('R2 fixture failure'); };
  try {
    assert.equal((await post([candidate])).status, 500);
  } finally {
    env.BUCKET.put = put;
  }
  assert.equal(sql.prepare("SELECT COUNT(*) AS total FROM songs WHERE slug='ban-thu-30'").get().total, 0);
  const file = candidate.sheet.sha256 + '.pdf';
  await env.BUCKET.put('song-sheets/' + file, newPdf);
  const response = await assets.GET(new Request(origin + '/api/song-sheets/' + file), {
    params: Promise.resolve({ file }),
  });
  assert.equal(response.status, 404);
});
