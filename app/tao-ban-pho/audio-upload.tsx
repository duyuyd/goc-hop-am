'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import styles from './audio-upload.module.css';

type Renderer = {
  load: (document: Document) => Promise<unknown>;
  render: () => void;
  dispose: () => void;
};
type RendererConstructor = new (target: HTMLElement, options: { backend: 'svg'; autoResize: boolean }) => Renderer;
type Limits = { available: boolean; signedIn: boolean; maxBytes: number; maxSeconds: number };
type Download = { url: string; notes: string | null; chords: string | null };

function rendererFromWindow() {
  return (window as Window & { opensheetmusicdisplay?: { OpenSheetMusicDisplay?: RendererConstructor } })
    .opensheetmusicdisplay?.OpenSheetMusicDisplay;
}

let loadingRenderer: Promise<RendererConstructor> | undefined;
function loadRenderer() {
  const loaded = rendererFromWindow();
  if (loaded) return Promise.resolve(loaded);
  loadingRenderer ??= new Promise<RendererConstructor>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/ban-pho/vendor/opensheetmusicdisplay-2.3.0.min.js';
    function unavailable() {
      script.remove();
      reject(new Error('Chưa tải được trình đọc khuông nhạc.'));
    }
    script.onerror = unavailable;
    script.onload = () => {
      const engine = rendererFromWindow();
      if (engine) resolve(engine);
      else unavailable();
    };
    document.head.appendChild(script);
  }).catch(error => {
    loadingRenderer = undefined;
    throw error;
  });
  return loadingRenderer;
}

export function AudioUpload() {
  const [limits, setLimits] = useState<Limits | null>(null);
  const [configFailed, setConfigFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [signIn, setSignIn] = useState(false);
  const [download, setDownload] = useState<Download | null>(null);
  const notation = useRef<HTMLDivElement>(null);
  const active = useRef<AbortController | null>(null);
  const renderer = useRef<Renderer | null>(null);
  const blobUrl = useRef('');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/audio-sheet', { cache: 'no-store', signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error('config_unavailable');
        return response.json() as Promise<Limits>;
      })
      .then(setLimits)
      .catch(() => { if (!controller.signal.aborted) setConfigFailed(true); });
    return () => {
      controller.abort();
      active.current?.abort();
      renderer.current?.dispose();
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active.current || !limits?.signedIn) return;
    setError('');
    setSignIn(false);
    setStatus('');
    const fields = new FormData(event.currentTarget);
    const file = fields.get('audio');
    const format = file instanceof File ? /\.(mp3|wav)$/i.exec(file.name)?.[1].toLowerCase() : null;
    if (!(file instanceof File) || !file.size || (format !== 'mp3' && format !== 'wav')) {
      setError('Hãy chọn một tệp MP3 hoặc WAV.');
      return;
    }
    if (file.size > limits.maxBytes) {
      setError(`Tệp vượt quá ${limits.maxBytes / (1024 * 1024)} MiB.`);
      return;
    }

    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setStatus('Đang tải âm thanh và chép bản phổ…');
    try {
      const params = new URLSearchParams({ format, bpm: String(fields.get('bpm') || '120') });
      const response = await fetch(`/api/audio-sheet?${params}`, {
        method: 'POST', body: file, signal: controller.signal,
        headers: {
          'Content-Type': format === 'mp3' ? 'audio/mpeg' : 'audio/wav',
          'X-Audio-Bytes': String(file.size),
        },
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: unknown } | null;
        if (response.status === 401) setSignIn(true);
        throw new Error(typeof result?.error === 'string' ? result.error : 'Chưa chép được bản phổ. Hãy thử lại.');
      }

      const xml = await response.text();
      const score = new DOMParser().parseFromString(xml, 'application/xml');
      if (score.documentElement.localName !== 'score-partwise' || score.querySelector('parsererror')) {
        throw new Error('Tệp MusicXML trả về không đọc được.');
      }

      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
      blobUrl.current = URL.createObjectURL(new Blob([xml], { type: 'application/vnd.recordare.musicxml+xml' }));
      setDownload({ url: blobUrl.current, notes: response.headers.get('X-Transcribed-Notes'),
        chords: response.headers.get('X-Transcribed-Chords') });

      renderer.current?.dispose();
      renderer.current = null;
      notation.current?.replaceChildren();
      setStatus('Đang vẽ khuông nhạc…');
      try {
        const OSMD = await loadRenderer();
        if (controller.signal.aborted || !notation.current) return;
        const drawing = new OSMD(notation.current, { backend: 'svg', autoResize: true });
        renderer.current = drawing;
        await drawing.load(score);
        if (controller.signal.aborted) return;
        drawing.render();
        if (!notation.current.querySelector('svg')) throw new Error('missing_svg');
        setStatus('Bản phổ đã sẵn sàng.');
      } catch {
        if (!controller.signal.aborted) {
          setStatus('Đã tạo MusicXML. Bạn có thể tải xuống khi trình đọc chưa vẽ được khuông nhạc.');
        }
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Chưa xử lý được tệp âm thanh.');
        setStatus('');
      }
    } finally {
      active.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  const pending = !limits && !configFailed;
  return <>
    <p className={styles.description}>Tải một bản thu MP3 hoặc WAV. Bản phổ nháp ghi lại các nốt và hợp âm nhận diện được.</p>
    <form className={styles.form} onSubmit={submit} aria-busy={busy}>
      <fieldset className={styles.fields} disabled={!limits?.signedIn || busy}>
        <label htmlFor="audio-sheet-file">Tệp âm thanh</label>
        <input id="audio-sheet-file" name="audio" type="file" accept=".mp3,.wav,audio/mpeg,audio/wav" required />
        <label htmlFor="audio-sheet-bpm">Tempo ghi phổ (BPM)</label>
        <input id="audio-sheet-bpm" name="bpm" type="number" inputMode="numeric" min="40" max="240" defaultValue="120" required />
        <button type="submit">Tạo bản phổ</button>
      </fieldset>
      {limits?.available && (limits.signedIn ? <p className={styles.help}>
        Tối đa {limits.maxSeconds} giây và {limits.maxBytes / (1024 * 1024)} MiB. Chọn BPM của bản thu để đặt ô nhịp chính xác hơn.
      </p> : <p><a href="/dang-nhap">Đăng nhập</a> để tải âm thanh lên.</p>)}
      {configFailed && <p role="alert">Chưa kiểm tra được dịch vụ. Hãy tải lại trang.</p>}
      {!pending && limits && !limits.available && <p role="status">Tính năng đang chờ kết nối dịch vụ chép bản phổ.</p>}
      {pending && <p role="status">Đang kiểm tra dịch vụ…</p>}
    </form>
    {status && <p role="status" aria-live="polite">{status}</p>}
    {error && <p className={styles.error} role="alert">{error} {signIn && <a href="/dang-nhap">Đăng nhập</a>}</p>}
    {download && <div className={styles.result}>
      <a href={download.url} download="ban-pho.musicxml">Tải MusicXML</a>
      {download.notes !== null && download.chords !== null && <span>{download.notes} nốt · {download.chords} ký hiệu hợp âm</span>}
    </div>}
    <div className={styles.notation} ref={notation} aria-label="Khuông nhạc từ âm thanh" />
  </>;
}
