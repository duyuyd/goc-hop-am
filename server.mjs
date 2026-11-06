// server.mjs - Production-grade web dev & API server for Góc Hợp Âm
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { musicCatalog } from './lib/music-catalog.mjs';
import { autoSheetEngine } from './lib/auto-sheet-engine.mjs';
import { securityRights } from './lib/security-rights.mjs';
import { videoCaptions, captionFailure } from './lib/video-captions.mjs';
import { midiToScore, scoreToMusicXML } from './public/mobile/score-io.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Security Headers & Audit middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Rate limiting for API requests
app.use('/api', (req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const { allowed, remaining } = securityRights.checkRateLimit(String(ip));
  res.setHeader('X-RateLimit-Remaining', remaining);
  if (!allowed) {
    return res.status(429).json({ error: 'Quá nhiều yêu cầu từ thiết bị này. Vui lòng thử lại sau giây lát.' });
  }
  next();
});

// PWA Manifest
app.get('/manifest.webmanifest', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json');
  res.json({
    name: 'Góc Hợp Âm',
    short_name: 'Góc Hợp Âm',
    description: 'Mang giai điệu theo bạn · Tìm hợp âm, đổi tông, auto-sheet MusicXML và tập theo cách của bạn',
    start_url: '/',
    display: 'standalone',
    background_color: '#17131e',
    theme_color: '#21192e',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any maskable'
      }
    ]
  });
});

