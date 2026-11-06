import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeScore, repairScore, midiToNoteName, scoreToMusicXML} from '../public/mobile/score-io.js';
import {autoSheetEngine} from '../lib/auto-sheet-engine.mjs';
import {musicCatalog} from '../lib/music-catalog.mjs';

test('analyzeScore provides rigorous musical metrics, vocal range, and meter audit', () => {
  const sampleScore = {
    format: 'goc-score-1',
    title: 'Bài Ca Hy Vọng',
    author: 'Văn Ký',
    bpm: 80,
    notes: [
      {midi: 60, beats: 1}, // C4
      {midi: 62, beats: 1}, // D4
      {midi: 64, beats: 1}, // E4
      {midi: 65, beats: 1}, // F4 (Measure 1: 4 beats)
      {midi: 67, beats: 2}, // G4
      {midi: null, beats: 2} // Rest (Measure 2: 4 beats)
    ],
    origin: 'verified',
    verified: true
  };

  const analysis = analyzeScore(sampleScore);
  assert.equal(analysis.notesCount, 6);
  assert.equal(analysis.measureCount, 2);
  assert.equal(analysis.beatsTotal, 8);
  assert.equal(analysis.meterFit, true);
  assert.equal(analysis.pitchRange.minMidi, 60);
  assert.equal(analysis.pitchRange.maxMidi, 67);
  assert.equal(analysis.pitchRange.minName, 'C4');
  assert.equal(analysis.pitchRange.maxName, 'G4');
  assert.equal(analysis.pitchRange.semitones, 7);
  assert.equal(analysis.smoothness.stepwisePercent, 100); // C->D->E->F->G are all stepwise
  assert.ok(analysis.integrityScore >= 95, `Expected score >= 95, got ${analysis.integrityScore}`);
  assert.equal(analysis.warnings.length, 0);
  assert.equal(analysis.rhythmProfile.quarter, 4);
  assert.equal(analysis.rhythmProfile.half, 1);
  assert.equal(analysis.rhythmProfile.rests, 1);
});

test('analyzeScore detects unclosed bars, extreme leaps, and out-of-comfort tessitura', () => {
  const flawedScore = {
    format: 'goc-score-1',
    title: 'Bản Nhạc Lỗi',
    author: 'Test',
    bpm: 100,
    notes: [
      {midi: 48, beats: 1}, // C3 (very low)
      {midi: 84, beats: 1}, // C6 (36 semitone leap!)
      {midi: 80, beats: 1}  // G#5
      // Total 3 beats -> bar is incomplete (unclosed bar)
    ]
  };

  const analysis = analyzeScore(flawedScore);
  assert.equal(analysis.meterFit, false);
  assert.ok(analysis.warnings.some(w => w.includes('Ô nhịp cuối chưa đủ 4 phách')));
  assert.ok(analysis.warnings.some(w => w.includes('quãng nhảy xa') || w.includes('quãng xa')));
  assert.ok(analysis.integrityScore < 90);
});

test('repairScore self-heals corrupted, out-of-range, and malformed sheets into 100% valid 4/4 scores', () => {
  const corruptedRaw = {
    title: 'Sheet Bị Lỗi Dạng',
    author: 'Chưa Rõ',
    bpm: 300, // exceeds max 240
    notes: [
      {midi: 20, beats: 0.33},  // pitch 20 is too low (<48), beat 0.33 invalid
      {midi: 110, beats: 1.5},  // pitch 110 too high (>84), beat 1.5 invalid
      {midi: NaN, beats: 2},    // NaN pitch
      {midi: 60, beats: 3},     // 3 beats in measure that already has beats -> overflow test
      {midi: 64, beats: 1}
      // Ends on incomplete measure
    ]
  };

  const repaired = repairScore(corruptedRaw);
  assert.equal(repaired.format, 'goc-score-1');
  assert.equal(repaired.bpm, 240); // clamped to max
  assert.ok(repaired.notes.length >= 4);

  // Check all pitches are in [48, 84] or null
  for (const n of repaired.notes) {
    if (n.midi !== null) {
      assert.ok(Number.isInteger(n.midi), 'MIDI must be integer');
      assert.ok(n.midi >= 48 && n.midi <= 84, `MIDI ${n.midi} out of [48, 84]`);
    }
    assert.ok([0.5, 1, 2, 4].includes(n.beats), `Beats ${n.beats} must be in [0.5, 1, 2, 4]`);
  }

  // Check 4/4 meter integrity: total beats must be an exact multiple of 4
  const totalBeats = repaired.notes.reduce((s, n) => s + n.beats, 0);
  assert.equal(totalBeats % 4, 0, `Total beats ${totalBeats} must be a multiple of 4`);

  // Check no measure overflows:
  let b = 0;
  for (const n of repaired.notes) {
    assert.ok((b % 4) + n.beats <= 4.0001, `Note at beat ${b} with length ${n.beats} exceeds bar`);
    b += n.beats;
  }

  // Must export cleanly to MusicXML without throwing
  const xml = scoreToMusicXML(repaired);
  assert.ok(xml.includes('<?xml version="1.0"'));
  assert.ok(xml.includes('<score-partwise'));
});

test('autoSheetEngine refuses to invent melody from a corrupted audio file', async () => {
  // Create an engine instance
  const brokenAudioBytes = new Uint8Array([0, 1, 2, 3, 4]); // Not a valid audio file
  
  // Submit a job with broken content to simulate failure
  const { job } = autoSheetEngine.createJob({
    type: 'audio',
    content: brokenAudioBytes,
    songId: 'nang-tho'
  });

  // Invalid input must not be silently turned into a fake successful sheet.
  const processed = await autoSheetEngine.processJob(job.jobId);
  assert.equal(processed.status, 'failed');
  assert.deepEqual(processed.notes, []);
  assert.equal(processed.musicxml, null);
  assert.equal(processed.confidence, null);
});

test('browseCatalogSheets audits 100% catalog songs with full analysis and valid 4/4 meter', () => {
  const songs = musicCatalog.listSongs();
  assert.ok(songs.length >= 12, 'Catalog should have at least 12 songs');

  const browseReport = autoSheetEngine.browseCatalogSheets(songs);
  assert.equal(browseReport.total, songs.length);
  assert.ok(browseReport.sheets.length === songs.length);
  assert.ok(browseReport.avgScore >= 90, `Average integrity score ${browseReport.avgScore} should be >= 90`);

  for (const s of browseReport.sheets) {
    assert.ok(s.id, 'Sheet must have song ID');
    assert.ok(s.title, 'Sheet must have title');
    assert.ok(s.notesCount > 0, 'Sheet must have notes');
    assert.ok(s.analysis, 'Analysis must exist for every catalog song');
    assert.equal(s.analysis.meterFit, true, `Song ${s.id} sheet must fit 4/4 meter`);
    assert.ok(s.analysis.integrityScore >= 80, `Song ${s.id} integrity score must be >= 80`);
  }
});
