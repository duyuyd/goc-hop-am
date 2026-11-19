import { env } from 'cloudflare:workers';
import { catalog,sourceFor } from '../../../lib/music-catalog.mjs';
import { savedCatalogSearch } from '../../../lib/catalog-search.mjs';
import { searchCommunityCatalog } from '../../../lib/community-catalog.mjs';
import { musicSnapshot } from '../../../lib/music-cache.mjs';
import { foldText } from '../../../public/text.js';
import {publicLimit} from '../../../lib/security';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
 const limited=publicLimit(request,'catalog',180);if(limited)return limited;
 const params=new URL(request.url).searchParams,source=sourceFor(params),keyUrl=new URL(source.url);
 if(source.q)keyUrl.searchParams.set('song',foldText(source.q));
 const headers={'X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex'};
 const ownedSearch=searchCommunityCatalog(env.DB,source);
 const importedSearch=source.q&&env.DB?env.DB.prepare("SELECT slug,title,artist FROM songs WHERE title LIKE ? OR artist LIKE ? ORDER BY created_at DESC LIMIT 40").bind('%'+source.q+'%','%'+source.q+'%').all().then(rows=>(rows.results||[]).map((r:any)=>({id:'goc-import-'+r.slug,url:'goc-import:'+r.slug,title:r.title,author:r.artist,singer:'',local:true}))).catch(error=>{console.warn('Imported D1 catalogue unavailable',error instanceof Error?error.name:'unknown');return [];}):Promise.resolve([]);
 let data;
 try {
  data=env.DB?await musicSnapshot(env.DB,'catalog:'+keyUrl.href,()=>catalog(params)):await catalog(params);
 } catch (error) {
  console.error('Catalogue retrieval failed:',error instanceof Error?error.message:'unknown');
 }
 const owned=await ownedSearch;
 const imported=await importedSearch;
 if (!data?.items?.length) {
  const items=[...imported,...owned,...await savedCatalogSearch(env.DB,source)];
  if(items.length)return Response.json({items,total:items.length,hasMore:false,page:source.page,query:source.q,type:source.type,fallback:!data||data.stale?'unavailable':'nearby'},
   {headers:{...headers,'Cache-Control':'no-store'}});
 }
 if (!data)return Response.json({error:'Kho bài hát chưa phản hồi. Vui lòng thử lại sau.'},{status:502,headers:{...headers,'Cache-Control':'no-store'}});
 if (imported.length||owned.length)return Response.json({...data,items:[...imported,...owned,...data.items],total:data.total==null?null:data.total+owned.length+imported.length},
  {headers:{...headers,'Cache-Control':'no-store'}});
 return Response.json(data,{headers:{...headers,'Cache-Control':data.stale?'no-store':'public, max-age=60'}});
}
