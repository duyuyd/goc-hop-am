import {
  AppError, db, failure, json, rate, requireAccount, requireOrigin,
} from '../../../../lib/accounts';
import { boundedBytes } from '../../../../lib/security';
import { env } from 'cloudflare:workers';
import { parseSongImport } from '../../../../lib/song-import';

export const dynamic = 'force-dynamic';

const MAX_UPLOAD_BYTES = 750_000;

/** Browser admin sessions require a same-origin request. GitHub Actions use
 * a separate, optional Worker secret. Invalid Authorization never falls back
 * to a logged-in session. */
async function authorizeImport(request: Request): Promise<void> {
  const header = request.headers.get('authorization');
  if (header !== null) {
    const configured = env.SYNC_INGEST_TOKEN || '';
    const supplied = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (configured.length < 32 || !supplied) {
      throw new AppError(401, 'Token đồng bộ chưa được cấu hình hoặc không hợp lệ.');
    }
    const encoder = new TextEncoder();
    const expected = encoder.encode(configured);
    const received = encoder.encode(supplied);
    const sameLength = expected.byteLength === received.byteLength;
    const valid = sameLength
      ? crypto.subtle.timingSafeEqual(expected, received)
      : !crypto.subtle.timingSafeEqual(received, received);
    if (!valid) throw new AppError(401, 'Token đồng bộ không hợp lệ.');
    return;
  }
  await requireAccount(request, true);
  requireOrigin(request);
}
const UPSERT_SONG = `
  INSERT INTO songs (
    id, title, artist, slug, chords_text, lyrics_text, has_pdf,
    pdf_url, source_name, created_at, sheet_key, sheet_mime, sheet_url
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(slug) DO UPDATE SET
    title = excluded.title,
    artist = excluded.artist,
    chords_text = CASE
      WHEN excluded.chords_text <> '' THEN excluded.chords_text ELSE songs.chords_text END,
    lyrics_text = CASE
      WHEN excluded.lyrics_text <> '' THEN excluded.lyrics_text ELSE songs.lyrics_text END,
    has_pdf = CASE WHEN excluded.has_pdf = 1 THEN 1 ELSE songs.has_pdf END,
    pdf_url = COALESCE(excluded.pdf_url, songs.pdf_url),
    source_name = CASE
      WHEN excluded.source_name <> 'Tệp nhập' THEN excluded.source_name ELSE songs.source_name END,
    sheet_key = COALESCE(excluded.sheet_key, songs.sheet_key),
    sheet_mime = COALESCE(excluded.sheet_mime, songs.sheet_mime),
    sheet_url = COALESCE(excluded.sheet_url, songs.sheet_url)
`;

async function getInput(request: Request): Promise<{ text: string; format: 'csv' | 'json' }> {
  const contentType = (request.headers.get('content-type') || '').toLowerCase();
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = await boundedBytes(request, MAX_UPLOAD_BYTES);
  } catch {
    throw new AppError(413, 'Tệp quá lớn (tối đa 750 KB mỗi đợt).');
  }

  const decoder = new TextDecoder('utf-8', { fatal: true });
  if (contentType.includes('multipart/form-data')) {
    let form: FormData;
    try {
      form = await new Request('https://upload.invalid/', {
        method: 'POST',
        headers: { 'Content-Type': request.headers.get('content-type') || '' },
        body: bytes,
      }).formData();
    } catch {
      throw new AppError(400, 'Không đọc được tệp được tải lên.');
    }
    const file = form.get('file');
    if (!file || typeof file === 'string') {
      throw new AppError(400, 'Cần gửi tệp JSON hoặc CSV trong trường file.');
    }
    const ext = file.name.toLowerCase();
    if (!ext.endsWith('.json') && !ext.endsWith('.csv')) {
      throw new AppError(415, 'Chỉ hỗ trợ tệp .json hoặc .csv.');
    }
    return { text: await file.text(), format: ext.endsWith('.csv') ? 'csv' : 'json' };
  }

  try {
    if (contentType.includes('application/json')) {
      return { text: decoder.decode(bytes), format: 'json' };
    }
    if (contentType.includes('text/csv') || contentType.includes('application/csv')) {
      return { text: decoder.decode(bytes), format: 'csv' };
    }
  } catch {
    throw new AppError(400, 'Tệp phải được mã hóa UTF-8.');
  }
  throw new AppError(415, 'Chỉ hỗ trợ JSON, CSV hoặc multipart/form-data.');
}

export async function GET(request: Request) {
  try {
    await requireAccount(request, true);
    const logs = await db().prepare(`
      SELECT id, total_fetched, status, error_message, synced_at
      FROM sync_logs ORDER BY synced_at DESC LIMIT 30
    `).all();
    return json({ logs: logs.results || [] });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  let authenticated = false;
  let processed = 0;
  try {
    await authorizeImport(request);
    authenticated = true;
    await rate(request, 'song-import', 20);

    const { text, format } = await getInput(request);
    const songs = parseSongImport(text, format);
    processed = songs.length;
    const database = db();
    // Count newly inserted slugs rather than presenting updates as new songs.
    const placeholders = songs.map(() => '?').join(', ');
    const previous = await database.prepare(
      'SELECT slug FROM songs WHERE slug IN (' + placeholders + ')',
    ).bind(...songs.map(song => song.slug)).all<{ slug: string }>();
    const existing = new Set((previous.results || []).map(row => row.slug));
    const inserted = songs.filter(song => !existing.has(song.slug)).length;
    // Verify R2 uploads exist before writing links or claiming sync success.
    for (const song of songs) {
      if (!song.sheet_key) continue;
      if (!env.BUCKET) throw new AppError(503, 'R2 binding BUCKET chưa được cấu hình.');
      const object = await env.BUCKET.head(song.sheet_key);
      if (!object) throw new AppError(422, 'Tệp sheet chưa có trên R2: ' + song.slug);
    }
    const now = Date.now();

    const statements = songs.map(song => database.prepare(UPSERT_SONG).bind(
      song.id, song.title, song.artist, song.slug, song.chords_text,
      song.lyrics_text, song.has_pdf, song.pdf_url, song.source_name, song.created_at,
      song.sheet_key, song.sheet_mime, song.sheet_url,
    ));
    statements.push(database.prepare(`
      INSERT INTO sync_logs (id, total_fetched, status, error_message, synced_at)
      VALUES (?, ?, 'success', NULL, ?)
    `).bind(crypto.randomUUID(), processed, now));

    // D1 batch runs as a transaction: any failed statement rolls back the import.
    const results = await database.batch(statements);
    if (results.some(result => result.success !== true)) {
      throw new AppError(500, 'D1 chưa xác nhận ghi dữ liệu thành công.');
    }
    const stats = await database.prepare('SELECT COUNT(*) AS total FROM songs')
      .first<{ total: number }>();

    return json({ ok: true, processed, inserted, total_songs: Number(stats?.total ?? 0) });
  } catch (error) {
    if (authenticated) {
      try {
        await db().prepare(`
          INSERT INTO sync_logs (id, total_fetched, status, error_message, synced_at)
          VALUES (?, ?, 'failed', ?, ?)
        `).bind(
          crypto.randomUUID(),
          processed,
          error instanceof AppError ? error.message.slice(0, 500) : 'Lỗi nhập dữ liệu D1.',
          Date.now(),
        ).run();
      } catch (logError) {
        console.error('Failed to record import error', logError instanceof Error ? logError.name : 'unknown');
      }
    }
    return failure(error);
  }
}
