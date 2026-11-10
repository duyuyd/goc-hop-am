import {json,failure} from '../../../lib/accounts';
import {option} from '../../../lib/store';
export const dynamic='force-dynamic';
export async function GET(){try{return json({googleClientId:(await option('google_client_id'))||null,ads:'internal',release:'2.0.0'},200,{'Cache-Control':'public, max-age=60'})}catch(e){return failure(e)}}
