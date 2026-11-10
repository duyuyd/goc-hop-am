import {googleChallenge,googleSignIn} from '../../../../lib/google-auth';
import {failure} from '../../../../lib/accounts';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return await googleChallenge(request)}catch(e){return failure(e)}}
export async function POST(request:Request){try{return await googleSignIn(request)}catch(e){return failure(e)}}
