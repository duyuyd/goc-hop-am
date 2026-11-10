import {publicOrigin} from '../../lib/public-address';

// These anonymous GET feeds supply visible page content. Keep the surrounding
// API namespace blocked, including auth, orders, downloads and admin actions.
const renderFeeds=['/api/catalog','/api/settings','/api/songs','/api/reader','/api/public-config'];
export function GET(request:Request){
 const rules=[
  'User-agent: *',
  'Allow: /',
  'Disallow: /api/',
  ...renderFeeds.flatMap(path=>['Allow: '+path+'$','Allow: '+path+'?']),
  // Only the product-list URL without an order query is a crawlable feed.
  'Allow: /api/store$',
  'Disallow: /quan-tri',
  'Disallow: /tai-khoan',
  'Disallow: /dang-nhap',
  'Disallow: /dang-ky',
  'Sitemap: '+new URL('/sitemap.xml',publicOrigin(request)).href,
 ];
 return new Response(rules.join('\n')+'\n',{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'public, max-age=300'}});
}
