import {storeGet,storeAction} from '../../../lib/store';
import {failure} from '../../../lib/accounts';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return await storeGet(request)}catch(e){return failure(e)}}
export async function POST(request:Request){try{return await storeAction(request)}catch(e){return failure(e)}}
