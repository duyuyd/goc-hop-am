import {createHash} from 'node:crypto';
import {mkdir, readFile, rename, writeFile} from 'node:fs/promises';
import {parseMutopiaCatalog, mutopiaCatalogUrl} from '../lib/open-sheet-source.mjs';
import {boundedBytes} from '../lib/source-sheets.mjs';
import {openScoreSources, parseOpenScoreCatalog} from '../lib/openscore-catalog.mjs';

const output = new URL('../public/ban-pho/', import.meta.url);
const catalogPath = new URL('catalog.json', output);
const agent = 'GocHopAm/1.4 (https://goc-hop-am.onwardcrust.chatgpt.site/)';
const approved = [
  {number: 112338058, title: 'Con thuyền không bến', author: 'Đặng Thế Phong', license: 'Public domain', format: 'pdf'},
  {number: 112342295, title: 'Bài trống chào cờ', author: 'Hội đồng Đội Trung ương', license: 'Public domain', format: 'pdf', instrument: 'Trống'},
  {number: 122753040, title: 'Kinh Thương Xót (Kyrie)', author: 'Tom Mai', license: 'CC BY-SA 4.0', format: 'png'},
  {number: 122753039, title: 'Kinh Chiên Thiên Chúa (Agnus Dei)', author: 'Tom Mai', license: 'CC BY-SA 4.0', format: 'png'},
  {number: 122753041, title: 'Kinh Vinh Danh (Gloria)', author: 'Tom Mai', license: 'CC BY-SA 4.0', format: 'png'},
  {number: 122753045, title: 'Thánh Thánh Thánh (Sanctus)', author: 'Tom Mai', license: 'CC BY-SA 4.0', format: 'png'},
  {number: 177210573, title: 'Kinh Thương Xót trong Lễ Cầu Hồn', author: 'Tom Mai', license: 'CC BY 4.0', format: 'png'},
];

