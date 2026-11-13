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
  sheet_url: string | null;
  sheet_mime: string | null;
  sheet_license: string | null;
  sheet_source_url: string | null;
  sheet_credit: string | null;
  source_name: string;
  created_at: number;
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
                       has_pdf, pdf_url, sheet_url, sheet_mime,
                       sheet_license, sheet_source_url, sheet_credit, source_name, created_at
                FROM songs WHERE slug = ? LIMIT 1`)
      .bind(slug)
      .first<SongRow>();

    return song ? json({ song }) : json({ error: 'Không tìm thấy bài hát.' }, 404);
  } catch (error) {
    return failure(error);
  }
}
