/**
 * Retain the existing HTML landing page and its complete reading/studio UI.
 * This additive widget is backed only by /api/songs and /api/stats (Cloudflare D1).
 */
export function enhanceHomeWithRealSongs(html: string): string {
  const panel = String.raw`
<section id="real-song-panel" class="real-d1-panel" aria-labelledby="real-d1-heading">
  <div class="real-d1-head">
    <div>
      <span class="real-d1-eyebrow">DỮ LIỆU THỰC · CLOUDFLARE D1</span>
      <h2 id="real-d1-heading">Thư viện hợp âm đã nhập</h2>
      <p id="real-d1-stats" role="status" aria-live="polite">Đang tải thống kê...</p>
    </div>
    <a href="/kho-bai-hat" class="real-d1-all">Xem thư viện đầy đủ ›</a>
  </div>
  <form id="real-d1-search" role="search">
    <label for="real-d1-keyword">Tìm bài hát trong D1</label>
    <div><input type="search" id="real-d1-keyword" maxlength="120" autocomplete="off"
      placeholder="Tên bài hát hoặc nghệ sĩ..."><button type="submit">Tìm</button></div>
  </form>
  <p id="real-d1-message" role="status" aria-live="polite">Đang tải bài hát...</p>
  <div id="real-d1-results" class="real-d1-results" aria-label="Bài hát đã nhập"></div>
  <nav id="real-d1-pagination" aria-label="Trang bài hát thực tế" hidden>
    <button type="button" id="real-d1-prev">‹ Trước</button>
    <span id="real-d1-page">Trang 1</span>
    <button type="button" id="real-d1-next">Tiếp ›</button>
  </nav>
</section>`;
  // The markup remains compatible with the old HTML-driven homepage.
  return html
    .replace('</section><aside class="guest-ad"', '</section>' + panel + '<aside class="guest-ad"')
    .replace('</body>', '<link rel="stylesheet" href="/real-song-home.css?v=1">' +
      '<script src="/real-song-home.js?v=1" type="module"></script></body>');
}
