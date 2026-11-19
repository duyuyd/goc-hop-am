import assert from 'node:assert/strict';
import {
  importedSongId, songUrl, songReferenceId, songReaderPath,
} from '../public/mobile/logic.js';

const source = 'goc-import:live-e2e-1763587000000';
const expected = 'live-e2e-1763587000000';
assert.equal(importedSongId(source), expected);
assert.equal(songUrl(source), source);
assert.equal(songReferenceId(source), 'goc-import-' + expected);
assert.equal(songReaderPath(source), '/api/reader?imported=' + expected);
for (const bad of [
  'goc-import:', 'goc-import:UPPER', 'goc-import:../../admin',
  'goc-import:https://evil.test', 'goc-import:a?x=1',
]) {
  assert.equal(importedSongId(bad), null, bad);
  assert.equal(songUrl(bad), null, bad);
}
console.log('PASS: imported song references validate and resolve through D1 reader.');
