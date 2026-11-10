import {getAccount} from '../../lib/accounts';import {adminPage,html} from '../../lib/member-pages';
export const dynamic='force-dynamic';
export async function GET(request:Request){const user=await getAccount(request);if(!user)return Response.redirect(new URL('/dang-nhap?next=/quan-tri',request.url),303);if(user.role!=='admin')return new Response('Tài khoản này không có quyền quản trị.',{status:403});return html(adminPage())}
