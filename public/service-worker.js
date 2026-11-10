// Cache static shells and public assets. Never store account pages or API responses.
const CACHE='goc-music-1.4.0-r5';
const ASSETS=[
 '/live.html','/live.js?v=144','/live.css?v=16','/mobile.css?v=16','/premium.css?v=16','/style.css?v=7',
 '/member.js?v=4','/member.css?v=4','/shop.css?v=2','/studio.css?v=121','/player.css?v=140','/identity.css?v=143','/music-tools.css?v=143',
 '/install-app.js','/guest-ads.js?v=1','/catalog-seed.json','/chords.js','/reader-format.js','/text.js','/entities.js','/youtube.js','/inline-player.js?v=140',
 '/mobile/follow.js?v=140','/mobile/follow.js','/mobile/pitch.js?v=143','/mobile/sheet-input.js','/mobile/score-pdf.js','/mobile/studio.js?v=121','/mobile/logic.js?v=142','/mobile/music-tools.js?v=143','/mobile/song-sheet.js?v=142',
 '/mobile/index.html','/mobile/bundle.js?v=144','/mobile/app.css?v=143','/mobile/icon.svg','/app-icon-192.png','/app-icon-512.png','/favicon.svg','/manifest.webmanifest',
];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('goc-music-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
async function navigationResponse(request,offlineShell){
 let response;
 try{response=await fetch(request);if(response.status<500)return response;}catch{}
 const cached=await caches.match(offlineShell);
 if(!cached)return response||Response.error();
 return new Response(cached.body,{headers:{
  'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
  'Content-Security-Policy':"frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com; object-src 'none'; base-uri 'self'",
 }});
}
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
 if(event.request.mode==='navigate'){
  const shell=url.pathname==='/'?'/live.html':['/mobile/','/mobile/index.html'].includes(url.pathname)?'/mobile/index.html':null;
  if(shell){event.respondWith(navigationResponse(event.request,shell));return;}
 }
 if(ASSETS.includes(url.pathname+url.search))event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request)));
});
