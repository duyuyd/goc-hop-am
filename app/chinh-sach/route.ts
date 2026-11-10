import {infoPage,pageResponse} from '../../lib/store-pages';
import {publicSeo} from '../../lib/search-metadata.mjs';
import {publicOrigin} from '../../lib/public-address';
export async function GET(request:Request){return pageResponse(publicSeo(infoPage('privacy'),publicOrigin(request),'/chinh-sach'))}
