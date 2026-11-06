// Bundled original chord exercises + offline search. No live website or server required.
// These are practice exercises, NOT verified transcriptions of existing songs.
const EXERCISES = [
  ['C · Am · F · G', 'C', ['C','Am','F','G']],
  ['G · D · Em · C', 'G', ['G','D','Em','C']],
  ['Am · F · C · G', 'Am', ['Am','F','C','G']],
  ['D · A · Bm · G', 'D', ['D','A','Bm','G']],
  ['F · C · Dm · Bb', 'F', ['F','C','Dm','Bb']],
  ['Em · C · G · D', 'Em', ['Em','C','G','D']],
  ['C · G · Am · Em', 'C', ['C','G','Am','Em']],
  ['A · E · F#m · D', 'A', ['A','E','F#m','D']],
  ['Dm · G · C · Am', 'Dm', ['Dm','G','C','Am']],
  ['G · Em · Am · D', 'G', ['G','Em','Am','D']],
  ['Bb · F · Gm · Eb', 'Bb', ['Bb','F','Gm','Eb']],
  ['E · B · C#m · A', 'E', ['E','B','C#m','A']]
];
export const STARTER_EXERCISES = Object.freeze(EXERCISES.map(([progression,key,chords],i)=>Object.freeze({
  title: 'Bài tập hợp âm '+String(i+1).padStart(2,'0')+' · '+progression,
  author: 'Góc Hợp Âm · Bài tập nguyên bản',
  key,
  genre: 'practice',
  sourceUrl:'local:practice-'+String(i+1).padStart(2,'0'),
  content: chords.map((chord,j)=>'['+chord+']Phách '+(j+1)+' — giữ nhịp, đổi hợp âm, nghe và tập.').join('\n'),
  sheets: {melody:{status:'missing'},piano:{status:'missing'},organ:{status:'missing'}},
  origin:'original_practice'
})));

export function offlineSearchKey(value) {
  return String(value??'').normalize('NFKD').replace(/[đĐ]/g,'d')
    .replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
}
export function offlineFind(saved, url, exercises=STARTER_EXERCISES) {
  if(saved && Object.prototype.hasOwnProperty.call(saved,url)) return saved[url];
  return exercises.find(s=>s.sourceUrl===url)||null;
}
export function offlineSearch(saved, {query='',type='title',genre='',page=0,limit=20}={}, exercises=STARTER_EXERCISES) {
  const safePage=Math.max(0,Math.min(1000,Number.isInteger(Number(page))?Number(page):0));
  const safeLimit=Math.max(1,Math.min(100,Math.trunc(Number(limit)||20)));
  const all=new Map();
  for(const song of Object.values(saved||{})) {
    if(song?.sourceUrl && song?.title) all.set(song.sourceUrl,song);
  }
  for(const song of exercises) if(song?.sourceUrl && !all.has(song.sourceUrl)) all.set(song.sourceUrl,song);
  const q=offlineSearchKey(query);
  const items=[...all.values()].filter(s=>{
    if(genre && genre!=='practice' && String(s.genre||'')!==String(genre))return false;
    if(genre==='practice' && s.genre!=='practice')return false;
    if(!q)return true;
    const title=offlineSearchKey(s.title);
    const author=offlineSearchKey(s.author||s.composer||s.artist||'');
    return type==='composer'||type==='singer' ? author.includes(q):title.includes(q)||author.includes(q);
  }).sort((a,b)=>{
    const ax=a.sourceUrl.startsWith('local:custom-')?0:a.sourceUrl.startsWith('local:')?1:2;
    const bx=b.sourceUrl.startsWith('local:custom-')?0:b.sourceUrl.startsWith('local:')?1:2;
    return ax-bx||String(a.title).localeCompare(String(b.title),'vi');
  });
  const start=safePage*safeLimit;
  return {items:items.slice(start,start+safeLimit),total:items.length,hasMore:start+safeLimit<items.length,page:safePage};
}
