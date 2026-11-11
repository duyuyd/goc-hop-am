import catalog from '../../../public/ban-pho/catalog.json';
import {mutopiaEdition} from '../../../lib/open-sheet-source.mjs';
import {boundedBytes, fetchSheetPdf} from '../../../lib/source-sheets.mjs';
import {openScoreSources, openScoreFile} from '../../../lib/openscore-catalog.mjs';
import {protectionHeaders, publicLimit} from '../../../lib/security';

export const dynamic = 'force-dynamic';
const scores = new Map(catalog.items.map(item => [item.id, item]));
const cacheHeaders = {...protectionHeaders, 'Cache-Control': 'public, max-age=1800'};
const failure = (error: string, status: number) => Response.json({error}, {
  status, headers: {...protectionHeaders, 'Cache-Control': 'no-store'},
});

function fileResponse(bytes: BodyInit, id: string, extension: 'pdf' | 'mxl') {
  return new Response(bytes, {headers: {
    ...cacheHeaders,
    'Content-Type': extension === 'pdf' ? 'application/pdf' : 'application/vnd.recordare.musicxml',
    'Content-Disposition': 'inline; filename="' + id + '.' + extension + '"',
  }});
}

export async function GET(request: Request) {
  const limited = publicLimit(request, 'open-sheet', 70);
  if (limited) return limited;
  const query = new URL(request.url).searchParams;
  const score = scores.get(query.get('id') || '');
  if (!score || !['pdf', 'mxl'].includes(score.format)) return failure('Chưa tìm thấy tệp bản phổ này.', 404);
  const fileRequested = query.has('file');
  const file = Number(query.get('file'));
  if (fileRequested && (!/^(?:0|[1-9]\d?)$/.test(query.get('file') || '') || query.get('download') !== '1')) {
    return failure('Yêu cầu tệp bản phổ không hợp lệ.', 400);
  }

  try {
    if (score.file && Object.hasOwn(openScoreSources, score.source)) {
      const extension = score.format === 'mxl' ? 'mxl' : 'pdf';
      const editions = [{url: score.file, name: extension === 'pdf' || score.source === 'orchestra' ? 'Tổng phổ' : 'MusicXML'}, ...(score.parts || [])];
      if (!fileRequested) return Response.json({
        available: true, files: editions.map(({name}, index) => ({index, name})),
        credit: [score.author, score.lyricist, 'CC0 1.0'].filter(Boolean).join(' · '),
      }, {headers: cacheHeaders});

      const url = openScoreFile(editions[file]?.url, score.source, extension);
      if (!url) return failure('Chưa tìm thấy tệp bản phổ này.', 404);
      if (extension === 'pdf') return fileResponse(await fetchSheetPdf(url), score.id + '-' + file, 'pdf');
      const response = await fetch(url, {redirect: 'manual', signal: AbortSignal.timeout(12000)});
      if (!response.ok) throw new Error('mxl_unavailable');
      const bytes = await boundedBytes(response, 1800000);
      if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
        throw new Error('not_mxl');
      }
      return fileResponse(bytes, score.id, 'mxl');
    }
    if (fileRequested && file !== 0) return failure('Chưa tìm thấy tệp bản phổ này.', 404);
    if (score.source === 'commons' && score.asset) {
      if (fileRequested) return Response.redirect(new URL('/ban-pho/' + score.asset, request.url), 302);
      return Response.json({
        available: true, files: [{index: 0, name: score.title}],
        credit: [score.author, score.license].filter(Boolean).join(' · '),
      }, {headers: cacheHeaders});
    }
    const edition = await mutopiaEdition(score.id);
    if (fileRequested) {
      if (!edition.pdf) return failure('Bản phổ này được gói trong tệp ZIP ở nguồn.', 404);
      return fileResponse(await fetchSheetPdf(edition.pdf), score.id, 'pdf');
    }
    return Response.json({
      available: !!edition.pdf, files: edition.pdf ? [{index: 0, name: score.title}] : [],
      archive: edition.archive,
      reason: edition.pdf ? '' : 'Nguồn cung cấp tổng phổ và các bè trong một gói ZIP chứa PDF.',
      credit: [score.author, edition.maintainer && 'Bản khắc ' + edition.maintainer, edition.license].filter(Boolean).join(' · '),
    }, {headers: cacheHeaders});
  } catch {
    return failure('Nguồn bản phổ chưa phản hồi. Hãy thử lại hoặc mở trang nguồn.', 502);
  }
}
