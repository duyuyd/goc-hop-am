import {commerceGet,commerceAction} from '../../../lib/store';
import {failure} from '../../../lib/accounts';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return await commerceGet(request)}catch(e){return failure(e)}}
export async function POST(request:Request){try{return await commerceAction(request)}catch(e){return failure(e)}}