async function readSource(url, maximum) {
  const response = await fetch(url, {
    headers: {'User-Agent': agent}, redirect: 'error', signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error('Nguồn trả về HTTP ' + response.status + ' cho ' + new URL(url).hostname);
  return boundedBytes(response, maximum);
}

async function readVietnameseScores() {
  const request = new URL('https://commons.wikimedia.org/w/api.php');
  request.search = new URLSearchParams({
    action: 'query', pageids: approved.map(item => item.number).join('|'), prop: 'imageinfo',
    iiprop: 'url|mime|extmetadata|size|sha1', iiextmetadatafilter: 'LicenseShortName|LicenseUrl',
    format: 'json', formatversion: '2',
  });
  const json = JSON.parse(new TextDecoder().decode(await readSource(request, 160000)));
  const files = new Map(json.query?.pages?.map(page => [page.pageid, page]));
  const result = [];
  for (const {number, title, author, license, format, instrument} of approved) {
    const entry = files.get(number);
    const info = entry?.imageinfo?.[0];
    if (!info || info.extmetadata?.LicenseShortName?.value !== license ||
        info.mime !== (format === 'pdf' ? 'application/pdf' : 'image/png')) {
      throw new Error('Thông tin tệp hoặc giấy phép đã đổi ở Commons #' + number);
    }
    const url = new URL(info.url);
    const source = new URL(info.descriptionurl);
    const licenseUrl = new URL(info.extmetadata.LicenseUrl?.value || 'https://creativecommons.org/publicdomain/mark/1.0/');
    if (url.origin !== 'https://upload.wikimedia.org' || !url.pathname.startsWith('/wikipedia/commons/') ||
        source.origin !== 'https://commons.wikimedia.org' || licenseUrl.hostname !== 'creativecommons.org') {
      throw new Error('Đường dẫn nguồn đã đổi ở Commons #' + number);
    }
    url.search = '';
    const id = 'commons-' + number;
    const oldAsset = /^[a-f0-9]{40}$/.test(info.sha1 || '') ?
      new URL('files/' + id + '-' + info.sha1.slice(0, 10) + '.' + format, output) : null;
    const cached = oldAsset ? await readFile(oldAsset).catch(error => {
      if (error.code === 'ENOENT') return null;
      throw error;
    }) : null;
    const bytes = cached && createHash('sha1').update(cached).digest('hex') === info.sha1 ?
      cached : await readSource(url, 1500000);
    const sha1 = createHash('sha1').update(bytes).digest('hex');
    const signature = format === 'pdf' ? Buffer.from('%PDF-') : Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    if (bytes.length !== info.size || (info.sha1 && sha1 !== info.sha1) ||
        !Buffer.from(bytes.subarray(0, signature.length)).equals(signature)) {
      throw new Error('Tệp không khớp nguồn ở Commons #' + number);
    }
    const asset = 'files/' + id + '-' + sha1.slice(0, 10) + '.' + format;
    result.push({id, title, author, source: 'commons', sourceUrl: source.href,
      instrument: instrument || (format === 'pdf' ? 'Giai điệu & lời' : 'Bình ca'),
      format, license, licenseUrl: licenseUrl.href, asset, bytes});
  }
  return result;
}

const [html, vietnamese, liederHtml, quartetHtml, orchestraHtml] = await Promise.all([
  readSource(mutopiaCatalogUrl, 1800000), readVietnameseScores(),
  readSource(openScoreSources.lieder.index, 3000000), readSource(openScoreSources.quartets.index, 3000000),
  readSource(openScoreSources.orchestra.index, 1500000),
]);
const listing = new TextDecoder().decode(html);
const mutopia = parseMutopiaCatalog(listing);
const expected = [...listing.matchAll(/href=["'](?:\.\.\/|\/)?cgibin\/piece-info\.cgi\?id=(\d+)["']/gi)];
const old = await readFile(catalogPath, 'utf8').then(JSON.parse).catch(error => {
  if (error.code === 'ENOENT') return {items: []};
  throw error;
});
const lieder = parseOpenScoreCatalog(new TextDecoder().decode(liederHtml), 'lieder');
const quartets = parseOpenScoreCatalog(new TextDecoder().decode(quartetHtml), 'quartets');
const orchestraListing = new TextDecoder().decode(orchestraHtml);
const orchestra = parseOpenScoreCatalog(orchestraListing, 'orchestra');
const fullScores = new Set([...orchestraListing.matchAll(/<a\b[^>]*\bhref=["']([^"']+\.mxl)["'][^>]*>\s*\.mxl\s*<\/a>/gi)].map(match => match[1]));
const catalog = {items: [...vietnamese.map(({bytes, ...item}) => item), ...mutopia, ...lieder, ...quartets, ...orchestra]};
const ids = new Set(catalog.items.map(item => item.id));
if (mutopia.length < 1000 || mutopia.length !== new Set(expected.map(match => match[1])).size ||
    lieder.length < 1200 || quartets.length < 160 || orchestra.length < 80 || orchestra.length !== fullScores.size ||
    ids.size !== catalog.items.length ||
    old.items.some(item => !ids.has(item.id))) {
  throw new Error('Danh mục nguồn có dấu hiệu thiếu mục. Giữ bản dữ liệu trước để kiểm tra.');
}
await mkdir(new URL('files/', output), {recursive: true});
for (const {asset, bytes} of vietnamese) await writeFile(new URL(asset, output), bytes);
const draft = new URL('catalog.json.tmp', output);
await writeFile(draft, '{"items":[\n' + catalog.items.map(item => JSON.stringify(item)).join(',\n') + '\n]}\n');
await rename(draft, catalogPath);
console.log(`Đã đồng bộ ${catalog.items.length} bản phổ gồm ${vietnamese.length} tiếng Việt, ${mutopia.length} cổ điển, ${lieder.length} thanh nhạc, ${quartets.length} tứ tấu và ${orchestra.length} tổng phổ dàn nhạc.`);
