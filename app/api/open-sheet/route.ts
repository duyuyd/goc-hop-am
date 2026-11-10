import catalog from '../../../public/ban-pho/catalog.json';
import {mutopiaEdition} from '../../../lib/open-sheet-source.mjs';
import {fetchSheetPdf} from '../../../lib/source-sheets.mjs';
import {protectionHeaders, publicLimit} from '../../../lib/security';

export const dynamic = 'force-dynamic';
const scores = new Map(catalog.items.map(item => [item.id, item]));
const cacheHeaders = {...protectionHeaders, 'Cache-Control': 'public, max-age=1800'};
const failure = (error: string, status: number) => Response.json({error}, {
  status, headers: {...protectionHeaders, 'Cache-Control': 'no-store'},
});

export async function GET(request: Request) {
  const limited = publicLimit(request, 'open-sheet', 70);
  if (limited) return limited;
  const query = new URL(request.url).searchParams;
  const score = scores.get(query.get('id') || '');
  if (!score || score.format !== 'pdf') return failure('Chưa tìm thấy bản PDF này.', 404);
  const fileRequested = query.has('file');
  if (fileRequested && (query.get('file') !== '0' || query.get('download') !== '1')) {
    return failure('Yêu cầu tệp bản phổ không hợp lệ.', 400);
  }

  try {
    if (score.source === 'commons' && score.asset) {
      if (fileRequested) return Response.redirect(new URL('/ban-pho/' + score.asset, request.url), 302);
      return Response.json({
        available: true, files: [{index: 0, name: score.title}],
        credit: `Wikimedia Commons · ${score.author} · ${score.license}`,
      }, {headers: cacheHeaders});
    }
    const edition = await mutopiaEdition(score.id);
    if (fileRequested) {
      if (!edition.pdf) return failure('Bản phổ này được gói trong tệp ZIP ở nguồn.', 404);
      const bytes = await fetchSheetPdf(edition.pdf);
      return new Response(bytes, {headers: {
        ...cacheHeaders, 'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="' + score.id + '.pdf"',
      }});
    }
    return Response.json({
      available: !!edition.pdf, files: edition.pdf ? [{index: 0, name: score.title}] : [],
      archive: edition.archive,
      reason: edition.pdf ? '' : 'Nguồn cung cấp tổng phổ và các bè trong một gói ZIP chứa PDF.',
      credit: ['Mutopia Project', score.author, edition.maintainer && 'Bản khắc: ' + edition.maintainer, edition.license].filter(Boolean).join(' · '),
    }, {headers: cacheHeaders});
  } catch {
    return failure('Nguồn bản phổ chưa phản hồi. Hãy thử lại hoặc mở trang nguồn.', 502);
  }
}
