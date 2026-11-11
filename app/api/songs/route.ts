import { db, json, failure, AppError } from '../../../lib/accounts';
import { readCommunitySong } from '../../../lib/community-catalog.mjs';
import { publicLimit } from '../../../lib/security';

export const dynamic = 'force-dynamic';

type SongListRow = {
  id: string;
  title: string;
  artist: string;
  slug: string;
  has_pdf: number;
  pdf_url: string | null;
  source_name: string;
  created_at: number;
};

function positiveInt(value: string | null, fallback: number, max: number, label: string): number {
  if (value == null) return fallback;
  if (!/^[1-9]\d*$/.test(value)) throw new AppError(400, `Tham số ${label} không hợp lệ.`);
  return Math.min(Number(value), max);
}

export async function GET(request: Request) {
  try {
    const limited = publicLimit(request, 'songs', 120);
    if (limited) return limited;

    const params = new URL(request.url).searchParams;
    const id = params.get('id');

    // Backward compatibility: existing community-song clients still use ?id.
    if (id) {
      const song = await readCommunitySong(db(), id.slice(0, 80));
      return song ? json({ song }) : json({ error: 'Không tìm thấy bài hát.' }, 404);
    }
    // The previous list API remains available explicitly during frontend migration.
    if (params.get('view') === 'community') {
      const q = (params.get('q') || '').slice(0, 120);
      const result = await db().prepare(
        'SELECT id,title,author,genre,rhythm,key FROM community_songs WHERE published=1 AND (title LIKE ? OR author LIKE ?) ORDER BY updated_at DESC LIMIT 50',
      ).bind('%' + q + '%', '%' + q + '%').all();
      return json({ items: result.results || [] });
    }

    const page = positiveInt(params.get('page'), 1, 100_000, 'page');
    const limit = positiveInt(params.get('limit'), 20, 100, 'limit');
    const q = (params.get('q') || '').trim().slice(0, 120);
    const term = '%' + q.replace(/[\\%_]/g, '\\$&') + '%';
    const where = q ? "WHERE title LIKE ? ESCAPE '\\' OR artist LIKE ? ESCAPE '\\'" : '';
    const binds = q ? [term, term] : [];

    const database = db();
    const [countRow, items] = await Promise.all([
      database.prepare(`SELECT COUNT(*) AS total FROM songs ${where}`)
        .bind(...binds).first<{ total: number }>(),
      database.prepare(`
        SELECT id,title,artist,slug,has_pdf,pdf_url,source_name,created_at
        FROM songs ${where}
        ORDER BY created_at DESC, slug ASC LIMIT ? OFFSET ?
      `).bind(...binds, limit, (page - 1) * limit).all<SongListRow>(),
    ]);

    const total = Number(countRow?.total ?? 0);
    if (total === 0) {
      // Keep already-published community songs searchable until the UI is migrated.
      const legacyTerm = '%' + q + '%';
      const legacyFilter = q ? 'AND (title LIKE ? OR author LIKE ?)' : '';
      const legacyBinds = q ? [legacyTerm, legacyTerm] : [];
      const [legacyCount, legacyItems] = await Promise.all([
        database.prepare(`SELECT COUNT(*) AS total FROM community_songs WHERE published = 1 ${legacyFilter}`)
          .bind(...legacyBinds).first<{ total: number }>(),
        database.prepare(`
          SELECT id, title, author, author AS artist, genre, rhythm, key,
                 NULL AS slug, 0 AS has_pdf, NULL AS pdf_url,
                 'Bài cộng đồng' AS source_name, created_at
          FROM community_songs
          WHERE published = 1 ${legacyFilter}
          ORDER BY updated_at DESC LIMIT ? OFFSET ?
        `).bind(...legacyBinds, limit, (page - 1) * limit).all(),
      ]);
      const legacyTotal = Number(legacyCount?.total ?? 0);
      return json({
        items: legacyItems.results || [],
        total: legacyTotal,
        page,
        limit,
        hasMore: page * limit < legacyTotal,
        query: q,
        catalog: 'community',
      });
    }

    return json({
      items: items.results || [],
      total,
      page,
      limit,
      hasMore: page * limit < total,
      query: q,
      catalog: 'imported',
    });
  } catch (error) {
    return failure(error);
  }
}
