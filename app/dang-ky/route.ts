import {authPage,html} from '../../lib/member-pages';
export async function GET(){return html(authPage('register'))}
