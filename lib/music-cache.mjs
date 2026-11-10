// Durable read-through snapshots. Failed retrievals never replace a valid copy.
export async function musicSnapshot(database, key, retrieve, {ttl = 300000, now = Date.now()} = {}) {
  let saved;
  try {
    const row = await database.prepare('SELECT payload,updated_at FROM music_cache WHERE key=?').bind(key).first();
    if (row) {
      const data = JSON.parse(row.payload);
      if (data && typeof data === 'object' && !Array.isArray(data)) saved = {data, at:row.updated_at};
    }
  } catch (error) { console.warn('Music snapshot read unavailable:', error?.name || 'Error'); }
  if (saved && now - saved.at < ttl) return {...saved.data, persisted:true, cachedAt:new Date(saved.at).toISOString(), stale:false};
  try {
    const data = await retrieve();
    const payload = JSON.stringify(data);
    if (payload.length <= 300000) {
      try {
        await database.prepare('INSERT INTO music_cache(key,payload,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at').bind(key,payload,now).run();
      } catch (error) { console.warn('Music snapshot write unavailable:', error?.name || 'Error'); }
    }
    return {...data, cachedAt:new Date(now).toISOString(), stale:false};
  } catch (error) {
    if (saved) return {...saved.data, persisted:true, cachedAt:new Date(saved.at).toISOString(), stale:true};
    throw error;
  }
}
