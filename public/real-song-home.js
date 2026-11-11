// Real D1 catalogue widget for the existing homepage. No song arrays or fake counts.
const root = document.getElementById('real-song-panel');
if (root) {
  const $ = id => document.getElementById(id);
  const results = $('real-d1-results');
  const message = $('real-d1-message');
  const stats = $('real-d1-stats');
  const pagination = $('real-d1-pagination');
  const searchInput = $('real-d1-keyword');
  const pageLabel = $('real-d1-page');
  let page = 1;
  let q = '';
  let busy = false;
  let controller = null;
  let ticket = 0;

  async function loadStats() {
    try {
      const response = await fetch('/api/stats', { cache: 'no-store' });
      if (!response.ok) throw new Error('Stats unavailable');
      const data = await response.json();
      if (!Number.isSafeInteger(data.total_songs) || data.total_songs < 0) throw new Error('Invalid stats');
      stats.textContent = data.total_songs === 0
        ? 'Đang chờ dữ liệu...'
        : 'Đã đồng bộ ' + data.total_songs.toLocaleString('vi-VN') + ' bài hát thực tế';
    } catch {
      stats.textContent = 'Lỗi kết nối thống kê D1.';
    }
  }

  function clearResults() {
    results.replaceChildren();
  }

  function errorState(text) {
    clearResults();
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Thử lại';
    retry.onclick = () => load();
    message.replaceChildren(document.createTextNode(text + ' '), retry);
  }

  function songCard(song) {
    const article = document.createElement('article');
    article.className = 'real-d1-row';
    const icon = document.createElement('span');
    icon.className = 'real-d1-icon';
    icon.textContent = '♪';
    const content = document.createElement('div');
    content.className = 'real-d1-content';
    const title = document.createElement(song.slug ? 'a' : 'strong');
    title.textContent = song.title;
    if (song.slug) title.href = '/bai-hat/' + encodeURIComponent(song.slug);
    const artist = document.createElement('p');
    artist.textContent = song.artist || 'Chưa rõ nghệ sĩ';
    content.append(title, artist);
    article.append(icon, content);
    if (song.slug) {
      const open = document.createElement('a');
      open.href = '/bai-hat/' + encodeURIComponent(song.slug);
      open.textContent = 'Mở ›';
      open.className = 'real-d1-open';
      article.append(open);
    }
    return article;
  }

  async function load() {
    const currentTicket = ++ticket;
    controller?.abort();
    controller = new AbortController();
    busy = true;
    pagination.hidden = true;
    clearResults();
    message.textContent = 'Đang tải bài hát...';
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (q) params.set('q', q);
      const response = await fetch('/api/songs?' + params, {
        signal: controller.signal, cache: 'no-store',
      });
      if (!response.ok) throw new Error('Không thể kết nối danh sách bài hát.');
      const data = await response.json();
      if (!Array.isArray(data.items)) throw new Error('Dữ liệu phản hồi không hợp lệ.');
      if (currentTicket !== ticket) return;
      clearResults();
      message.textContent = data.items.length ? '' : (q
        ? 'Chưa có bài hát nào phù hợp với từ khóa.'
        : 'Chưa có bài hát nào.');
      for (const song of data.items) results.append(songCard(song));
      pagination.hidden = !(page > 1 || data.hasMore);
      $('real-d1-prev').disabled = page <= 1;
      $('real-d1-next').disabled = !data.hasMore;
      pageLabel.textContent = 'Trang ' + page;
    } catch (error) {
      if (controller.signal.aborted || currentTicket !== ticket) return;
      errorState(error.message || 'Lỗi kết nối bài hát.');
    } finally {
      if (currentTicket === ticket) busy = false;
    }
  }

  $('real-d1-search').addEventListener('submit', event => {
    event.preventDefault();
    q = searchInput.value.trim().slice(0, 120);
    page = 1;
    load();
  });
  $('real-d1-prev').onclick = () => { if (!busy && page > 1) { page--; load(); } };
  $('real-d1-next').onclick = () => { if (!busy && !$('real-d1-next').disabled) { page++; load(); } };

  // The global header search keeps its existing catalog behavior AND searches imported D1 songs.
  const globalForm = document.getElementById('search');
  const globalInput = document.getElementById('query');
  globalForm?.addEventListener('submit', () => {
    if (!globalInput) return;
    searchInput.value = globalInput.value;
    q = globalInput.value.trim().slice(0, 120);
    page = 1;
    load();
  });
  loadStats();
  load();
}
