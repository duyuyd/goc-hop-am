import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(readFileSync(resolve(root, 'public/ban-pho/catalog.json'), 'utf8'));

test('open score catalogue keeps unique records and verified local Commons files', () => {
  assert.equal(new Set(catalog.items.map(item => item.id)).size, catalog.items.length);
  const local = catalog.items.filter(item => item.source === 'commons');
  assert.equal(local.length, 10);
  assert.equal(local.filter(item => item.genre === 'Nhạc Trẻ').length, 2);
  for (const item of local) {
    assert.match(item.license, /^(?:Public domain|CC BY(?:-SA)? [34]\.0)$/);
    const bytes = readFileSync(resolve(root, 'public/ban-pho', item.asset));
    const digest = createHash('sha1').update(bytes).digest('hex');
    assert.ok(item.asset.includes(digest.slice(0, 10)), item.title);
    if (item.format === 'pdf') assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    else if (item.format === 'png') assert.deepEqual([...bytes.subarray(0, 8)], [137,80,78,71,13,10,26,10]);
    else if (item.format === 'jpg') {
      assert.deepEqual([...bytes.subarray(0, 3)], [255,216,255]);
      assert.deepEqual([...bytes.subarray(-2)], [255,217]);
    } else assert.fail('Định dạng tệp cục bộ chưa được kiểm tra: ' + item.format);
  }
});
