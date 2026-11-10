import { decodeEntities, escapeText } from './text.js';
import { transpose } from './chords.js';

const chordPattern = /\[([A-G][#b]?[a-zA-Z0-9+#b/()\-]*)\]/g;
const groupPattern = /((?:\[[A-G][#b]?[a-zA-Z0-9+#b/()\-]*\][ \t]*)+)([^\s\[]*)/g;

export function renderLyrics(content, shift = 0, hideChords = false) {
  return decodeEntities(content).replace(/\r\n?/g, '\n').split('\n').map(line => {
    if (hideChords) return '<div class="lyric-line">' + (escapeText(line.replace(chordPattern, '')) || '<br>') + '</div>';
    let position = 0, rendered = '';
    for (const match of line.matchAll(groupPattern)) {
      rendered += escapeText(line.slice(position, match.index));
      const chords = escapeText(match[1]).replace(chordPattern, (_, chord) => '<b class="chord">[' + transpose(chord, shift) + ']</b>');
      rendered += '<span class="chord-word">' + chords + escapeText(match[2]) + '</span>';
      position = match.index + match[0].length;
    }
    rendered += escapeText(line.slice(position));
    return '<div class="lyric-line">' + (rendered || '<br>') + '</div>';
  }).join('');
}

export function readerFont(value) {
  const size = Number(value);
  return Number.isFinite(size) && size >= 14 && size <= 40 ? size : 20;
}
