import {sitemap} from '../../lib/search-metadata.mjs';
import {publicOrigin} from '../../lib/public-address';
export function GET(request:Request){return new Response(sitemap(publicOrigin(request)),{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=3600'}})}
