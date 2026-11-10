import { decodeEntities } from '../public/text.js';
import { songSearchField, songSearchKey, songTextRank } from '../public/mobile/logic.js';
import seed from '../public/catalog-seed.json' with { type: 'json' };
import { safeSongUrl } from './music-catalog.mjs';

const normalize = value => songSearchKey(decodeEntities(value));

export function rankSavedCatalog(candidates, { q, type }) {
  const query = normalize(q);
  if (query.length < 2) return [];
  const field = songSearchField(type);
  const matches = new Map();
  for (const song of candidates) {
    if (typeof song?.title !== 'string' || !song.title || song.title.length > 400) continue;
    const url = safeSongUrl(song.sourceUrl || song.url);
    if (!url || typeof song[field] !== 'string' || song[field].length > 400) continue;
    const score = songTextRank(query, normalize(song[field]));
    if (!score) continue;
    const id = url.split('/').at(-1).slice(0, -5);
    if (matches.has(id) && matches.get(id).score <= score) continue;
    matches.set(id, { score, item: {
      id, url, title: song.title,
      author: typeof song.author === 'string' ? song.author.slice(0, 400) : '',
      singer: typeof song.singer === 'string' ? song.singer.slice(0, 400) : '',
      thumbnail: typeof song.thumbnail === 'string' && /^https:\/\/(?:i|img)\.youtube\.com\/vi\/[\w-]{11}\/[\w-]+\.jpg$/.test(song.thumbnail) ? song.thumbnail : null,
    } });
  }
  return [...matches.values()]
    .sort((a, b) => a.score - b.score || a.item.title.localeCompare(b.item.title, 'vi') || a.item.id.localeCompare(b.item.id))
    .slice(0, 30).map(({ item }) => item);
}

export async function savedCatalogSearch(database, source) {
  if (!source.q || source.page !== 0) return [];
  const candidates = [...seed.items];
  if (database) {
    try {
      const { results } = await database.prepare(`SELECT payload FROM music_cache
        WHERE (key LIKE 'catalog:%' OR key LIKE 'reader:v2:%') AND length(payload) <= 300000
        ORDER BY updated_at DESC LIMIT 24`).all();
      for (const row of results) {
        let data;
        try { data = JSON.parse(row.payload); } catch { continue; }
        if (Array.isArray(data?.items)) candidates.push(...data.items.slice(0, 80));
        if (data?.song) candidates.push(data.song);
      }
    } catch (error) {
      console.warn('Saved catalogue search unavailable:', error?.name || 'Error');
    }
  }
  return rankSavedCatalog(candidates, source);
}
