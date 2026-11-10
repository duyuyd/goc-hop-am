import {adminUpload} from '../../../../lib/store-import';
import {failure} from '../../../../lib/accounts';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{return await adminUpload(request)}catch(e){return failure(e)}}
