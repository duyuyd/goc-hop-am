import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSongSheet } from '../public/mobile/song-sheet.js';

class Element {
  fields = new Map();
  style = {};
  value = '';
  querySelector(selector) {
    if (!this.fields.has(selector)) this.fields.set(selector, new Element());
    return this.fields.get(selector);
  }
  append() {}
  replaceChildren() {}
  scrollIntoView() {}
  getContext() { return {}; }
}

function pdf(numPages) {
  return {
    numPages, destroyed: false,
    async getPage() {
      return {
        getViewport: () => ({ width: 500, height: 700 }),
        render: () => ({ cancel() {}, promise: Promise.resolve() }),
      };
    },
  };
}

test('an older pending PDF never replaces the new song or re-enables the old download', async () => {
  const originalDocument = globalThis.document;
  const originalEngine = globalThis.GocPdf;
  const oldPdf = pdf(1), newPdf = pdf(2);
  let finishOld;
  const oldPending = new Promise(resolve => { finishOld = resolve; });
  globalThis.document = { createElement: () => new Element() };
  globalThis.GocPdf = { getDocument: ({ data }) => {
    const documentPdf = data[0] === 1 ? oldPdf : newPdf;
    return {
      promise: documentPdf === oldPdf ? oldPending : Promise.resolve(newPdf),
      async destroy() { documentPdf.destroyed = true; },
    };
  } };
  try {
    const host = { clientWidth: 800, prepend(panel) { this.panel = panel; } };
    let song = { sourceUrl: 'https://example.test/one' };
    const sheet = createSongSheet({ host, getSong: () => song, native: true, async call(action, { path }) {
      assert.equal(action, 'api');
      const request = new URL(path, 'https://test.example');
      if (!request.searchParams.has('part')) return { available: true, files: [{ index: 0, name: 'Score.pdf' }] };
      const old = request.searchParams.get('url').endsWith('/one');
      return { base64: old ? 'AQ==' : 'Ag==', part: 0, parts: 1, totalBytes: 1 };
    } });
    const state = name => host.panel.querySelector(`[data-ss="${name}"]`);
    const settle = () => new Promise(resolve => setImmediate(resolve));
    sheet.open();
    await settle();
    song = { sourceUrl: 'https://example.test/two' };
    sheet.setSong();
    assert.equal(sheet.isOpen, false);
    assert.equal(state('pdf').disabled, true);
    sheet.open();
    await settle();
    assert.equal(state('page').textContent, 'Trang 1 / 2');
    finishOld(oldPdf);
    await settle();
    assert.equal(oldPdf.destroyed, true);
    assert.equal(newPdf.destroyed, false);
    assert.equal(state('page').textContent, 'Trang 1 / 2');
    sheet.setSong();
    assert.equal(newPdf.destroyed, true);
  } finally {
    globalThis.document = originalDocument;
    globalThis.GocPdf = originalEngine;
  }
});

test('opening a local PDF only uses local bytes and closes the document', async () => {
  const originalDocument = globalThis.document;
  const originalEngine = globalThis.GocPdf;
  const originalFetch = globalThis.fetch;
  const documentPdf = pdf(3);
  let requests = 0, destroyed = false;
  globalThis.document = {createElement: () => new Element()};
  globalThis.fetch = async () => { requests++; throw new Error('Unexpected network request'); };
  globalThis.GocPdf = {getDocument({data}) {
    assert.equal(new TextDecoder().decode(data), '%PDF-1.4\n');
    return {promise: Promise.resolve(documentPdf), async destroy() { destroyed = true; }};
  }};
  try {
    const host = {clientWidth: 800, prepend(panel) { this.panel = panel; }};
    const reader = createSongSheet({host});
    const state = name => host.panel.querySelector(`[data-ss="${name}"]`);
    await assert.rejects(() => reader.openLocal(new Uint8Array([1,2,3]), 'file.pdf'), /định dạng PDF/);
    await reader.openLocal(new TextEncoder().encode('%PDF-1.4\n'), 'Bản phổ.pdf');
    assert.equal(reader.isOpen, true);
    assert.equal(state('page').textContent, 'Trang 1 / 3');
    assert.equal(state('source').textContent, 'Bản phổ.pdf');
    assert.equal(state('reload').hidden, true);
    assert.equal(state('pdf').hidden, true);
    assert.equal(requests, 0);
    state('close').onclick();
    assert.equal(reader.isOpen, false);
    assert.equal(destroyed, true);
  } finally {
    globalThis.document = originalDocument;
    globalThis.GocPdf = originalEngine;
    globalThis.fetch = originalFetch;
  }
});
