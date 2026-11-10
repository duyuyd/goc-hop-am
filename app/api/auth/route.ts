import {getAccount,authAction,json,failure} from '../../../lib/accounts';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return json({user:await getAccount(request)})}catch(e){return failure(e)}}
export async function POST(request:Request){try{return await authAction(request)}catch(e){return failure(e)}}
