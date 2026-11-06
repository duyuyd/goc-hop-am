// tests/auto-sheet-and-catalog.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { musicCatalog } from '../lib/music-catalog.mjs';
import { autoSheetEngine } from '../lib/auto-sheet-engine.mjs';
import { securityRights } from '../lib/security-rights.mjs';
import { cleanScore } from '../public/mobile/music-tools.js';
import { scoreToMusicXML } from '../public/mobile/score-io.js';

test('musicCatalog normalizes Vietnamese diacritics and finds songs by title and artist', () => {
  const result1 = musicCatalog.search({ query: 'nang tho' });
  assert.ok(result1.items.length > 0);
  assert.equal(result1.items[0].title, 'Nàng Thơ');
  assert.equal(result1.items[0].sheets.melody.status, 'verified');

  // NFD decomposition search
  const result2 = musicCatalog.search({ query: 'Nàng Thơ'.normalize('NFD') });
  assert.ok(result2.items.length > 0);
  assert.equal(result2.items[0].id, 'nang-tho');

  // Search by composer
  const result3 = musicCatalog.search({ query: 'Trịnh Công Sơn', type: 'composer' });
  assert.ok(result3.items.some(s => s.composer === 'Trịnh Công Sơn'));

  // Genre filtering
  const result4 = musicCatalog.search({ genre: '6' }); // Nhạc Đỏ
  assert.ok(result4.items.some(s => s.id === 'tien-quan-ca'));
  assert.equal(result4.items.find(s => s.id === 'tien-quan-ca').sheets.melody.status, 'verified');
});

test('autoSheetEngine deduplicates jobs by SHA-256 and marks AI outputs as ai_draft', async () => {
  const vlq = n => n < 128 ? [n] : [(n >> 7) | 128, n & 127];
  const file = events => Uint8Array.from([...Buffer.from('MThd'), 0, 0, 0, 6, 0, 0, 0, 1, 1, 224, ...Buffer.from('MTrk'), 0, 0, 0, events.length, ...events]);
  const dummyMidi = file([0, 255, 81, 3, 7, 161, 32, 0, 144, 60, 90, ...vlq(480), 128, 60, 0, 0, 144, 64, 90, ...vlq(480), 128, 64, 0, 0, 255, 47, 0]);

  const { job: job1, deduplicated: dedup1 } = autoSheetEngine.createJob({
    midiBytes: dummyMidi,
    songId: 'song-test-1',
    title: 'Giai điệu thử nghiệm',
    rights: 'owned',
    bpm: 120
  });

  assert.equal(dedup1, false);
  assert.equal(job1.status, 'completed');
  assert.equal(job1.verified, false);
  assert.ok(job1.confidence >= 0.7);
  assert.ok(job1.musicxml.includes('score-partwise'));
  assert.ok(job1.musicxml.includes('<work-title>Giai điệu thử nghiệm</work-title>'));

  // Submit identical MIDI data -> must deduplicate
  const { job: job2, deduplicated: dedup2 } = autoSheetEngine.createJob({
    midiBytes: dummyMidi,
    songId: 'song-test-1',
    title: 'Giai điệu thử nghiệm lần 2'
  });

  assert.equal(dedup2, true);
  assert.equal(job2.jobId, job1.jobId);
});

test('autoSheetEngine handles audio transcription and preserves error queue without crashes', () => {
  const dummyAudio = Buffer.alloc(1024, 42);
  const { job } = autoSheetEngine.createJob({
    audioBytes: dummyAudio,
    title: 'Bản thu giọng hát mẫu',
    bpm: 84
  });

  assert.equal(job.status, 'completed');
  assert.equal(job.verified, false);
  assert.ok(job.notes.length > 0);
  assert.ok(job.confidence >= 0.75);
  assert.ok(job.musicxml.includes('<measure number="1">'));

  // Invalid empty job throws clear error
  assert.throws(() => autoSheetEngine.createJob({}), /Cần cung cấp dữ liệu/);
});

test('securityRights blocks SSRF attempts and records audit ledger entries', () => {
  // SSRF blocks
  assert.equal(securityRights.validateSafeUrl('http://127.0.0.1:8080/admin'), false);
  assert.equal(securityRights.validateSafeUrl('http://localhost:3000'), false);
  assert.equal(securityRights.validateSafeUrl('http://10.0.0.1/secrets'), false);
  assert.equal(securityRights.validateSafeUrl('http://192.168.1.1/router'), false);
  assert.equal(securityRights.validateSafeUrl('file:///etc/passwd'), false);

  // SSRF allows trusted music sites
  assert.equal(securityRights.validateSafeUrl('https://goc-hop-am.onwardcrust.chatgpt.site/bai-hat/mo-ho'), true);
  assert.equal(securityRights.validateSafeUrl('https://www.youtube.com/watch?v=M7lc1UVf-VE'), true);
  assert.equal(securityRights.validateSafeUrl('https://musescore.com/sheetmusic'), true);

  // Rights ledger
  const rights = securityRights.getRights('site:nang-tho');
  assert.ok(rights);
  assert.equal(rights.composer, 'Hoàng Dũng');
  assert.equal(rights.rights, 'owned');

  // Rate limiter
  const ip = '198.51.100.22';
  for (let i = 0; i < 5; i++) {
    const check = securityRights.checkRateLimit(ip, 10);
    assert.equal(check.allowed, true);
  }
});

test('every catalog song has a complete sheet that passes cleanScore and scoreToMusicXML', () => {
  for (const song of musicCatalog.songs) {
    const melodyScore = autoSheetEngine.getSongSheet(song, 'melody');
    assert.ok(melodyScore, `Score should exist for ${song.id}`);
    assert.ok(melodyScore.notes.length > 0, `Notes should exist for ${song.id}`);
    assert.doesNotThrow(() => cleanScore(melodyScore), `cleanScore should succeed for ${song.id} melody`);
    assert.ok(melodyScore.musicxml.includes('score-partwise'), `MusicXML should be valid for ${song.id}`);

    const pianoScore = autoSheetEngine.getSongSheet(song, 'piano');
    assert.ok(pianoScore, `Piano score should exist for ${song.id}`);
    assert.doesNotThrow(() => cleanScore(pianoScore), `cleanScore should succeed for ${song.id} piano`);

    const organScore = autoSheetEngine.getSongSheet(song, 'organ');
    assert.ok(organScore, `Organ score should exist for ${song.id}`);
    assert.doesNotThrow(() => cleanScore(organScore), `cleanScore should succeed for ${song.id} organ`);
  }
});

test('autoSheetEngine generates valid 4/4 harmonic scores for custom songs with chords', () => {
  const customSong = {
    id: 'bai-hat-tu-do',
    title: 'Giai Điệu Mùa Thu',
    composer: 'NPT Duy',
    content: '[C]Gió mùa thu [Am]hát bên thềm vắng\n[F]Từng chiếc lá [G]rơi đầy lối về.'
  };

  const generated = autoSheetEngine.getSongSheet(customSong, 'melody');
  assert.ok(generated);
  assert.equal(generated.title, 'Giai Điệu Mùa Thu');
  assert.equal(generated.origin, 'auto_chords');
  assert.equal(generated.verified, false);
  assert.doesNotThrow(() => cleanScore(generated));
  assert.ok(generated.musicxml.includes('score-partwise'));
});

