import { env } from 'cloudflare:workers';
import { AppError, db, failure, json, rate } from './accounts';
import { boundedBytes, protectionHeaders, publicLimit } from './security';
import { parseSongImport } from './song-import';

const MAX_FILES = 10;
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_BODY_BYTES = 9 * 1024 * 1024;
const API_PATH = '/api/song-sheets/';
const FORMATS = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
} as const;
type Format = keyof typeof FORMATS;
const licenses = new Set(['CC0-1.0', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'PDM-1.0', 'Permission']);
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');

function authorizeSync(request: Request) {
  const expected = env.SHEET_SYNC_TOKEN;
  if (!expected || !/^[a-f0-9]{64}$/.test(expected)) {
    throw new AppError(503, 'Chưa cấu hình khóa đồng bộ bản phổ.');
  }
  const provided = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/i)?.[1];
  if (!provided) throw new AppError(401, 'Khóa đồng bộ bản phổ không hợp lệ.');
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  if (difference) throw new AppError(401, 'Khóa đồng bộ bản phổ không hợp lệ.');
}

function record(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  throw new AppError(400, 'Dữ liệu đồng bộ bản phổ không hợp lệ.');
}

function hasSignature(bytes: Uint8Array, format: Format): boolean {
  if (format === 'pdf') {
    const decoder = new TextDecoder();
    return decoder.decode(bytes.subarray(0, 5)) === '%PDF-'
      && decoder.decode(bytes.subarray(-2048)).trimEnd().endsWith('%%EOF');
  }
  if (format === 'png') {
    const prefix = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82];
    const suffix = [0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130];
    return bytes.length >= 45 && prefix.every((byte, i) => bytes[i] === byte)
      && suffix.every((byte, i) => bytes[bytes.length - suffix.length + i] === byte);
  }
  return bytes.length >= 6 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    && bytes.at(-2) === 255 && bytes.at(-1) === 217;
}

async function readSheet(value: unknown) {
  const { mime, data, sha256, license, source_url, credit } = record(value);
  const format = (Object.keys(FORMATS) as Format[]).find(key => FORMATS[key] === mime);
  if (!format || typeof license !== 'string' || !licenses.has(license)
    || typeof credit !== 'string' || !credit.trim() || credit.length > 250
    || typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256)) {
    throw new AppError(400, 'Thiếu định dạng, giấy phép, ghi công hoặc mã kiểm tra của bản phổ.');
  }
  const source = typeof source_url === 'string' && source_url.length <= 2000 ? URL.parse(source_url) : null;
  if (!source || source.protocol !== 'https:' || source.username || source.password) {
    throw new AppError(400, 'Đường dẫn nguồn bản phổ phải dùng HTTPS.');
  }
  if (typeof data !== 'string' || !data || data.length > Math.ceil(MAX_FILE_BYTES / 3) * 4) {
    throw new AppError(413, 'Mỗi tệp bản phổ tối đa 3 MiB.');
  }
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    const decoded = atob(data);
    bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
  } catch {
    throw new AppError(400, 'Nội dung tệp bản phổ không phải Base64 hợp lệ.');
  }
  if (!hasSignature(bytes, format) || hex(await crypto.subtle.digest('SHA-256', bytes)) !== sha256) {
    throw new AppError(400, 'Tệp bản phổ sai định dạng hoặc không khớp mã kiểm tra.');
  }
  const file = sha256 + '.' + format;
  return { bytes, file, mime: FORMATS[format], license, source: source.href, credit: credit.trim() };
}

async function readBatch(request: Request) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new AppError(415, 'Đồng bộ bản phổ yêu cầu JSON.');
  }
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = await boundedBytes(request, MAX_BODY_BYTES);
  } catch {
    throw new AppError(413, 'Mỗi đợt đồng bộ tối đa 9 MiB.');
  }
  let input: unknown;
  try {
    input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new AppError(400, 'Không đọc được JSON UTF-8.');
  }
  const { format, songs } = record(input);
  if (format !== 'song-sheets-v1' || !Array.isArray(songs) || !songs.length || songs.length > MAX_FILES) {
    throw new AppError(400, 'Mỗi đợt cần 1–10 bản phổ theo định dạng song-sheets-v1.');
  }
  const items = songs.map(record);
  const metadata = parseSongImport(JSON.stringify(items.map(({ title, artist, slug, source_name }) => ({
    title, artist, slug, source_name,
  }))), 'json');
  return Promise.all(items.map(async (item, i) => ({ song: metadata[i], sheet: await readSheet(item.sheet) })));
}

