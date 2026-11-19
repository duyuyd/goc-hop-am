import { authPage, html } from '../../lib/member-pages';
import { env } from 'cloudflare:workers';

export async function GET() {
  const enabled = Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
  let page = authPage('login');
  if (enabled) {
    const form = '<section aria-label="Supabase Auth"><h3>Đăng nhập bằng email Supabase</h3>' +
      '<form id="supabase-auth-form">' +
      '<label>Email<input name="email" type="email" autocomplete="email" required></label>' +
      '<label>Mật khẩu<input name="password" type="password" autocomplete="current-password" required minlength="8"></label>' +
      '<p id="supabase-auth-result" role="status"></p>' +
      '<button type="submit" class="gold-button">Đăng nhập bằng email</button></form></section>';
    page = page.replace('<div id="google-signin"', form + '<div id="google-signin"')
      .replace('</body>', '<script type="module" src="/supabase-login.js"></script></body>');
  }
  return html(page);
}
