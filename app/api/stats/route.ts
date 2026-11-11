import { db, failure, json } from '../../../lib/accounts';

export const dynamic = 'force-dynamic';

type StatsRow = { total_songs: number; total_pdfs: number };

export async function GET() {
  try {
    const stats = await db().prepare(`
      SELECT
        COUNT(*) AS total_songs,
        COALESCE(SUM(CASE WHEN (has_pdf = 1 AND pdf_url IS NOT NULL AND pdf_url <> '') OR (sheet_mime = 'application/pdf' AND sheet_key IS NOT NULL) THEN 1 ELSE 0 END), 0) AS total_pdfs
      FROM songs
    `).first<StatsRow>();
    return json({
      total_songs: Number(stats?.total_songs ?? 0),
      total_pdfs: Number(stats?.total_pdfs ?? 0),
    });
  } catch (error) {
    return failure(error);
  }
}
