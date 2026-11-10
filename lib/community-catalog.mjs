import { communitySongRef, songReferenceId, songSearchField, songSearchKey, songTextRank } from '../public/mobile/logic.js';

export async function readCommunitySong(database, id) {
  return database.prepare('SELECT id,title,author,genre,rhythm,key,content FROM community_songs WHERE id=? AND published=1').bind(id).first();
}

export async function searchCommunityCatalog(database, { q, type, page }) {
  const query = songSearchKey(q);
  if (!database || !query || page !== 0 || type === 'singer') return [];
  try {
    const { results } = await database.prepare(`SELECT id,title,author FROM community_songs
      WHERE published=1 ORDER BY updated_at DESC,id LIMIT 400`).all();
    const field = songSearchField(type);
    const matches = [];
    for (const row of results) {
      const url = communitySongRef(row.id);
      const rank = songTextRank(query, songSearchKey(row[field]));
      if (url && rank) matches.push({ rank, song: { id: songReferenceId(url), url, title: row.title, author: row.author, local: true } });
    }
    return matches.sort((a,b) => a.rank-b.rank).slice(0,20).map(match => match.song);
  } catch (error) {
    console.warn('Community catalogue unavailable:', error?.name || 'Error');
    return [];
  }
}
