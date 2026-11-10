import {db,json,failure} from '../../../lib/accounts';
import {readCommunitySong} from '../../../lib/community-catalog.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const params=new URL(request.url).searchParams,id=params.get('id');if(id){const song=await readCommunitySong(db(),id.slice(0,80));return song?json({song}):json({error:'Không tìm thấy bài hát.'},404)}const q=(params.get('q')||'').slice(0,120);const result=await db().prepare('SELECT id,title,author,genre,rhythm,key FROM community_songs WHERE published=1 AND (title LIKE ? OR author LIKE ?) ORDER BY updated_at DESC LIMIT 50').bind('%'+q+'%','%'+q+'%').all();return json({items:result.results||[]})}catch(e){return failure(e)}}
