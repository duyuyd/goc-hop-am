import { db, failure, json } from '../../../../lib/accounts';
import { publicLimit } from '../../../../lib/security';

export const dynamic = 'force-dynamic';

type SongRow = {
  id: string;
  title: string;
  artist: string;
  slug: string;
  chords_text: string;
  lyrics_text: string;
  has_pdf: number;
  pdf_url: string | null;
  source_name: string;
  created_at: number;
  sheet_key: string | null;
  sheet_mime: string | null;
  sheet_url: string | null;
};

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const limited = publicLimit(request, 'song-detail', 120);
    if (limited) return limited;

    const { slug } = await context.params;
    if (slug.length > 160 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return json({ error: 'Đường dẫn bài hát không hợp lệ.' }, 400);
    }

    const song = await db()
      .prepare(`SELECT id, title, artist, slug, chords_text, lyrics_text,
                       has_pdf, pdf_url, source_name, created_at, sheet_key, sheet_mime, sheet_url
                FROM songs WHERE slug = ? LIMIT 1`)
      .bind(slug)
      .first<SongRow>();

    if (!song) return json({ error: 'Không tìm thấy bài hát.' }, 404);
    const publicSheet = song.sheet_key ? new URL('/api/sheets/' + slug, request.url).href : null;
    const { sheet_key: _sheetKey, sheet_mime, ...safe } = song;
    return json({ song: { ...safe, sheet_url: publicSheet,
      pdf_url: sheet_mime === 'application/pdf' && publicSheet ? publicSheet : song.pdf_url,
      has_pdf: sheet_mime === 'application/pdf' && publicSheet ? 1 : song.has_pdf,
    } });
  } catch (error) {
    return failure(error);
  }
}
