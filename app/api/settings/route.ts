import {settings,json,failure} from '../../../lib/accounts';
export const dynamic='force-dynamic';
export async function GET(){try{return json(await settings())}catch(e){return failure(e)}}
