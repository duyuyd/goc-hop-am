import { AppError } from './accounts';

export type ImportedSong = {
  id: string;
  title: string;
  artist: string;
  slug: string;
  chords_text: string;
  lyrics_text: string;
  has_pdf: number;
  pdf_url: string | null;
  sheet_key: string | null;
  sheet_mime: string | null;
  sheet_url: string | null;
  source_name: string;
  created_at: number;
};

const MAX_ROWS = 50;

function csvRows(source: string): string[][] {
  const text = source.replace(/^\uFEFF/, '');
  const result: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  function addRow() {
    row.push(field);
    if (row.some(cell => cell.trim())) result.push(row);
    row = [];
    field = '';
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      if (field.trim()) throw new AppError(400, 'CSV có dấu ngoặc kép không hợp lệ.');
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      addRow();
    } else {
      field += ch;
    }
  }
  if (quoted) throw new AppError(400, 'CSV có dấu ngoặc kép chưa đóng.');
  if (field.length || row.length) addRow();
  return result;
}

function parseCsv(source: string): Record<string, unknown>[] {
  const rows = csvRows(source);
  if (rows.length < 2) throw new AppError(400, 'CSV cần dòng tiêu đề và ít nhất một bài hát.');
  const headers = rows[0].map(h => h.trim().toLowerCase());
  if (!headers.includes('title')) throw new AppError(400, 'CSV thiếu cột title.');
  return rows.slice(1).map((cells, i) => {
    if (cells.length !== headers.length) throw new AppError(400, `CSV dòng ${i + 2} sai số cột.`);
    return Object.fromEntries(headers.map((h, k) => [h, cells[k]]));
  });
}

function get(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
  return undefined;
}

function stringField(value: unknown, max: number, label: string): string {
  if (value == null) return '';
  if (typeof value !== 'string' && typeof value !== 'number') throw new AppError(400, `Trường ${label} không hợp lệ.`);
  const result = String(value).trim();
  if (result.length > max) throw new AppError(400, `Trường ${label} vượt quá ${max} ký tự.`);
  return result;
}

function createSlug(title: string, artist: string): string {
  return (title + '-' + artist)
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160)
    .replace(/-+$/g, '');
}

export function parseSongImport(source: string, format: 'csv' | 'json'): ImportedSong[] {
  let raw: unknown;
  try {
    raw = format === 'csv' ? parseCsv(source) : JSON.parse(source.replace(/^\uFEFF/, ''));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, 'Tệp JSON/CSV không đúng định dạng.');
  }

  const values = Array.isArray(raw) ? raw
    : raw && typeof raw === 'object' && 'songs' in raw ? (raw as { songs: unknown }).songs
    : null;
  if (!Array.isArray(values) || values.length < 1 || values.length > MAX_ROWS) {
    throw new AppError(400, `Mỗi lần nhập cần từ 1 đến ${MAX_ROWS} bài. Hãy chia tệp lớn thành nhiều đợt.`);
  }

  const slugs = new Set<string>();
  const now = Date.now();
  return values.map((value, i): ImportedSong => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new AppError(400, `Bài ${i + 1} không phải đối tượng dữ liệu.`);
    }
    const item = value as Record<string, unknown>;
    const title = stringField(get(item, 'title'), 180, 'title');
    const artist = stringField(get(item, 'artist', 'author'), 180, 'artist');
    if (!title) throw new AppError(400, `Bài ${i + 1} thiếu tiêu đề.`);
    const slug = stringField(get(item, 'slug'), 160, 'slug') || createSlug(title, artist);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new AppError(400, `Bài ${i + 1} có slug không hợp lệ.`);
    }
    if (slugs.has(slug)) throw new AppError(400, `Trùng slug trong tệp: ${slug}.`);
    slugs.add(slug);

    const chords = stringField(get(item, 'chords_text', 'chords'), 60000, 'chords_text');
    const lyrics = stringField(get(item, 'lyrics_text', 'lyrics'), 60000, 'lyrics_text');
    const pdfUrl = stringField(get(item, 'pdf_url', 'pdf'), 2000, 'pdf_url');
    if (pdfUrl) {
      try {
        const url = new URL(pdfUrl);
        if (url.protocol !== 'https:') throw new Error('Only HTTPS URLs are supported');
      } catch {
        throw new AppError(400, `Bài ${i + 1} có pdf_url không hợp lệ (cần HTTPS).`);
      }
    }

    const sheetKey = stringField(get(item, 'sheet_key'), 240, 'sheet_key');
    const sheetMime = stringField(get(item, 'sheet_mime'), 100, 'sheet_mime');
    const mimeAllowlist = new Set([
      'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
      'application/xml', 'text/xml', 'application/vnd.recordare.musicxml',
      'application/vnd.recordare.musicxml+xml',
      'application/vnd.recordare.musicxml+zip',
    ]);
    const suffix = sheetKey ? sheetKey.slice('sheets/'.length + slug.length) : '';
    if (sheetKey && (!sheetKey.startsWith('sheets/' + slug + '.') ||
        !/^\.(pdf|png|jpe?g|webp|xml|musicxml|mxl)$/.test(suffix) ||
        !mimeAllowlist.has(sheetMime))) {
      throw new AppError(400, `Bài ${i + 1} có R2 asset key/mime không hợp lệ.`);
    }
    if (!sheetKey && sheetMime) throw new AppError(400, 'sheet_mime phải đi kèm sheet_key.');
    const flag = get(item, 'has_pdf');
    const pdfInR2 = sheetKey && sheetMime === 'application/pdf';
    const hasPdf = flag === true || flag === 1 || /^(true|yes|1)$/i.test(String(flag ?? '')) || !!pdfUrl || !!pdfInR2;
    if (hasPdf && !pdfUrl && !pdfInR2) throw new AppError(400, `Bài ${i + 1} báo có PDF nhưng thiếu pdf_url hoặc PDF trong R2.`);
    return {
      id: crypto.randomUUID(),
      title,
      artist,
      slug,
      chords_text: chords,
      lyrics_text: lyrics,
      has_pdf: hasPdf ? 1 : 0,
      pdf_url: pdfUrl || null,
      sheet_key: sheetKey || null,
      sheet_mime: sheetKey ? sheetMime : null,
      sheet_url: sheetKey ? '/api/sheets/' + slug : null,
      source_name: stringField(get(item, 'source_name', 'source'), 100, 'source_name') || 'Tệp nhập',
      created_at: now,
    };
  });
}
