import {shopPage,pageResponse} from '../../lib/store-pages';
import {publicSeo} from '../../lib/search-metadata.mjs';
import {publicOrigin} from '../../lib/public-address';
export const dynamic='force-dynamic';
export async function GET(request:Request){return pageResponse(publicSeo(shopPage(),publicOrigin(request),'/tai-lieu'))}
