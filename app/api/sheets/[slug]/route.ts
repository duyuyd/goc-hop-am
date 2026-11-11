import { env } from 'cloudflare:workers';
import { db, failure, json } from '../../../../lib/accounts';
import { publicLimit } from '../../../../lib/security';

export const dynamic = 'force-dynamic';

type SheetAsset = { sheet_key: string | null; sheet_mime: string | null };
const safeMime = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
  'application/xml', 'text/xml',
  'application/vnd.recordare.musicxml',
  'application/vnd.recordare.musicxml+xml',
  'application/vnd.recordare.musicxml+zip',
]);

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const limited = publicLimit(request, 'real-sheet', 90);
    if (limited) return limited;
    const { slug } = await context.params;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 160) {
      return json({ error: 'Slug không hợp lệ.' }, 400);
    }
    const row = await db().prepare(
      'SELECT sheet_key, sheet_mime FROM songs WHERE slug = ? LIMIT 1',
    ).bind(slug).first<SheetAsset>();
    if (!row?.sheet_key || !row.sheet_mime || !safeMime.has(row.sheet_mime)) {
      return json({ error: 'Bản phổ chưa có dữ liệu.' }, 404);
    }
    if (!env.BUCKET) return json({ error: 'Kho R2 chưa kết nối.' }, 503);
    const object = await env.BUCKET.get(row.sheet_key);
    if (!object) return json({ error: 'Tệp bản phổ chưa tồn tại trên R2.' }, 404);
    const download = row.sheet_mime.includes('xml') || row.sheet_mime.endsWith('+zip');
    return new Response(object.body, {
      headers: {
        'Content-Type': row.sheet_mime,
        'Content-Disposition': (download ? 'attachment' : 'inline') + '; filename="Goc-Hoi-Am-Sheet"',
        'Cache-Control': 'public, max-age=300',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "sandbox; default-src 'none'",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
