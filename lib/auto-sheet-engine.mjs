// lib/auto-sheet-engine.mjs
// P2 Auto Sheet Engine: Queue, Deduplication, Pitch Analysis, MusicXML generator, Confidence calculation, Error isolation.
import crypto from 'node:crypto';
import { midiToScore, scoreToMusicXML, repairScore, analyzeScore } from '../public/mobile/score-io.js';
import { scoreFromPitches, detectMusicPitch } from '../public/mobile/pitch.js';

export class AutoSheetEngine {
  constructor() {
    this.jobs = new Map(); // jobId -> JobRecord
    this.audioHashToJobId = new Map(); // sha256 -> jobId
  }

  hash(data) {
    const buf = Buffer.isBuffer(data) ? data : typeof data === 'string' ? Buffer.from(data, 'utf-8') : Buffer.from(data);
    return crypto.createHash('sha256').update(buf).digest('hex');
  }

  createJob({ audioBytes, midiBytes, content, type, songId = '', title = 'Bản nhạc tự động', rights = 'owned', bpm = 80 }) {
    const rawData = audioBytes || midiBytes || content;
    if (!rawData) {
      throw new Error('Cần cung cấp dữ liệu âm thanh (WAV/MP3) hoặc MIDI hợp lệ.');
    }

    const sha256 = this.hash(rawData);
    // Deduplication check
    if (this.audioHashToJobId.has(sha256)) {
      const existingId = this.audioHashToJobId.get(sha256);
      const existing = this.jobs.get(existingId);
      if (existing && existing.status !== 'failed') {
        return { job: existing, deduplicated: true };
      }
    }

    const isMidi = type === 'midi' || Boolean(midiBytes);
    const jobId = 'job-' + sha256.slice(0, 16);
    const job = {
      jobId,
      sha256,
      audioBytes: isMidi ? null : rawData,
      midiBytes: isMidi ? rawData : null,
      songId: String(songId || '').slice(0, 100),
      title: String(title || 'Bản nhạc tự động').slice(0, 120),
      rights: ['owned', 'licensed', 'public_domain', 'unknown'].includes(rights) ? rights : 'unknown',
      bpm: Math.max(40, Math.min(240, Number(bpm) || 80)),
      status: 'queued',
      attempts: 0,
      maxAttempts: 3,
      error: null,
      confidence: 0,
      notes: [],
      musicxml: null,
      origin: midiBytes ? 'midi' : 'audio',
      verified: false, // Never automatically verified
      variant: 'melody',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.jobs.set(jobId, job);
    this.audioHashToJobId.set(sha256, jobId);

    // Process job
    this.processJob(job, { audioBytes, midiBytes });

    return { job, deduplicated: false };
  }

  processJob(jobOrId, options = {}) {
    const job = typeof jobOrId === 'string' ? this.jobs.get(jobOrId) : (jobOrId?.job || jobOrId);
    if (!job) throw new Error('Không tìm thấy tiến trình tạo sheet: ' + jobOrId);
    const audioBytes = options?.audioBytes || job.audioBytes;
    const midiBytes = options?.midiBytes || job.midiBytes;
    job.status = 'processing';
    job.attempts++;
    job.updatedAt = new Date().toISOString();

    try {
      if (midiBytes) {
        // MIDI parsing
        const score = midiToScore(midiBytes, { title: job.title });
        job.notes = score.notes;
        job.bpm = score.bpm;
        job.musicxml = scoreToMusicXML(score);
        // Confidence calculation: based on note coverage and quantization error
        const maxError = score.quantizationErrorBeats || 0;
        job.confidence = Math.max(0.65, Math.min(0.99, Number((1 - maxError).toFixed(2))));
        job.status = 'completed';
        job.error = null;
      } else if (audioBytes) {
        // Synthesis / Pitch simulation or decode
        // For server-side, decode audio buffer or run synth recognition
        const notes = this.transcribeAudioBuffer(audioBytes, job.bpm);
        if (!notes || !notes.length) {
          throw new Error('AI không nhận diện được giai điệu rõ ràng. Cần bản thu ít tạp âm.');
        }

        const score = {
          title: job.title,
          author: 'Góc Hợp Âm AI (nháp)',
          bpm: job.bpm,
          notes,
          origin: 'audio',
          verified: false
        };

        job.notes = notes;
        job.musicxml = scoreToMusicXML(score);
        job.confidence = null; // No benchmark-derived accuracy estimate available
        job.status = 'completed';
        job.error = null;
      }
    } catch (err) {
      job.error = err.message || 'Lỗi trong quá trình xử lý auto-sheet.';
      // Reject unreadable inputs; inventing notes to "repair" audio is not recovery.
      job.status = 'failed';
      job.notes = [];
      job.musicxml = null;
      job.confidence = null;

    }

    if (job.status === 'completed' && job.notes) {
      job.score = {
        format: 'goc-score-1',
        title: job.title,
        bpm: job.bpm,
        notes: job.notes,
        origin: job.origin || 'ai_generated',
        musicxml: job.musicxml
      };
      job.analysis = this.analyzeScore(job.score);
    }

    job.updatedAt = new Date().toISOString();
    return job;
  }

  recoverFailedJob(job) {
    const title = job.title || 'Bản nhạc tự động';
    return repairScore({
      title,
      author: 'Góc Hợp Âm Auto-Healing',
      bpm: job.bpm || 80,
      variant: job.variant || 'melody',
      notes: []
    });
  }

  repairScore(raw, fallbackSong = null) {
    return repairScore(raw, fallbackSong);
  }

  analyzeScore(score) {
    return analyzeScore(score);
  }

  transcribeAudioBuffer(bytes, bpm = 80) {
    // Accept uncompressed WAV PCM16 for the lightweight single-voice recognizer.
    // MP3 / dense mixes require the separate model-based worker and are NOT fabricated here.
    const data = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    if (data.byteLength < 44 || data.toString('ascii', 0, 4) !== 'RIFF' ||
        data.toString('ascii', 8, 12) !== 'WAVE') {
      throw new Error('Chỉ hỗ trợ WAV PCM 16-bit một bè ở API này. Các định dạng khác cần bộ AI xử lý riêng.');
    }
    const riffEnd = Math.min(data.byteLength, data.readUInt32LE(4) + 8);
    let format = null, audio = null;
    for (let pos = 12; pos + 8 <= riffEnd;) {
      const name = data.toString('ascii', pos, pos + 4);
      const size = data.readUInt32LE(pos + 4);
      const start = pos + 8;
      if (start + size > riffEnd) throw new Error('Tệp WAV bị cắt hoặc hỏng.');
      if (name === 'fmt ' && size >= 16) {
        format = {
          encoding: data.readUInt16LE(start), channels: data.readUInt16LE(start + 2),
          sampleRate: data.readUInt32LE(start + 4), blockAlign: data.readUInt16LE(start + 12),
          bitDepth: data.readUInt16LE(start + 14)
        };
      }
      if (name === 'data') audio = { start, size };
      pos = start + size + (size % 2);
    }
    if (!format || !audio || format.encoding !== 1 || format.bitDepth !== 16 ||
        ![1, 2].includes(format.channels) || format.sampleRate < 8000 ||
        format.sampleRate > 48000 || format.blockAlign !== 2 * format.channels) {
      throw new Error('WAV phải là PCM 16-bit, mono/stereo, 8–48 kHz.');
    }
    const count = Math.floor(audio.size / format.blockAlign);
    const duration = count / format.sampleRate;
    if (duration < 0.3 || duration > 60) {
      throw new Error('Chọn tệp WAV từ 0,3 đến 60 giây.');
    }
    const stride = Math.max(1, Math.floor(format.sampleRate / 11025));
    const rate = format.sampleRate / stride;
    const mono = new Float32Array(Math.floor(count / stride));
    for (let j = 0; j < mono.length; j++) {
      let sum = 0;
      for (let ch = 0; ch < format.channels; ch++) {
        sum += data.readInt16LE(audio.start + j * stride * format.blockAlign + ch * 2) / 32768;
      }
      mono[j] = sum / format.channels;
    }
    const frames = [];
    const windowSize = 1024, hop = 512;
    for (let i = 0; i + windowSize <= mono.length; i += hop) {
      frames.push(detectMusicPitch(mono.subarray(i, i + windowSize), rate));
    }
    const notes = scoreFromPitches(frames, hop / rate, bpm);
    if (!notes.some(n => n.midi !== null)) {
      throw new Error('Không nhận được nốt nhạc rõ ràng từ âm thanh.');
    }
    return notes;
  }

  getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }

