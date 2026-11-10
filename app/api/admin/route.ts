import {adminGet,adminAction,failure} from '../../../lib/accounts';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return await adminGet(request)}catch(e){return failure(e)}}
export async function POST(request:Request){try{return await adminAction(request)}catch(e){return failure(e)}}
