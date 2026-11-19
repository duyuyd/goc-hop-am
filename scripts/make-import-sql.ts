import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

type Song = {
  source_id:string; source_url:string; slug:string; title:string; artist:string;
  chords_text:string; lyrics_text:string; source_name:string;
};
const songs = (JSON.parse(await readFile('artifacts/songs_import.json', 'utf8')) as { songs: Song[] }).songs;
if (!Array.isArray(songs) || songs.length < 5) throw new Error('Missing source records');
const quote = (s:string) => "'" + s.replaceAll("'", "''") + "'";
const sql:string[] = [
  'CREATE TABLE IF NOT EXISTS song_sources (slug TEXT PRIMARY KEY, source_id TEXT NOT NULL UNIQUE, source_url TEXT NOT NULL, imported_at INTEGER NOT NULL);'
];
const slugs = new Set<string>();
for (const song of songs) {
  if (Object.values(song).some(v => typeof v !== 'string') ||
      !/^[A-Za-z0-9]+$/.test(song.source_id) ||
      song.slug !== 'hav-' + song.source_id.toLowerCase() ||
      !song.source_url.startsWith('https://hopamviet.vn/chord/song/') ||
      !song.source_url.endsWith('/' + song.source_id + '.html') ||
      song.chords_text.length <= 50 || song.lyrics_text.length <= 50 ||
      !song.title.trim() || slugs.has(song.slug)) throw new Error('Invalid provenance: ' + song.source_id);
  slugs.add(song.slug);
  const values = [
    quote('hopamviet-' + song.source_id), quote(song.title), quote(song.artist),
    quote(song.slug), quote(song.chords_text), quote(song.lyrics_text), '0', 'NULL',
    quote(song.source_name), String(Date.now()),
  ];
  sql.push('INSERT INTO songs(id,title,artist,slug,chords_text,lyrics_text,has_pdf,pdf_url,source_name,created_at) VALUES (' +
    values.join(',') + ') ON CONFLICT(slug) DO UPDATE SET title=excluded.title,artist=excluded.artist,chords_text=excluded.chords_text,lyrics_text=excluded.lyrics_text,source_name=excluded.source_name;');
  sql.push('INSERT INTO song_sources(slug,source_id,source_url,imported_at) VALUES (' +
    [quote(song.slug),quote(song.source_id),quote(song.source_url),String(Date.now())].join(',') +
    ') ON CONFLICT(slug) DO UPDATE SET imported_at=excluded.imported_at WHERE song_sources.source_id=excluded.source_id AND song_sources.source_url=excluded.source_url;');
}
const output = sql.join('\n') + '\n';
await writeFile('songs_import.sql', output);
console.log('SQL SHA256=' + createHash('sha256').update(output).digest('hex'));
console.log('Records=' + songs.length + ' source_ids=' + songs.slice(0, 5).map(s => s.source_id).join(','));