  listJobs({ limit = 50 } = {}) {
    return Array.from(this.jobs.values())
      .slice(-limit)
      .reverse();
  }

  getSongSheet(song, variant = 'melody') {
    if (!song) return null;
    const songId = String(song.id || (song.sourceUrl ? song.sourceUrl.replace(/^site:/, '') : '')).trim();

    let score = null;
    // Check pre-authored preset catalog first
    const preset = CATALOG_PRESET_SCORES[songId]?.[variant] || CATALOG_PRESET_SCORES[songId]?.melody;
    if (preset && Array.isArray(preset) && preset.length > 0) {
      score = {
        format: 'goc-score-1',
        title: song.title + (variant === 'piano' ? ' (Piano)' : variant === 'organ' ? ' (Organ)' : ''),
        author: song.composer || song.artist || 'Góc Hợp Âm',
        bpm: 80,
        notes: preset.map(n => ({ ...n })),
        origin: 'manual_unverified',
        verified: false,
        variant
      };
    } else {
      // Auto-generate harmonic score from song's chords
      score = this.generateScoreFromChords(song, variant);
    }

    // Auto-repair on the fly: guaranteed valid meter, ranges, and MusicXML
    return this.repairScore(score, song);
  }

  browseCatalogSheets(songs = []) {
    const items = [];
    let verifiedCount = 0;
    let aiGeneratedCount = 0;
    let repairedCount = 0;
    let totalIntegrity = 0;

    for (const song of songs) {
      const melodyScore = this.getSongSheet(song, 'melody');
      const pianoScore = this.getSongSheet(song, 'piano');
      const organScore = this.getSongSheet(song, 'organ');

      const melodyAnalysis = this.analyzeScore(melodyScore);
      totalIntegrity += melodyAnalysis.integrityScore || 0;

      const isVerified = melodyScore?.verified === true && melodyScore?.origin === 'manual';
      const isManualUnverified = melodyScore?.origin === 'manual_unverified';
      if (isVerified) verifiedCount++;
      else if (melodyScore?.repaired) repairedCount++;
      else aiGeneratedCount++;

      items.push({
        id: song.id,
        title: song.title,
        author: song.composer || song.artist || 'Góc Hợp Âm',
        genre: song.genre,
        key: song.key || 'C',
        bpm: melodyScore?.bpm || 80,
        origin: isVerified ? 'verified' : (isManualUnverified ? 'manual_unverified' : (melodyScore?.repaired ? 'auto_repaired' : 'ai_draft')),
        notesCount: melodyScore?.notes?.length || 0,
        measuresCount: melodyAnalysis.measuresCount || 0,
        sheets: {
          melody: {
            status: isVerified ? 'verified' : (isManualUnverified ? 'unverified' : (melodyScore?.repaired ? 'repaired' : 'ai_draft')),
            notesCount: melodyScore?.notes?.length || 0,
            measuresCount: melodyAnalysis.measuresCount || 0,
            integrityScore: melodyAnalysis.integrityScore,
            range: melodyAnalysis.lowestPitch ? `${melodyAnalysis.lowestPitch.name} – ${melodyAnalysis.highestPitch.name}` : '—',
            singability: melodyAnalysis.singability
          },
          piano: { status: 'ready', notesCount: pianoScore?.notes?.length || 0 },
          organ: { status: 'ready', notesCount: organScore?.notes?.length || 0 }
        },
        analysis: melodyAnalysis
      });
    }

    const avg = songs.length ? Math.round(totalIntegrity / songs.length) : 100;
    return {
      total: songs.length,
      totalSongs: songs.length,
      verified: verifiedCount,
      verifiedCount,
      aiGenerated: aiGeneratedCount,
      aiGeneratedCount,
      repaired: repairedCount,
      repairedCount,
      avgScore: avg,
      averageIntegrity: avg,
      sheets: items,
      items
    };
  }

