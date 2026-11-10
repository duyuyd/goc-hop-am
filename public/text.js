import { entities } from './entities.js';

// Decode text, never HTML. Callers escape before inserting it into the DOM.
export function decodeEntities(value = '') {
  let text = String(value);
  for (let pass = 0; pass < 3; pass++) {
    const decoded = text.replace(/&(#x[\da-f]+|#\d+|[a-z][a-z\d]+);/gi, (raw, code) => {
      if (code[0] !== '#') return entities[code] ?? raw;
      const number = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff)
        ? String.fromCodePoint(number) : '\ufffd';
    });
    if (decoded === text) break;
    text = decoded;
  }
  return text.normalize('NFC');
}

export const escapeText = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

export const foldText = value => decodeEntities(value).normalize('NFD')
  .replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim();
