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
  orchestra: {
    index: 'https://fourscoreandmore.org/openscore/orchestra/',
    instrument: 'Dàn nhạc',
  },
};

export function openScoreFile(value, source, extension) {
  const collection = openScoreSources[source];
  if (!collection || !value) return null;
  try {
    let url = new URL(value.replace(/&amp;/g, '&'));
    if (url.username || url.password || url.hash) return null;
    if (source === 'orchestra') {
      const project = '/MarkGotham/Hauptstimme/';
      const published = project + 'blob/main/data/';
      if (url.origin === 'https://github.com' && url.pathname.startsWith(published)) {
        url = new URL(rawOrigin + project + 'main/data/' + url.pathname.slice(published.length));
      }
      if (url.origin !== rawOrigin || !url.pathname.startsWith(project + 'main/data/') ||
          extension !== 'mxl' || !url.pathname.toLowerCase().endsWith('.mxl')) return null;
      url.search = '';
      return url.href;
    }
    const prefix = '/OpenScore/' + collection.repository + '/';
    if (url.origin !== rawOrigin ||
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
  const lieder = source === 'lieder', orchestra = source === 'orchestra';
  const extension = source === 'quartets' ? 'pdf' : 'mxl';
  const items = new Map();
  for (const [, row] of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(match => match[1]);
    if (cells.length !== (orchestra ? 6 : lieder ? 7 : 8)) continue;
    const file = linkedFiles(cells[orchestra ? 4 : 5], source, extension)[0];
    if (!file) continue;
    if (orchestra) {
      const author = clean(cells[0]), work = clean(cells[1]), movement = clean(cells[2]);
      const stem = new URL(file.url).pathname.split('/').at(-1).slice(0, -4);
      const id = 'orchestra-' + stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
      if (!author || !work || !movement || id === 'orchestra-') continue;
      const melody = linkedFiles(cells[5], source, 'mxl')[0];
      const parts = melody && melody.url !== file.url ? [{url: melody.url, name: 'Giai điệu'}] : [];
      items.set(id, {id, title: work + ' · Chương ' + movement, author,
        instrument: openScoreSources.orchestra.instrument, source, format: extension, file: file.url, parts});
      continue;
    }
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