  generateScoreFromChords(song, variant = 'melody') {
    const title = (song?.title || 'Bản nhạc') + (variant === 'piano' ? ' (Piano)' : variant === 'organ' ? ' (Organ)' : '');
    const author = song?.composer || song?.artist || 'Góc Hợp Âm AI';
    const bpm = 80;
    const content = song?.content || '';

    // Extract chords
    const matcher = /\[([A-G](?:#|b)?[^\]\n]{0,24})\]/g;
    const chords = [];
    let match;
    while ((match = matcher.exec(content))) {
      chords.push(match[1].trim());
      if (chords.length >= 16) break;
    }

    if (!chords.length) {
      chords.push('C', 'Am', 'F', 'G');
    }

    const noteNames = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
    const notes = [];

    // Construct 4/4 measures (each measure must total exactly 4 beats)
    for (const rawChord of chords) {
      const base = rawChord.split('/')[0];
      const m = /^([A-G][#b]?)(.*)$/.exec(base);
      const rootStr = m ? m[1] : 'C';
      const qual = m ? m[2] : '';
      const rootOffset = noteNames[rootStr] ?? 0;
      const isMinor = qual.startsWith('m') && !qual.startsWith('maj');
      const thirdOffset = isMinor ? 3 : 4;
      const fifthOffset = 7;

      const rootMidi = 60 + rootOffset;
      const thirdMidi = 60 + ((rootOffset + thirdOffset) % 12);
      const fifthMidi = 60 + ((rootOffset + fifthOffset) % 12);
      const octaveMidi = rootMidi + 12 <= 84 ? rootMidi + 12 : rootMidi;

      if (variant === 'piano') {
        // Piano accompaniment: Bass (2 beats) + Arpeggio chord (1 + 1 beat) = 4 beats
        const bassMidi = rootMidi - 12 >= 48 ? rootMidi - 12 : rootMidi;
        notes.push({ midi: bassMidi, beats: 2 });
        notes.push({ midi: thirdMidi, beats: 1 });
        notes.push({ midi: fifthMidi, beats: 1 });
      } else if (variant === 'organ') {
        // Organ pad: Whole note = 4 beats
        notes.push({ midi: rootMidi, beats: 4 });
      } else {
        // Melody: 4 beats (1, 1, 1, 1)
        notes.push({ midi: rootMidi, beats: 1 });
        notes.push({ midi: thirdMidi, beats: 1 });
        notes.push({ midi: fifthMidi, beats: 1 });
        notes.push({ midi: octaveMidi, beats: 1 });
      }

      if (notes.length >= 64) break;
    }

    const score = {
      format: 'goc-score-1',
      title,
      author,
      bpm,
      notes,
      origin: 'auto_chords',
      verified: false,
      variant
    };
    score.musicxml = scoreToMusicXML(score);
    return score;
  }
}

export const CATALOG_PRESET_SCORES = {
  'nang-tho': {
    melody: [
      { midi: 67, beats: 1 }, { midi: 64, beats: 1 }, { midi: 67, beats: 1 }, { midi: 69, beats: 1 },
      { midi: 67, beats: 1 }, { midi: 67, beats: 0.5 }, { midi: 64, beats: 0.5 }, { midi: 62, beats: 1 }, { midi: 60, beats: 1 },
      { midi: 65, beats: 1 }, { midi: 69, beats: 1 }, { midi: 72, beats: 1 }, { midi: 71, beats: 1 },
      { midi: 67, beats: 2 }, { midi: null, beats: 2 },
      { midi: 64, beats: 1 }, { midi: 67, beats: 1 }, { midi: 71, beats: 1 }, { midi: 69, beats: 1 },
      { midi: 67, beats: 1 }, { midi: 67, beats: 0.5 }, { midi: 64, beats: 0.5 }, { midi: 64, beats: 2 },
      { midi: 65, beats: 1 }, { midi: 69, beats: 1 }, { midi: 67, beats: 1 }, { midi: 65, beats: 1 },
      { midi: 64, beats: 1 }, { midi: 62, beats: 1 }, { midi: 60, beats: 2 }
    ],
    piano: [
      { midi: 48, beats: 2 }, { midi: 64, beats: 1 }, { midi: 67, beats: 1 },
      { midi: 57, beats: 2 }, { midi: 60, beats: 1 }, { midi: 64, beats: 1 },
      { midi: 53, beats: 2 }, { midi: 57, beats: 1 }, { midi: 60, beats: 1 },
      { midi: 55, beats: 2 }, { midi: 59, beats: 1 }, { midi: 62, beats: 1 },
      { midi: 52, beats: 2 }, { midi: 55, beats: 1 }, { midi: 59, beats: 1 },
      { midi: 57, beats: 2 }, { midi: 60, beats: 1 }, { midi: 64, beats: 1 },
      { midi: 53, beats: 2 }, { midi: 57, beats: 1 }, { midi: 60, beats: 1 },
      { midi: 48, beats: 4 }
    ],
    organ: [
      { midi: 60, beats: 4 }, { midi: 57, beats: 4 }, { midi: 53, beats: 4 }, { midi: 55, beats: 4 },
      { midi: 52, beats: 4 }, { midi: 57, beats: 4 }, { midi: 53, beats: 4 }, { midi: 60, beats: 4 }
    ]
  },
  'diem-xua': {
    melody: [
      { midi: 69, beats: 1 }, { midi: 71, beats: 1 }, { midi: 72, beats: 1 }, { midi: 71, beats: 1 },
      { midi: 69, beats: 1 }, { midi: 65, beats: 1 }, { midi: 62, beats: 2 },
      { midi: 64, beats: 1 }, { midi: 68, beats: 1 }, { midi: 71, beats: 1 }, { midi: 74, beats: 1 },
      { midi: 72, beats: 1 }, { midi: 71, beats: 1 }, { midi: 69, beats: 2 },
      { midi: 69, beats: 1 }, { midi: 71, beats: 1 }, { midi: 72, beats: 2 },
      { midi: 74, beats: 1 }, { midi: 72, beats: 1 }, { midi: 71, beats: 1 }, { midi: 69, beats: 1 },
      { midi: 68, beats: 1 }, { midi: 71, beats: 1 }, { midi: 64, beats: 2 },
      { midi: 69, beats: 2 }, { midi: null, beats: 2 }
    ]
  },
  'tien-quan-ca': {
    melody: [
      { midi: 60, beats: 1 }, { midi: 64, beats: 1 }, { midi: 67, beats: 1 }, { midi: 67, beats: 1 },
      { midi: 69, beats: 1 }, { midi: 71, beats: 1 }, { midi: 67, beats: 2 },
      { midi: 64, beats: 1 }, { midi: 67, beats: 1 }, { midi: 72, beats: 1 }, { midi: 72, beats: 1 },
      { midi: 74, beats: 1 }, { midi: 71, beats: 1 }, { midi: 67, beats: 2 },
      { midi: 72, beats: 1 }, { midi: 67, beats: 1 }, { midi: 64, beats: 1 }, { midi: 67, beats: 1 },
      { midi: 69, beats: 2 }, { midi: 72, beats: 2 },
      { midi: 67, beats: 1 }, { midi: 64, beats: 1 }, { midi: 62, beats: 1 }, { midi: 64, beats: 1 },
      { midi: 60, beats: 2 }, { midi: null, beats: 2 }
    ]
  },
  'ha-trang': {
    melody: [
      { midi: 67, beats: 1 }, { midi: 67, beats: 1 }, { midi: 64, beats: 1 }, { midi: 67, beats: 1 },
      { midi: 69, beats: 1 }, { midi: 67, beats: 1 }, { midi: 64, beats: 2 },
      { midi: 65, beats: 1 }, { midi: 69, beats: 1 }, { midi: 72, beats: 1 }, { midi: 69, beats: 1 },
      { midi: 67, beats: 2 }, { midi: null, beats: 2 },
      { midi: 67, beats: 1 }, { midi: 64, beats: 1 }, { midi: 60, beats: 1 }, { midi: 62, beats: 1 },
      { midi: 64, beats: 2 }, { midi: 69, beats: 2 },
      { midi: 62, beats: 1 }, { midi: 65, beats: 1 }, { midi: 67, beats: 1 }, { midi: 71, beats: 1 },
      { midi: 60, beats: 2 }, { midi: null, beats: 2 }
    ]
  },
  'buoc-qua-nhau': {
    melody: [
      { midi: 62, beats: 1 }, { midi: 67, beats: 1 }, { midi: 71, beats: 1 }, { midi: 69, beats: 1 },
      { midi: 66, beats: 1 }, { midi: 64, beats: 1 }, { midi: 62, beats: 2 },
      { midi: 64, beats: 1 }, { midi: 67, beats: 1 }, { midi: 71, beats: 1 }, { midi: 69, beats: 1 },
      { midi: 66, beats: 2 }, { midi: null, beats: 2 },
      { midi: 64, beats: 1 }, { midi: 67, beats: 1 }, { midi: 72, beats: 1 }, { midi: 71, beats: 1 },
      { midi: 71, beats: 1 }, { midi: 69, beats: 1 }, { midi: 67, beats: 2 },
      { midi: 69, beats: 1 }, { midi: 72, beats: 1 }, { midi: 71, beats: 1 }, { midi: 69, beats: 1 },
      { midi: 67, beats: 2 }, { midi: null, beats: 2 }
    ]
  },
  'la-lung': {
    melody: [
      { midi: 64, beats: 1 }, { midi: 67, beats: 1 }, { midi: 64, beats: 1 }, { midi: 62, beats: 1 },
      { midi: 62, beats: 1 }, { midi: 60, beats: 1 }, { midi: 62, beats: 2 },
      { midi: 60, beats: 1 }, { midi: 64, beats: 1 }, { midi: 69, beats: 1 }, { midi: 67, beats: 1 },
      { midi: 64, beats: 2 }, { midi: null, beats: 2 },
      { midi: 65, beats: 1 }, { midi: 69, beats: 1 }, { midi: 72, beats: 1 }, { midi: 69, beats: 1 },
      { midi: 67, beats: 1 }, { midi: 64, beats: 1 }, { midi: 60, beats: 2 },
      { midi: 62, beats: 1 }, { midi: 65, beats: 1 }, { midi: 64, beats: 1 }, { midi: 62, beats: 1 },
      { midi: 60, beats: 2 }, { midi: null, beats: 2 }
    ]
  },
  'di-ve-nha': {
    melody: [
      { midi: 65, beats: 1 }, { midi: 69, beats: 1 }, { midi: 72, beats: 1 }, { midi: 69, beats: 1 },
      { midi: 72, beats: 1 }, { midi: 71, beats: 1 }, { midi: 69, beats: 2 },
      { midi: 70, beats: 1 }, { midi: 70, beats: 1 }, { midi: 69, beats: 1 }, { midi: 67, beats: 1 },
      { midi: 67, beats: 2 }, { midi: null, beats: 2 },
      { midi: 69, beats: 1 }, { midi: 72, beats: 1 }, { midi: 69, beats: 1 }, { midi: 65, beats: 1 },
      { midi: 64, beats: 1 }, { midi: 67, beats: 1 }, { midi: 69, beats: 2 },
      { midi: 65, beats: 1 }, { midi: 67, beats: 1 }, { midi: 69, beats: 1 }, { midi: 67, beats: 1 },
      { midi: 65, beats: 2 }, { midi: null, beats: 2 }
    ]
  },
  'thuyen-va-bien': {
    melody: [
      { midi: 62, beats: 1 }, { midi: 65, beats: 1 }, { midi: 69, beats: 1 }, { midi: 67, beats: 1 },
      { midi: 70, beats: 1 }, { midi: 69, beats: 1 }, { midi: 67, beats: 2 },
      { midi: 65, beats: 1 }, { midi: 69, beats: 1 }, { midi: 74, beats: 1 }, { midi: 72, beats: 1 },
      { midi: 69, beats: 2 }, { midi: null, beats: 2 },
      { midi: 67, beats: 1 }, { midi: 70, beats: 1 }, { midi: 74, beats: 1 }, { midi: 72, beats: 1 },
      { midi: 69, beats: 1 }, { midi: 65, beats: 1 }, { midi: 62, beats: 2 },
      { midi: 64, beats: 1 }, { midi: 67, beats: 1 }, { midi: 65, beats: 1 }, { midi: 64, beats: 1 },
      { midi: 62, beats: 2 }, { midi: null, beats: 2 }
    ]
  },
  've-que-ngoai': {
    melody: [
      { midi: 60, beats: 1 }, { midi: 64, beats: 1 }, { midi: 67, beats: 1 }, { midi: 69, beats: 1 },
      { midi: 72, beats: 1 }, { midi: 69, beats: 1 }, { midi: 67, beats: 2 },
      { midi: 69, beats: 1 }, { midi: 72, beats: 1 }, { midi: 69, beats: 1 }, { midi: 65, beats: 1 },
      { midi: 62, beats: 2 }, { midi: null, beats: 2 },
      { midi: 64, beats: 1 }, { midi: 67, beats: 1 }, { midi: 72, beats: 1 }, { midi: 71, beats: 1 },
      { midi: 69, beats: 1 }, { midi: 67, beats: 1 }, { midi: 64, beats: 2 },
      { midi: 62, beats: 1 }, { midi: 65, beats: 1 }, { midi: 64, beats: 1 }, { midi: 62, beats: 1 },
      { midi: 60, beats: 2 }, { midi: null, beats: 2 }
    ]
  },
  'em-ve-tinh-khoi': {
    melody: [
      { midi: 71, beats: 1 }, { midi: 74, beats: 1 }, { midi: 71, beats: 1 }, { midi: 69, beats: 1 },
      { midi: 67, beats: 1 }, { midi: 64, beats: 1 }, { midi: 64, beats: 2 },
      { midi: 64, beats: 1 }, { midi: 67, beats: 1 }, { midi: 72, beats: 1 }, { midi: 71, beats: 1 },
      { midi: 69, beats: 2 }, { midi: null, beats: 2 },
      { midi: 62, beats: 1 }, { midi: 67, beats: 1 }, { midi: 71, beats: 1 }, { midi: 69, beats: 1 },
      { midi: 67, beats: 1 }, { midi: 64, beats: 1 }, { midi: 71, beats: 2 },
      { midi: 72, beats: 1 }, { midi: 71, beats: 1 }, { midi: 69, beats: 1 }, { midi: 66, beats: 1 },
      { midi: 67, beats: 2 }, { midi: null, beats: 2 }
    ]
  },
  'mot-tinh-yeu-nho': {
    melody: [
      { midi: 60, beats: 1 }, { midi: 64, beats: 1 }, { midi: 67, beats: 1 }, { midi: 64, beats: 1 },
      { midi: 69, beats: 1 }, { midi: 67, beats: 1 }, { midi: 64, beats: 2 },
      { midi: 65, beats: 1 }, { midi: 69, beats: 1 }, { midi: 72, beats: 1 }, { midi: 69, beats: 1 },
      { midi: 67, beats: 2 }, { midi: null, beats: 2 },
      { midi: 67, beats: 1 }, { midi: 72, beats: 1 }, { midi: 76, beats: 1 }, { midi: 74, beats: 1 },
      { midi: 72, beats: 1 }, { midi: 69, beats: 1 }, { midi: 67, beats: 2 },
      { midi: 65, beats: 1 }, { midi: 69, beats: 1 }, { midi: 67, beats: 1 }, { midi: 62, beats: 1 },
      { midi: 60, beats: 2 }, { midi: null, beats: 2 }
    ]
  },
  'de-nho-mot-thoi-ta-da-yeu': {
    melody: [
      { midi: 69, beats: 1 }, { midi: 72, beats: 1 }, { midi: 76, beats: 1 }, { midi: 74, beats: 1 },
      { midi: 74, beats: 1 }, { midi: 77, beats: 1 }, { midi: 74, beats: 2 },
      { midi: 71, beats: 1 }, { midi: 74, beats: 1 }, { midi: 79, beats: 1 }, { midi: 77, beats: 1 },
      { midi: 76, beats: 2 }, { midi: null, beats: 2 },
      { midi: 69, beats: 1 }, { midi: 72, beats: 1 }, { midi: 77, beats: 1 }, { midi: 76, beats: 1 },
      { midi: 74, beats: 1 }, { midi: 77, beats: 1 }, { midi: 74, beats: 2 },
      { midi: 71, beats: 1 }, { midi: 74, beats: 1 }, { midi: 72, beats: 1 }, { midi: 71, beats: 1 },
      { midi: 69, beats: 2 }, { midi: null, beats: 2 }
    ]
  }
};

export const autoSheetEngine = new AutoSheetEngine();

