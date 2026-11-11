import {
  AppError, db, failure, json, rate, requireAccount, requireOrigin,
} from '../../../../lib/accounts';
import { boundedBytes } from '../../../../lib/security';
import { parseSongImport } from '../../../../lib/song-import';

export const dynamic = 'force-dynamic';

const MAX_UPLOAD_BYTES = 750_000;
const UPSERT_SONG = `
  INSERT INTO songs (
    id, title, artist, slug, chords_text, lyrics_text, has_pdf,
    pdf_url, source_name, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      WHEN excluded.source_name <> 'Tệp nhập' THEN excluded.source_name ELSE songs.source_name END
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
    await requireAccount(request, true);
    authenticated = true;
    requireOrigin(request);
    await rate(request, 'song-import', 20);

    const { text, format } = await getInput(request);
    const songs = parseSongImport(text, format);
    processed = songs.length;
    const database = db();
    const now = Date.now();

    const statements = songs.map(song => database.prepare(UPSERT_SONG).bind(
      song.id, song.title, song.artist, song.slug, song.chords_text,
      song.lyrics_text, song.has_pdf, song.pdf_url, song.source_name, song.created_at,
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

    return json({ ok: true, processed, total_songs: Number(stats?.total ?? 0) });
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
