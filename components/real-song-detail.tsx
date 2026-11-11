'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Song = {
  id: string;
  title: string;
  artist: string;
  slug: string;
  chords_text: string;
  lyrics_text: string;
  has_pdf: number;
  pdf_url: string | null;
  source_name: string;
};

export default function RealSongDetail({ slug }: { slug: string }) {
  const [song, setSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setNotFound(false);
    setSong(null);
    fetch('/api/songs/' + encodeURIComponent(slug), { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (response.status === 404) {
          setNotFound(true);
          return null;
        }
        if (!response.ok) throw new Error('Không thể kết nối dữ liệu bài hát.');
        const result: { song?: Song } = await response.json();
        if (!result.song) throw new Error('Dữ liệu bài hát không hợp lệ.');
        return result.song;
      })
      .then(data => { if (data) setSong(data); })
      .catch(err => { if (err.name !== 'AbortError') setError(err.message || 'Có lỗi kết nối.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [slug, retry]);

  return (
    <main className="real-shell">
      <div className="real-container real-detail">
        <header className="real-topbar">
          <Link className="real-brand" href="/">♫ Góc Hợp Âm</Link>
          <Link href="/kho-bai-hat">← Trở lại kho bài</Link>
        </header>
        {loading ? <p className="real-message" role="status">Đang tải bài hát...</p> :
          notFound ? <div className="real-message" role="alert">
            <h1>Không tìm thấy bài hát (404)</h1>
            <p>Bài hát này chưa có trong cơ sở dữ liệu.</p>
            <Link href="/kho-bai-hat">Về thư viện</Link>
          </div> :
          error ? <div className="real-message real-error" role="alert">
            <h1>Lỗi kết nối</h1>
            <p>{error}</p>
            <button type="button" onClick={() => setRetry(n => n + 1)}>Thử lại</button>
          </div> :
          song ? <>
            <div className="real-hero">
              <span className="real-eyebrow">GÓC HỢP ÂM · CHI TIẾT</span>
              <h1>{song.title}</h1>
              <p>{song.artist || 'Chưa rõ nghệ sĩ'}</p>
              {song.source_name && <small>Nguồn dữ liệu: {song.source_name}</small>}
            </div>
            {song.has_pdf === 1 && song.pdf_url &&
              <p><a className="real-pdf" href={song.pdf_url} target="_blank" rel="noopener noreferrer">Mở bản PDF ↗</a></p>}
            <div className="real-score">
              <section>
                <h2>Hợp âm</h2>
                <pre>{song.chords_text || 'Bài hát này chưa có hợp âm.'}</pre>
              </section>
              <section>
                <h2>Lời bài hát</h2>
                <pre>{song.lyrics_text || 'Bài hát này chưa có lời.'}</pre>
              </section>
            </div>
          </> : <p className="real-message">Chưa có dữ liệu bài hát.</p>}
      </div>
    </main>
  );
}
