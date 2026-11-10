import {clean} from './music-catalog.mjs';
import {boundedBytes} from './source-sheets.mjs';
import {singleFlight} from './single-flight.mjs';

const origin = 'https://www.mutopiaproject.org';
export const mutopiaCatalogUrl = origin + '/piece-list.html';
const editions = new Map();

export function parseMutopiaCatalog(html) {
  const items = new Map();
  for (const [, row] of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(match => match[1]);
    if (cells.length !== 4) continue;
    const number = cells[1].match(/href=["'](?:\.\.\/|\/)?cgibin\/piece-info\.cgi\?id=(\d+)["']/i)?.[1];
    const title = clean(cells[1]);
    if (!number || !title) continue;
    const id = 'mutopia-' + number;
    items.set(id, {
      id, title, author: clean(cells[0]), opus: clean(cells[2]),
      instrument: clean(cells[3]), source: 'mutopia', format: 'pdf',
    });
  }
  return [...items.values()];
}

export function mutopiaEditionUrl(id) {
  const number = /^mutopia-(\d{1,8})$/.exec(id)?.[1];
  if (!number) throw new Error('invalid_mutopia_id');
  return origin + '/cgibin/piece-info.cgi?id=' + number;
}

function mutopiaFileUrl(value) {
  try {
    const url = new URL(value, origin);
    if (url.origin === origin && !url.username && !url.password && !url.search && !url.hash &&
        /^\/ftp\/(?:[A-Za-z0-9_.%-]+\/)+[A-Za-z0-9_.%-]+\.(?:pdf|zip)$/i.test(url.pathname)) return url.href;
  } catch {}
  return null;
}

export function parseMutopiaEdition(html) {
  const copyright = html.match(/<b>\s*Copyright:\s*<\/b>([\s\S]*?)<\/td>/i)?.[1] || '';
  const license = clean(copyright);
  if (!/^(?:Public Domain|Creative Commons Attribution(?:[- ]ShareAlike)? [1-4]\.\d)$/i.test(license)) {
    throw new Error('unknown_score_license');
  }
  const links = [...html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map(([, url, label]) => ({url: mutopiaFileUrl(url), label: clean(label)}))
    .filter(({url, label}) => url && /^(?:A4|Letter) \.?PDF\b/i.test(label));
  const findFile = extension => links.find(({url, label}) => url.toLowerCase().endsWith(extension) && /^A4\b/i.test(label))?.url ||
    links.find(({url}) => url.toLowerCase().endsWith(extension))?.url;
  const pdf = findFile('.pdf'), archive = findFile('.zip');
  if (!pdf && !archive) throw new Error('missing_score_pdf');
  const maintainer = clean(html.match(/<b>\s*Maintainer:\s*<\/b>([\s\S]*?)<\/td>/i)?.[1] || '');
  return {pdf, archive, license, maintainer};
}

export async function mutopiaEdition(id, fetcher = fetch) {
  const url = mutopiaEditionUrl(id);
  const cached = editions.get(id);
  if (cached?.until > Date.now()) return cached.data;
  return singleFlight('open-sheet:' + id, async () => {
    const response = await fetcher(url, {
      headers: {Accept: 'text/html'}, redirect: 'manual', signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('score_source_unavailable');
    const html = new TextDecoder().decode(await boundedBytes(response, 180000));
    const data = parseMutopiaEdition(html);
    editions.set(id, {data, until: Date.now() + 3600000});
    if (editions.size > 120) editions.delete(editions.keys().next().value);
    return data;
  });
}