export async function syncSongSheets(request: Request) {
  try {
    authorizeSync(request);
    const bucket = env.BUCKET;
    if (!bucket) throw new AppError(503, 'Kho tệp bản phổ chưa sẵn sàng.');
    await rate(request, 'sheet-sync', 20);
    const entries = await readBatch(request);
    const database = db();
    const slugs = entries.map(({ song }) => song.slug);
    const existing = await database.prepare(
      'SELECT slug FROM songs WHERE slug IN (' + slugs.map(() => '?').join(',') + ") AND (sheet_url IS NOT NULL OR COALESCE(pdf_url, '') <> '')",
    ).bind(...slugs).all<{ slug: string }>();
    const occupied = new Set(existing.results.map(row => row.slug));
    const candidates = entries.filter(({ song }) => !occupied.has(song.slug));

    const stored = new Set<string>();
    for (const { sheet } of candidates) {
      if (stored.has(sheet.file)) continue;
      const key = 'song-sheets/' + sheet.file;
      if (!await bucket.head(key)) {
        await bucket.put(key, sheet.bytes, { httpMetadata: { contentType: sheet.mime } });
      }
      stored.add(sheet.file);
    }

    const statements = candidates.flatMap(({ song, sheet }) => {
      const path = API_PATH + sheet.file;
      const isPdf = sheet.mime === FORMATS.pdf;
      const fields = [Number(isPdf), isPdf ? path : null, path, sheet.mime, sheet.license, sheet.source, sheet.credit];
      return [
        database.prepare(
          'INSERT INTO songs (id,title,artist,slug,source_name,created_at,has_pdf,pdf_url,sheet_url,sheet_mime,sheet_license,sheet_source_url,sheet_credit) ' +
          'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(slug) DO NOTHING',
        ).bind(song.id, song.title, song.artist, song.slug, song.source_name, song.created_at, ...fields),
        database.prepare(
          'UPDATE songs SET has_pdf=?,pdf_url=?,sheet_url=?,sheet_mime=?,sheet_license=?,sheet_source_url=?,sheet_credit=? ' +
          "WHERE slug=? AND sheet_url IS NULL AND COALESCE(pdf_url, '')=''",
        ).bind(...fields, song.slug),
      ];
    });
    statements.push(
      database.prepare("INSERT INTO sync_logs (id,total_fetched,status,synced_at) VALUES (?,?,'success',?)")
        .bind(crypto.randomUUID(), entries.length, Date.now()),
      database.prepare('SELECT COUNT(*) AS total FROM songs'),
    );
    const results = await database.batch<{ total: number }>(statements);
    if (results.some(result => result.success !== true)) throw new AppError(500, 'D1 chưa xác nhận đồng bộ.');
    let inserted = 0;
    let attached = 0;
    for (let i = 0; i < candidates.length; i++) {
      inserted += results[i * 2].meta.changes;
      attached += results[i * 2 + 1].meta.changes;
    }
    return json({
      ok: true,
      processed: entries.length,
      inserted,
      attached,
      skipped: entries.length - inserted - attached,
      total_songs: results.at(-1)?.results[0]?.total ?? 0,
    });
  } catch (error) {
    return failure(error);
  }
}

export async function serveSongSheet(request: Request, file: string) {
  try {
    const limited = publicLimit(request, 'song-sheet', 120);
    if (limited) return limited;
    const format = file.match(/^[a-f0-9]{64}\.(pdf|png|jpg)$/)?.[1] as Format | undefined;
    const missing = () => json({ error: 'Không tìm thấy bản phổ.' }, 404);
    if (!format) return missing();
    const listed = await db().prepare('SELECT 1 FROM songs WHERE sheet_url=? LIMIT 1').bind(API_PATH + file).first();
    if (!listed) return missing();
    if (!env.BUCKET) throw new AppError(503, 'Kho tệp bản phổ chưa sẵn sàng.');
    const object = await env.BUCKET.get('song-sheets/' + file);
    if (!object) return missing();
    return new Response(object.body, { headers: {
      ...protectionHeaders,
      'Content-Type': FORMATS[format],
      'Content-Length': String(object.size),
      'Content-Disposition': 'inline; filename="' + file + '"',
      'Cache-Control': 'public, max-age=86400, immutable',
      'Cross-Origin-Resource-Policy': 'same-origin',
    } });
  } catch (error) {
    return failure(error);
  }
}
