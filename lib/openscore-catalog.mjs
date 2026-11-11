import {clean} from './music-catalog.mjs';

const rawOrigin = 'https://raw.githubusercontent.com';
export const openScoreSources = {
  lieder: {
    name: 'OpenScore Lieder', repository: 'Lieder',
    index: 'https://fourscoreandmore.org/openscore/lieder/',
    instrument: 'Giọng hát & piano',
  },
  quartets: {
    name: 'OpenScore Tứ tấu', repository: 'StringQuartets',
    index: 'https://fourscoreandmore.org/openscore/stringquartets/',
    instrument: 'Tứ tấu dây',
  },
};

export function openScoreFile(value, source, extension) {
  const collection = openScoreSources[source];
  if (!collection || !value) return null;
  try {
    const url = new URL(value.replace(/&amp;/g, '&'));
    const prefix = '/OpenScore/' + collection.repository + '/';
    if (url.origin !== rawOrigin || url.username || url.password || url.hash ||
        !['refs/heads/main/scores/', 'main/scores/'].some(path => url.pathname.startsWith(prefix + path)) ||
        !url.pathname.toLowerCase().endsWith('.' + extension)) return null;
    url.search = '';
    return url.href;
  } catch {
    return null;
  }
}

function linkedFiles(cell, source, extension) {
  const files = [];
  for (const [, href, label] of cell.matchAll(/<a\b[^>]*?\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = openScoreFile(href, source, extension);
    if (url && !files.some(file => file.url === url)) files.push({url, name: clean(label)});
  }
  return files;
}

export function parseOpenScoreCatalog(html, source) {
  if (!Object.hasOwn(openScoreSources, source)) throw new Error('unknown_openscore_source');
  const lieder = source === 'lieder', extension = lieder ? 'mxl' : 'pdf';
  const items = new Map();
  for (const [, row] of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(match => match[1]);
    if (cells.length !== (lieder ? 7 : 8)) continue;
    const file = linkedFiles(cells[5], source, extension)[0];
    if (!file) continue;
    const number = lieder ? /\/lc(\d+)\.mxl$/i.exec(new URL(file.url).pathname)?.[1] : clean(cells[3]);
    const title = clean(cells[2]);
    if (!/^\d{1,12}$/.test(number || '') || !title) continue;
    const id = source + '-' + number;
    const score = {
      id, title, author: lieder ? clean(cells[0]) : [clean(cells[1]), clean(cells[0])].filter(Boolean).join(' '),
      instrument: openScoreSources[source].instrument, source, format: extension, file: file.url,
    };
    if (lieder) {
      score.opus = clean(cells[1]).replace(/^—$/, '');
      score.lyricist = clean(cells[3]);
    } else {
      score.parts = linkedFiles(cells[6], source, 'pdf').slice(0, 12).map(part => ({
        ...part, name: part.name.replaceAll('_', ' '),
      }));
    }
    items.set(id, score);
  }
  return [...items.values()];
}
