import {downloadProduct} from '../../../../lib/store';
import {failure} from '../../../../lib/accounts';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return await downloadProduct(request)}catch(e){return failure(e)}}
