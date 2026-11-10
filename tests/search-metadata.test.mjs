import assert from 'node:assert/strict';
import {testRuntime} from './helpers/runtime.mjs';
import {hashPassword} from '../lib/passwords.mjs';
import {publicPages,publicSeo,sitemap,verificationToken} from '../lib/search-metadata.mjs';

const runtime=testRuntime({ADMIN_USERNAME:'admin',ADMIN_PASSWORD_HASH:await hashPassword('Test-only-owner-123456')});
const accounts=await import('../lib/accounts.ts'),store=await import('../lib/store.ts');
const home=await import('../app/route.ts');
const post=(data,cookie='')=>new Request('https://music.test/api/commerce',{method:'POST',headers:{Origin:'https://music.test','Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(data)});
const read=(path,cookie='')=>new Request('https://music.test'+path,{headers:{Cookie:cookie}});
const owner=await accounts.authAction(post({action:'login',username:'admin',password:'Test-only-owner-123456'}));
const ownerCookie=owner.headers.get('set-cookie').split(';')[0];
const member=await accounts.authAction(post({action:'register',username:'searchmember',name:'Thành viên thử',password:'Test-only-member-123456'}));
const memberCookie=member.headers.get('set-cookie').split(';')[0];
const tag='<meta name="google-site-verification" content="Test-public-verification_123456" />';
await assert.rejects(()=>store.commerceAction(post({action:'search-verification',verification:tag})),e=>e.status===401);
await assert.rejects(()=>store.commerceAction(post({action:'search-verification',verification:tag},memberCookie)),e=>e.status===403);
await store.commerceAction(post({action:'search-verification',verification:tag},ownerCookie));
assert.equal(await store.option('google_site_verification'),'Test-public-verification_123456');
assert.equal((await(await store.commerceGet(read('/api/commerce',ownerCookie))).json()).googleSiteVerification,'Test-public-verification_123456');
await assert.rejects(()=>store.commerceAction(post({action:'search-verification',verification:'"><script>alert(1)</script>'},ownerCookie)),e=>e.status===400);
assert.throws(()=>verificationToken('1053077701701-test.apps.googleusercontent.com'));
assert.equal(verificationToken(''), '');
const homepage=await home.GET(read('/?utm_source=test'));
const html=await homepage.text();
assert.equal(homepage.status,200);
assert.match(html,/data-membership="guest"/);
assert.match(html,/<meta name="google-site-verification" content="Test-public-verification_123456">/);
assert.match(html,/<link rel="canonical" href="https:\/\/music.test\/">/);
assert.equal((html.match(/<title>/g)||[]).length,1);
assert.equal((html.match(/name="description"/g)||[]).length,1);
const schema=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]+?)<\/script>/)[1]);
assert.equal(schema.name,'Góc Hợp Âm');assert.equal(schema.url,'https://music.test/');
const memberHome=await home.GET(read('/',memberCookie));
assert.equal(memberHome.headers.get('cache-control'),'private, no-store');
assert.match(await memberHome.text(),/data-membership="member"/);
for(const path of Object.keys(publicPages)){
  const result=publicSeo('<html><head><title>old</title><meta name="description" content="old"></head><body>Test</body></html>','https://goc.example'+path+'?tracking=1',path);
  assert.ok(result.includes('href="https://goc.example'+path+'"'));
  assert.ok(result.includes('name="robots" content="index, follow'));
  assert.equal((result.match(/<title>/g)||[]).length,1);
  if(path!=='/')assert.ok(!result.includes('google-site-verification'));
}
const xml=sitemap('https://goc.example/sitemap.xml');
assert.equal((xml.match(/<url>/g)||[]).length,6);
const sitemapUrls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>new URL(match[1]).href);
assert.ok(sitemapUrls.includes(new URL('/gioi-thieu','https://goc.example').href));
assert.ok(sitemapUrls.includes(new URL('/ung-dung/','https://goc.example').href));
assert.ok(!/dang-nhap|quan-tri|tai-khoan|api\//.test(xml));
assert.ok(!xml.includes('chatgpt.site'));
await store.commerceAction(post({action:'search-verification',verification:''},ownerCookie));
assert.ok(!(await(await home.GET(read('/'))).text()).includes('google-site-verification'));
const {publicOrigin}=await import('../lib/public-address.ts');
runtime.env.PUBLIC_SITE_ORIGIN='https://gochopam.pages.dev';
for(const origin of ['https://music.test','https://gochopam.pages.dev']){
 const request=new Request(origin+'/');
 const page=await home.GET(request);
 assert.match(await page.text(),/<link rel="canonical" href="https:\/\/gochopam.pages.dev\/">/);
 assert.equal(page.status,200);assert.equal(page.headers.get('location'),null);
}
for(const [module,path] of [['../app/tai-lieu/route.ts','/tai-lieu'],['../app/huong-dan/route.ts','/huong-dan'],['../app/chinh-sach/route.ts','/chinh-sach']]){
 const {GET}=await import(module);
 assert.ok((await(await GET(read(path))).text()).includes('href="https://gochopam.pages.dev'+path+'"'));
}
const robots=await import('../app/robots.txt/route.ts'),map=await import('../app/sitemap.xml/route.ts');
assert.ok((await(await robots.GET(read('/robots.txt'))).text()).includes('Sitemap: https://gochopam.pages.dev/sitemap.xml'));
assert.ok(!(await(await map.GET(read('/sitemap.xml'))).text()).includes('music.test'));
for(const invalid of ['javascript:alert(1)','http://insecure.example','https://user:password@other.example','https://other.example/path','https://other.example/?q=1']){
 runtime.env.PUBLIC_SITE_ORIGIN=invalid;
 assert.equal(publicOrigin(read('/')),'https://music.test');
}
delete runtime.env.PUBLIC_SITE_ORIGIN;
runtime.env.GOOGLE_SITE_VERIFICATION='Test-runtime-fallback-verification';
assert.ok((await(await home.GET(read('/'))).text()).includes('content="Test-runtime-fallback-verification"'));
assert.equal((await(await store.commerceGet(read('/api/commerce',ownerCookie))).json()).googleSiteVerification,'Test-runtime-fallback-verification');
delete runtime.env.GOOGLE_SITE_VERIFICATION;
console.log('Passed: public SEO and sitemap on current or custom origin, home WebSite schema, owner-only Search Console setting, rejection of injected markup, single title/description, and member cache isolation.');
