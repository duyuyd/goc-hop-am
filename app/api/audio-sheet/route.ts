import { env } from 'cloudflare:workers';
import { AppError, failure, getAccount, json, rate, requireAccount, requireOrigin } from '../../../lib/accounts';
import { boundedBytes, protectionHeaders } from '../../../lib/security';

export const dynamic = 'force-dynamic';

const MAX_AUDIO = 36 * 1024 * 1024;
const MAX_SCORE = 6 * 1024 * 1024;
const MUSICXML = 'application/vnd.recordare.musicxml+xml';
const CONTENT_TYPES = { mp3: 'audio/mpeg', wav: 'audio/wav' } as const;

function configuration() {
  const token = env.AI_TRANSCRIBE_TOKEN || '';
  if (!env.BUCKET || !/^[A-Za-z0-9_-]{32,128}$/.test(token)) return null;
  try {
    const endpoint = new URL(env.AI_TRANSCRIBE_URL || '');
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password ||
        endpoint.pathname !== '/' || endpoint.search || endpoint.hash) return null;
    return { bucket: env.BUCKET, endpoint: new URL('/transcribe', endpoint), token };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const available = configuration() !== null;
    const signedIn = available && !!await getAccount(request);
    return json({ available, signedIn, maxBytes: MAX_AUDIO, maxSeconds: 180 });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const account = await requireAccount(request);
    const config = configuration();
    if (!config) throw new AppError(503, 'Dịch vụ tạo bản phổ đang chờ cấu hình.');

    const query = new URL(request.url).searchParams;
    const format = query.get('format');
    const bpm = query.get('bpm') || '120';
    if (format !== 'mp3' && format !== 'wav') throw new AppError(415, 'Chỉ hỗ trợ MP3 và WAV.');
    if (!/^\d{2,3}$/.test(bpm) || Number(bpm) < 40 || Number(bpm) > 240) {
      throw new AppError(400, 'Tempo cần nằm trong khoảng 40–240 BPM.');
    }
    if (request.headers.get('content-type') !== CONTENT_TYPES[format] ||
        (request.headers.get('content-encoding') || 'identity') !== 'identity') {
      throw new AppError(415, 'Hãy chọn lại tệp âm thanh MP3 hoặc WAV.');
    }
    const contentLength = request.headers.get('content-length');
    const length = request.headers.get('x-audio-bytes') || contentLength;
    if (!request.body || !length || !/^\d{1,8}$/.test(length) || Number(length) < 1) {
      throw new AppError(400, 'Không xác định được kích thước tệp âm thanh.');
    }
    const bytes = Number(length);
    if (contentLength !== null && Number(contentLength) !== bytes) {
      throw new AppError(400, 'Kích thước tệp âm thanh không khớp.');
    }
    if (bytes > MAX_AUDIO) throw new AppError(413, 'Tệp âm thanh vượt quá 36 MiB.');
    await rate(request, 'audio-sheet:' + account.id, 5);

    const key = `audio-sheet/tmp/${crypto.randomUUID()}.${format}`;
    try {
      // Cloudflare needs a known stream length for an R2 put. FixedLengthStream
      // also rejects bodies that do not match the validated Content-Length.
      const { readable, writable } = new FixedLengthStream(bytes);
      let sent = 0;
      const measured = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          sent += chunk.byteLength;
          controller.enqueue(chunk);
        },
      }));
      const [upload, copied] = await Promise.allSettled([
        config.bucket.put(key, readable, { httpMetadata: { contentType: CONTENT_TYPES[format] } }),
        measured.pipeTo(writable, { signal: AbortSignal.timeout(60_000) }),
      ]);
      if (sent !== bytes || copied.status === 'rejected') throw new AppError(400, 'Tệp âm thanh tải lên chưa đầy đủ.');
      if (upload.status === 'rejected' || !upload.value) throw new AppError(503, 'Không lưu được âm thanh tạm thời.');
      const audio = await config.bucket.get(key);
      if (!audio) throw new AppError(503, 'Không đọc lại được âm thanh đã tải lên.');
      config.endpoint.searchParams.set('bpm', bpm);
      let upstream: Response;
      try {
        upstream = await fetch(config.endpoint, {
          method: 'POST',
          body: audio.body,
          headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': CONTENT_TYPES[format], Accept: MUSICXML },
          redirect: 'manual',
          signal: AbortSignal.timeout(100_000),
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'TimeoutError') {
          throw new AppError(504, 'Chép bản phổ mất quá lâu. Hãy thử một đoạn ngắn hơn.');
        }
        console.error('Audio transcription upstream request failed', error instanceof Error ? error.name : 'unknown');
        throw new AppError(502, 'Chưa kết nối được dịch vụ chép bản phổ.');
      }
      if (!upstream.ok) {
        const messages: Record<number, string> = {
          400: 'Tệp âm thanh trống hoặc không hợp lệ.',
          408: 'Truyền tệp âm thanh quá lâu. Hãy thử lại.',
          413: 'Tệp vượt giới hạn dung lượng hoặc 180 giây.',
          415: 'Dịch vụ chỉ đọc tệp MP3 hoặc WAV hợp lệ.',
          422: 'Chưa chép được bản phổ. Hãy thử một đoạn thu ngắn và rõ hơn.',
          503: 'Dịch vụ đang xử lý. Hãy thử lại sau.',
        };
        await upstream.body?.cancel();
        throw new AppError(messages[upstream.status] ? upstream.status : 502,
          messages[upstream.status] || 'Dịch vụ chép bản phổ gặp lỗi. Hãy thử lại.');
      }
      if (upstream.headers.get('content-type')?.split(';')[0] !== MUSICXML) {
        await upstream.body?.cancel();
        throw new AppError(502, 'Dịch vụ chưa trả về MusicXML hợp lệ.');
      }
      let score: Uint8Array<ArrayBuffer>;
      try {
        score = await boundedBytes(upstream, MAX_SCORE);
      } catch {
        throw new AppError(502, 'Không đọc được bản phổ trả về. Hãy thử một đoạn ngắn hơn.');
      }
      if (!score.length) throw new AppError(502, 'Dịch vụ trả về bản phổ trống.');
      const noteCount = upstream.headers.get('X-Transcribed-Notes') || '';
      const chordCount = upstream.headers.get('X-Transcribed-Chords') || '';
      return new Response(score, { headers: {
        ...protectionHeaders, 'Content-Type': MUSICXML,
        'Content-Disposition': 'attachment; filename="ban-pho.musicxml"',
        'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex',
        'Content-Security-Policy': "sandbox; default-src 'none'",
        ...(/^\d{1,5}$/.test(noteCount) && { 'X-Transcribed-Notes': noteCount }),
        ...(/^\d{1,5}$/.test(chordCount) && { 'X-Transcribed-Chords': chordCount }),
      } });
    } finally {
      try {
        await config.bucket.delete(key);
      } catch {
        console.error('Unable to delete a temporary audio-sheet object');
      }
    }
  } catch (error) {
    return failure(error);
  }
}
