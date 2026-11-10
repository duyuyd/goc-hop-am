import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rankSavedCatalog } from '../lib/catalog-search.mjs';
import { sourceFor } from '../lib/music-catalog.mjs';
import { testRuntime } from './helpers/runtime.mjs';

const nangTho = {
  title: 'Nàng thơ', author: 'Hoàng Dũng', singer: 'Hoàng Dũng',
  url: 'https://hopamviet.vn/chord/song/nang-tho/W8IU6E0B.html',
};
const haTrang = {
  title: 'Hạ trắng', author: 'Trịnh Công Sơn', singer: 'Khánh Ly',
  url: 'https://hopamviet.vn/chord/song/ha-trang/W8IU0FE9.html',
};

test('saved catalogue handles NFC/NFD, accent folding and one adjacent transposition', () => {
  for (const q of ['Nàng thơ', 'Nàng thơ'.normalize('NFD'), 'Nang tho', 'Nagn tho']) {
    const found = rankSavedCatalog([nangTho, haTrang, { ...nangTho, content: 'private lyrics' }], { q, type: 'title' });
    assert.deepEqual(found.map(x => x.id), ['W8IU6E0B']);
    assert.ok(!('content' in found[0]));
  }
  assert.equal(sourceFor(new URLSearchParams({ q: 'Nàng thơ'.normalize('NFD') })).q, 'Nàng thơ');
  assert.equal(rankSavedCatalog([nangTho, haTrang], { q: 'Khanh Ly', type: 'singer' })[0].title, 'Hạ trắng');
  assert.equal(rankSavedCatalog([nangTho, haTrang], { q: 'Trinh Cong Son', type: 'composer' })[0].title, 'Hạ trắng');
  assert.deepEqual(rankSavedCatalog([nangTho, haTrang], { q: 'Khanh Ly', type: 'title' }), []);
  assert.deepEqual(rankSavedCatalog([nangTho, haTrang], { q: 'qzzzz never existed', type: 'title' }), []);
  assert.deepEqual(rankSavedCatalog([{ ...nangTho, url: 'https://example.com/chord/song/nang-tho/W8IU6E0B.html' }], { q: 'Nàng thơ', type: 'title' }), []);
});

test('catalogue GET falls back to stored D1 items, without inventing hits or replacing saved snapshots', async () => {
  const { sql } = testRuntime();
  const { GET } = await import('../app/api/catalog/route.ts');
  const reader = (await import('../app/api/reader/route.ts')).GET;
  const insert = sql.prepare('INSERT INTO music_cache(key,payload,updated_at) VALUES(?,?,?)');
  insert.run('reader:v2:' + nangTho.url, JSON.stringify({ song: { ...nangTho, sourceUrl: nangTho.url, content: '[C] Lyrics' } }), 10);
  insert.run('catalog:malformed', '{invalid', 20);
  const oldFetch = globalThis.fetch;
  let upstreamStatus = 200;
  globalThis.fetch = async () => new Response('<p>Không tìm thấy</p>', { status: upstreamStatus });
  const get = (q, page = 0) => GET(new Request('https://test.example/api/catalog?' + new URLSearchParams({ q, page })));
  try {
    const near = await get('Nagn tho');
    assert.equal(near.status, 200);
    assert.equal(near.headers.get('cache-control'), 'no-store');
    const data = await near.json();
    assert.equal(data.fallback, 'nearby');
    assert.equal(data.items[0].title, 'Nàng thơ');
    assert.ok(!('content' in data.items[0]));
    assert.deepEqual((await (await get('Nagn tho', 1)).json()).items, []);

    upstreamStatus = 503;
    const saved = await (await get('Nàng thơ')).json();
    assert.equal(saved.fallback, 'unavailable');
    assert.equal(saved.items[0].id, 'W8IU6E0B');
    assert.equal((await get('qzzzz never existed')).status, 502);
    const before = sql.prepare("SELECT payload FROM music_cache WHERE key LIKE 'reader:v2:%'").get();
    assert.equal(JSON.parse(before.payload).song.content, '[C] Lyrics');

    const addOwn = sql.prepare("INSERT INTO community_songs(id,title,author,genre,rhythm,key,content,published,created_at,updated_at) VALUES (?,?,?,'','', 'C',?,?,10,10)");
    addOwn.run('own-42','Nàng thơ bên hiên','Tác giả kho riêng','[C]Bản hợp âm nội bộ',1);
    addOwn.run('private-43','Nàng thơ bản nháp','Tác giả kho riêng','[G]Chưa xuất bản',0);
    const blended = await get('Nagn tho');
    const blend = await blended.json();
    assert.equal(blended.headers.get('cache-control'),'no-store');
    assert.equal(blend.items[0].id,'goc-own-42');
    assert.equal(blend.items[0].url,'goc-song:own-42');
    assert.ok(blend.items.some(item=>item.id==='W8IU6E0B'));
    assert.ok(!blend.items.some(item=>item.id==='goc-private-43'));
    assert.ok(!('content' in blend.items[0]));

    const read = id=>reader(new Request('https://test.example/api/reader?'+new URLSearchParams({id})));
    const opened=await read('own-42');
    assert.equal(opened.headers.get('cache-control'),'no-store');
    assert.equal((await opened.json()).song.content,'[C]Bản hợp âm nội bộ');
    assert.equal((await read('private-43')).status,404);
    assert.equal((await read('../admin')).status,400);
  } finally {
    globalThis.fetch = oldFetch;
  }
});
