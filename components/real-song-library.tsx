'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Song = {
  id: string;
  title: string;
  artist: string;
  slug: string | null;
  has_pdf: number;
  pdf_url: string | null;
  source_name: string;
};
type CatalogResponse = {
  items: Song[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  catalog?: string;
};
type StatsResponse = { total_songs: number; total_pdfs: number };

export default function RealSongLibrary() {
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [songs, setSongs] = useState<Song[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [statsError, setStatsError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setStatsError(false);
    fetch('/api/stats', { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('Không tải được thống kê D1.');
        return response.json() as Promise<StatsResponse>;
      })
      .then(data => setStats(data))
      .catch(err => {
        if (err.name !== 'AbortError') setStatsError(true);
      });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const params = new URLSearchParams({
      page: String(page),
      limit: '20',
    });
    if (query) params.set('q', query);
    fetch('/api/songs?' + params, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) {
          throw new Error(response.status === 503
            ? 'Kho bài hát chưa kết nối được D1.'
            : 'Không thể kết nối danh sách bài hát.');
        }
        return response.json() as Promise<CatalogResponse>;
      })
      .then(data => {
        if (!Array.isArray(data.items)) throw new Error('Dữ liệu danh sách không hợp lệ.');
        setSongs(data.items);
        setTotal(data.total);
        setHasMore(Boolean(data.hasMore));
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Không thể tải bài hát.');
          setSongs([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, query, retry]);

  return (
    <main className="real-shell">
      <div className="real-container">
        <header className="real-topbar">
          <Link className="real-brand" href="/">♫ Góc Hợp Âm</Link>
          <nav aria-label="Điều hướng">
            <Link href="/">Trang chủ</Link>
            <Link href="/tai-lieu">Tài liệu</Link>
            <Link href="/quan-tri">Quản trị</Link>
          </nav>
        </header>

        <div className="real-hero">
          <span className="real-eyebrow">KHO BÀI HÁT D1 · DỮ LIỆU THỰC</span>
          <h1>Mở bài hát. Chạm vào âm nhạc.</h1>
          <p>Tra cứu các bản nhạc đã được nhập vào Góc Hợp Âm.</p>
          <div className="real-banner" role="status" aria-live="polite">
            {statsError ? 'Lỗi kết nối thống kê. Hãy thử tải lại.' :
              stats === null ? 'Đang tải thống kê...' :
              stats.total_songs === 0 ? 'Đang chờ dữ liệu...' :
              'Đã đồng bộ ' + stats.total_songs.toLocaleString('vi-VN') + ' bài hát thực tế'}
            {stats && stats.total_songs > 0 ? (
              <span className="real-stat"> · {stats.total_pdfs.toLocaleString('vi-VN')} mục có liên kết PDF</span>
            ) : null}
          </div>
        </div>

        <form className="real-search" role="search" onSubmit={event => {
          event.preventDefault();
          setPage(1);
          setQuery(draft.trim().slice(0, 120));
        }}>
          <label htmlFor="song-query">Tìm bài hát, ca sĩ</label>
          <div>
            <input id="song-query" value={draft} onChange={event => setDraft(event.target.value)}
              maxLength={120} placeholder="Nhập tên bài hát hoặc ca sĩ..." />
            <button type="submit">Tìm</button>
          </div>
        </form>

        <section aria-label="Danh sách bài hát">
          <div className="real-heading">
            <h2>{query ? 'Kết quả: ' + query : 'Bài hát trong thư viện'}</h2>
            {!loading && !error ? <span>{total.toLocaleString('vi-VN')} bài</span> : null}
          </div>
          {loading ? <p className="real-message" role="status">Đang tải bài hát...</p> :
            error ? <div className="real-message real-error" role="alert">
              <p>{error}</p>
              <button type="button" onClick={() => setRetry(current => current + 1)}>Thử lại</button>
            </div> :
            songs.length === 0 ? <p className="real-message">Chưa có bài hát nào{query ? ' phù hợp với từ khóa.' : '.'}</p> :
            <div className="real-grid">
              {songs.map(song => (
                <article key={song.id} className="real-song">
                  <span className="real-note" aria-hidden="true">♪</span>
                  <div className="real-song-body">
                    {song.slug ?
                      <Link href={'/bai-hat/' + encodeURIComponent(song.slug)}>{song.title}</Link> :
                      <strong>{song.title}</strong>}
                    <p>{song.artist || 'Chưa rõ nghệ sĩ'}</p>
                    <small>{song.has_pdf && song.pdf_url ? 'Có liên kết PDF' : 'Hợp âm / lời nếu có dữ liệu'}</small>
                  </div>
                  {song.slug ? <Link className="real-open" href={'/bai-hat/' + encodeURIComponent(song.slug)}>Mở ›</Link> : null}
                </article>
              ))}
            </div>}
          {!loading && !error && (page > 1 || hasMore) &&
            <div className="real-pages">
              <button type="button" disabled={page === 1} onClick={() => setPage(n => n - 1)}>‹ Trước</button>
              <span>Trang {page}</span>
              <button type="button" disabled={!hasMore} onClick={() => setPage(n => n + 1)}>Tiếp ›</button>
            </div>}
        </section>
      </div>
    </main>
  );
}
