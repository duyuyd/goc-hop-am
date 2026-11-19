const form = document.getElementById('supabase-auth-form');
if (form) form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = document.getElementById('supabase-auth-result');
  const button = form.querySelector('button[type=submit]');
  button.disabled = true;
  status.textContent = 'Đang xác thực…';
  try {
    const fields = new FormData(form);
    const response = await fetch('/api/auth/supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email: fields.get('email'), password: fields.get('password') }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.user) throw new Error(payload.error || 'Đăng nhập thất bại');
    location.assign('/?authenticated=1');
  } catch (e) {
    status.textContent = e.message || 'Không thể đăng nhập';
    button.disabled = false;
  }
});