// Service Worker for offline capability
app.get('/service-worker.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`
    const CACHE_NAME = 'goc-hop-am-cache-v3';
    const ASSETS = ['/', '/index.html', '/app.css', '/bundle.js', '/icon.svg'];
    self.addEventListener('install', e => {
      e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
    });
    self.addEventListener('activate', e => {
      e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('goc-hop-am-cache-') && k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
    });
    self.addEventListener('fetch', e => {
      if (e.request.url.includes('/api/')) return;
      e.respondWith(
        caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match('/index.html')))
      );
    });
  `);
});

// --- P1: Music Catalog API ---
app.get('/api/catalog', async (req, res) => {
  try {
    const { q, query, genre, type, mode, page } = req.query;
    const searchTerm = q || query || '';

    // First query local catalog
    const localResult = musicCatalog.search({
      query: searchTerm,
      genre: genre ? String(genre) : '',
      type: type || 'title',
      mode: mode || 'hot',
      page: page ? Number(page) : 0,
      limit: 20
    });

    res.json(localResult);
  } catch (error) {
    securityRights.logEvent('CATALOG_ERROR', { error: error.message });
    res.status(500).json({ error: 'Không thể tải danh mục bài hát: ' + error.message });
  }
});

// --- P1: Song Reader API ---
app.get('/api/reader', (req, res) => {
  try {
    const { url, id, variant } = req.query;
    const target = url || (id ? (id.startsWith('site:') ? id : `site:${id}`) : null);
    if (!target) {
      return res.status(400).json({ error: 'Thiếu định danh bài hát.' });
    }

    const song = musicCatalog.getSong(target);
    if (!song) {
      return res.status(404).json({ error: 'Không tìm thấy bài hát trong kho dữ liệu.' });
    }

    const requestedVariant = ['melody', 'piano', 'organ'].includes(variant) ? variant : 'melody';
    const score = autoSheetEngine.getSongSheet(song, requestedVariant);
    const statusFor = value => value?.verified === true ? 'verified' :
      value?.origin === 'manual_unverified' ? 'unverified' : value?.notes?.length ? 'ai_draft' : 'missing';

    res.json({
      song: {
        id: song.id,
        title: song.title,
        author: song.composer || song.artist || 'Góc Hợp Âm',
        composer: song.composer,
        artist: song.artist,
        key: song.key || 'C',
        genre: song.genre,
        content: song.content,
        sourceUrl: song.sourceUrl,
        videoId: song.videoId,
        videos: song.videoId ? [{ id: song.videoId, label: 'Bản thu chính' }] : [],
        sheets: {
          melody: { status: statusFor(autoSheetEngine.getSongSheet(song, 'melody')), origin: autoSheetEngine.getSongSheet(song, 'melody')?.origin || 'unknown', notesCount: autoSheetEngine.getSongSheet(song, 'melody')?.notes?.length || 0 },
          piano: { status: statusFor(autoSheetEngine.getSongSheet(song, 'piano')), origin: autoSheetEngine.getSongSheet(song, 'piano')?.origin || 'unknown' },
          organ: { status: statusFor(autoSheetEngine.getSongSheet(song, 'organ')), origin: autoSheetEngine.getSongSheet(song, 'organ')?.origin || 'unknown' }
        },
        score: score || null,
        analysis: score ? autoSheetEngine.analyzeScore(score) : null,
        rights: song.rights || 'unknown'
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi tải bài hát: ' + error.message });
  }
});

// Browse and audit all catalog sheets
app.get('/api/sheets/browse', (req, res) => {
  try {
    const report = autoSheetEngine.browseCatalogSheets(musicCatalog.songs);
    res.json({ success: true, ...report });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi duyệt kho sheet: ' + error.message });
  }
});

// Dedicated sheet retrieval endpoint
app.get('/api/sheets/:id', (req, res) => {
  try {
    const songId = req.params.id;
    const variant = ['melody', 'piano', 'organ'].includes(req.query.variant) ? req.query.variant : 'melody';
    const song = musicCatalog.getSong(songId.startsWith('site:') ? songId : `site:${songId}`);
    if (!song) {
      return res.status(404).json({ error: 'Không tìm thấy bài hát để tạo sheet.' });
    }
    const score = autoSheetEngine.getSongSheet(song, variant);
    const analysis = autoSheetEngine.analyzeScore(score);
    res.json({ success: true, songId: song.id, title: song.title, variant, score, analysis });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi tải sheet: ' + error.message });
  }
});

// Sheet analysis endpoint
app.get('/api/sheets/:id/analysis', (req, res) => {
  try {
    const songId = req.params.id;
    const variant = ['melody', 'piano', 'organ'].includes(req.query.variant) ? req.query.variant : 'melody';
    const song = musicCatalog.getSong(songId.startsWith('site:') ? songId : `site:${songId}`);
    if (!song) {
      return res.status(404).json({ error: 'Không tìm thấy bài hát.' });
    }
    const score = autoSheetEngine.getSongSheet(song, variant);
    const analysis = autoSheetEngine.analyzeScore(score);
    res.json({ success: true, songId: song.id, title: song.title, variant, analysis });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi phân tích sheet: ' + error.message });
  }
});

// Analyze raw score payload
app.post('/api/auto-sheet/analyze', (req, res) => {
  try {
    const { score } = req.body;
    if (!score) return res.status(400).json({ error: 'Cần cung cấp dữ liệu score.' });
    const analysis = autoSheetEngine.analyzeScore(score);
    res.json({ success: true, analysis });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Auto-repair corrupted or distorted sheet
app.post('/api/auto-sheet/repair', (req, res) => {
  try {
    const { score, songId } = req.body;
    const fallbackSong = songId ? musicCatalog.getSong(songId.startsWith('site:') ? songId : `site:${songId}`) : null;
    const repaired = autoSheetEngine.repairScore(score, fallbackSong);
    const analysis = autoSheetEngine.analyzeScore(repaired);
    res.json({ success: true, repairedScore: repaired, analysis });
  } catch (error) {
    res.status(400).json({ error: 'Lỗi tự động phục hồi sheet: ' + error.message });
  }
});

// --- Video Captions API (proxy to safe YouTube timedtext) ---
app.get('/api/video-captions', async (req, res) => {
  const id = req.query.id;
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) {
    return res.status(400).json({ error: 'Mã video YouTube không hợp lệ.' });
  }
  try {
    const captions = await videoCaptions(id);
    res.json(captions);
  } catch (error) {
    res.json(captionFailure(id, 'unavailable'));
  }
});

// --- P2: Auto Sheet Engine API ---
app.post('/api/auto-sheet/jobs', (req, res) => {
  try {
    const { audioBase64, midiBase64, songId, title, rights, bpm } = req.body;
    let audioBytes = null, midiBytes = null;

    if (audioBase64) {
      audioBytes = Buffer.from(audioBase64, 'base64');
    }
    if (midiBase64) {
      midiBytes = Buffer.from(midiBase64, 'base64');
    }

    if (!audioBytes && !midiBytes) {
      return res.status(400).json({ error: 'Cần gửi dữ liệu audioBase64 hoặc midiBase64.' });
    }

    const result = autoSheetEngine.createJob({
      audioBytes,
      midiBytes,
      songId,
      title: title || 'Bản nhạc tự động',
      rights: rights || 'unknown',
      bpm: Number(bpm) || 80
    });

    res.json({
      success: true,
      deduplicated: result.deduplicated,
      job: result.job
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/auto-sheet/jobs', (req, res) => {
  const jobs = autoSheetEngine.listJobs();
  res.json({ jobs, total: jobs.length });
});

app.get('/api/auto-sheet/jobs/:id', (req, res) => {
  const job = autoSheetEngine.getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Không tìm thấy tác vụ auto-sheet.' });
  }
  res.json({ job });
});

// Synchronous score transcription endpoint
app.post('/api/auto-sheet/transcribe', (req, res) => {
  try {
    const { midiBase64, title } = req.body;
    if (!midiBase64) {
      return res.status(400).json({ error: 'Cần cung cấp dữ liệu midiBase64.' });
    }
    const bytes = Buffer.from(midiBase64, 'base64');
    const score = midiToScore(bytes, { title: title || 'Giai điệu MIDI' });
    const musicxml = scoreToMusicXML(score);
    res.json({ success: true, score, musicxml });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// --- P4: Security & Rights Audit API ---
app.get('/api/security/audit', (req, res) => {
  const logs = securityRights.getAuditLogs({ limit: 100 });
  res.json({
    framework: 'OWASP ASVS 5.0 — not audited',
    protection: {
      rateLimiting: 'partial_in_memory',
      ssrfProtection: 'url_helper_only',
      xssSanitization: 'not_audited',
      sqlInjectionImmunity: 'not_audited',
      rbacCheck: 'not_implemented_here',
      rightsLedger: 'metadata_unverified'
    },
    auditLogs: logs
  });
});

app.get('/api/security/rights', (req, res) => {
  res.json({
    rightsLedger: securityRights.listRights()
  });
});

// --- Health Check ---
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Góc Hợp Âm',
    version: '1.3.1',
    uptime: process.uptime(),
    catalogSongsCount: musicCatalog.songs.length
  });
});

// Serve static frontend files from public/mobile
const mobileDir = path.join(__dirname, 'public', 'mobile');
app.use(express.static(mobileDir));

// Root and unmatched routes fall back to index.html for SPA
app.use((req, res) => {
  res.sendFile(path.join(mobileDir, 'index.html'));
});

// Start dev server
app.listen(PORT, HOST, () => {
  console.log(`Góc Hợp Âm server listening on http://${HOST}:${PORT}`);
});
