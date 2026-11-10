import assert from 'node:assert/strict';
import {testRuntime} from './helpers/runtime.mjs';

const runtime=testRuntime({PUBLIC_SITE_ORIGIN:'https://gochopam.pages.dev'});
const {GET}=await import('../app/robots.txt/route.ts');
const response=GET(new Request('https://backend.test/robots.txt'));
const text=await response.text();
assert.equal(response.status,200);
assert.match(text,/Sitemap: https:\/\/gochopam\.pages\.dev\/sitemap\.xml/);
// Consume the delivered robots rules with RFC-style longest-path precedence.
// The URL matrix verifies that exceptions allow rendering without accidentally
// whitelisting similarly named or nested private routes.
const rules=text.split('\n').map(line=>line.match(/^(Allow|Disallow): (.+)$/)).filter(Boolean).map(([,type,path])=>{
 const end=path.endsWith('$'),pattern=end?path.slice(0,-1):path;
 const escaped=pattern.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return {allow:type==='Allow',length:pattern.length,re:new RegExp('^'+escaped+(end?'$':''))};
});
const allowed=path=>rules.filter(rule=>rule.re.test(path)).sort((a,b)=>b.length-a.length||Number(b.allow)-Number(a.allow))[0]?.allow??true;
for(const path of ['/', '/tai-lieu','/style.css','/live.js','/catalog-seed.json','/sitemap.xml',
 '/api/catalog','/api/catalog?mode=home','/api/catalog?mode=latest','/api/catalog?q=Nang%20tho',
 '/api/settings','/api/songs?q=','/api/songs?id=public-song',
 '/api/reader?url=https%3A%2F%2Fexample.test','/api/public-config','/api/store'])assert.equal(allowed(path),true,path);
for(const path of ['/api/auth','/api/auth?check=1','/api/auth/google','/api/admin','/api/commerce','/api/bookmarks',
 '/api/store?order=PRIVATE','/api/store/download?product=vip864','/api/store/qr?order=PRIVATE',
 '/api/catalog/private','/api/catalog-admin','/api/settings-private','/quan-tri','/tai-khoan','/dang-nhap','/dang-ky'])assert.equal(allowed(path),false,path);

const settings=await import('../app/api/settings/route.ts');
runtime.sql.prepare('INSERT INTO site_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('payment_qr_key','private-payment-location');
const config=await settings.GET();
assert.equal(config.headers.get('x-robots-tag'),'noindex');
assert.deepEqual(Object.keys(await config.json()).sort(),['tagline','title']);
const insert=runtime.sql.prepare('INSERT INTO community_songs(id,title,author,genre,rhythm,key,content,published,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)');
insert.run('visible-song','Bài đã xuất bản','Tác giả','Nhạc','Ballad','C','[C]Bài công khai',1,1,1);
insert.run('private-draft','Bản nháp chưa công bố','Tác giả','Nhạc','Ballad','C','Nội dung chưa công bố',0,1,1);
const songs=await import('../app/api/songs/route.ts');
const list=await songs.GET(new Request('https://backend.test/api/songs?q='));
assert.equal(list.headers.get('x-robots-tag'),'noindex');
assert.deepEqual((await list.json()).items.map(song=>song.id),['visible-song']);
const draft=await songs.GET(new Request('https://backend.test/api/songs?id=private-draft'));
assert.equal(draft.status,404);assert.ok(!(await draft.text()).includes('Nội dung chưa công bố'));
const {storeGet}=await import('../lib/store.ts');
const store=await storeGet(new Request('https://backend.test/api/store'));
const data=await store.json();assert.equal(data.user,null);assert.deepEqual(data.orders,[]);
const auth=await import('../app/api/auth/route.ts');
const guest=await auth.GET(new Request('https://backend.test/api/auth'));
assert.equal(guest.headers.get('x-robots-tag'),'noindex');assert.deepEqual(await guest.json(),{user:null});
console.log('Passed: crawler rendering feeds allowed, private/sibling API URLs still blocked, only published songs and public settings returned, anonymous store has no orders, JSON is noindex and guest auth is unchanged.');
