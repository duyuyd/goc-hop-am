import {getAccount} from '../../lib/accounts';import {accountPage,html} from '../../lib/member-pages';
export const dynamic='force-dynamic';
export async function GET(request:Request){const user=await getAccount(request);return user?html(accountPage()):Response.redirect(new URL('/dang-nhap?next=/tai-khoan',request.url),303)}
