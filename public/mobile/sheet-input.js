// Convert supported sources to editable, single-voice 4/4 notation.
export const sheetMaxNotes = 1024;
export const sheetDurations = [.25, .5, .75, 1, 1.5, 2, 3, 4];
export const sheetHarmonyKinds = {'':'major',m:'minor',7:'dominant',maj7:'major-seventh',m7:'minor-seventh',dim:'diminished',aug:'augmented',sus2:'suspended-second',sus4:'suspended-fourth',6:'major-sixth',m6:'minor-sixth',m7b5:'half-diminished',dim7:'diminished-seventh',9:'dominant-ninth',m9:'minor-ninth',maj9:'major-ninth',mMaj7:'major-minor',add9:'major'};
const sheetChordPitches = {'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'E#':5,'Fb':4,'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11,'B#':0,'Cb':11};
const sheetChordNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const sheetChordAliases = {maj:'',M:'',M7:'maj7',M9:'maj9',min:'m',min7:'m7',min9:'m9','-':'m','-7':'m7','+':'aug','°':'dim','°7':'dim7','ø':'m7b5','ø7':'m7b5','Δ':'maj7','Δ7':'maj7',sus:'sus4'};
const sheetExtendedChords = {m7b5:[0,3,6,10],dim7:[0,3,6,9],9:[0,4,7,10,14],m9:[0,3,7,10,14],maj9:[0,4,7,11,14],mMaj7:[0,3,7,11],'7sus4':[0,5,7,10]};

const sheetBpm = value => {
  if (!Number.isFinite(value) || value < 40 || value > 240) {
    throw new Error('Studio hỗ trợ tốc độ từ 40 đến 240 BPM.');
  }
  return Math.round(value * 100) / 100;
};

function sheetSequence() {
  const notes = [];
  let position = 0;
  return {
    notes,
    get position() { return position; },
    append(midi, units, extras = {}) {
      while (units > 0) {
        if (notes.length === sheetMaxNotes) throw new Error('Bản phổ vượt quá 1.024 nốt và dấu lặng. Hãy chia tệp thành các đoạn.');
        const space = 16 - position % 16;
        const duration = [16, 12, 8, 6, 4, 3, 2, 1].find(value => value <= units && value <= space);
        units -= duration;
        notes.push({midi, beats: duration / 4, ...extras, ...(midi !== null && (units || extras.tie) ? {tie: true} : {})});
        extras = extras.tie ? {tie: true} : {};
        position += duration;
      }
    }
  };
}

function sheetVlq(bytes, index, end) {
  let value = 0;
  for (let i = 0; i < 4 && index < end; i++) {
    const byte = bytes[index++];
    value = (value << 7) | (byte & 127);
    if (byte < 128) return [value, index];
  }
  throw new Error('MIDI có thời gian không hợp lệ.');
}

export function midiToSheet(source, title = 'Bản nhạc MIDI') {
  const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
  const tag = index => String.fromCharCode(...bytes.subarray(index, index + 4));
  if (bytes.length < 14 || bytes.length > 3_000_000 || tag(0) !== 'MThd') {
    throw new Error('Chọn tệp .mid hoặc .midi hợp lệ, tối đa 3 MB.');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const header = view.getUint32(4), format = view.getUint16(8), count = view.getUint16(10), ppq = view.getUint16(12);
  if (header < 6 || header > 256 || format > 1 || !count || count > 64 || (format === 0 && count !== 1) || !ppq || (ppq & 32768)) {
    throw new Error('Chỉ hỗ trợ MIDI loại 0 hoặc 1 với thời gian tính theo phách.');
  }

  let index = 8 + header, tempo = null;
  const voices = [];
  for (let track = 0; track < count; track++) {
    if (index + 8 > bytes.length || tag(index) !== 'MTrk') throw new Error('Thiếu track MIDI.');
    const end = index + 8 + view.getUint32(index + 4);
    if (end > bytes.length) throw new Error('Track MIDI bị cắt.');
    index += 8;
    let tick = 0, running = 0;
    const active = new Map(), channels = new Map();
    while (index < end) {
      let delta;
      [delta, index] = sheetVlq(bytes, index, end);
      tick += delta;
      if (index === end) throw new Error('Thiếu sự kiện MIDI.');
      let status = bytes[index];
      if (status >= 128) {
        index++;
        running = status < 240 ? status : 0;
      } else {
        status = running;
      }
      if (status === 255 || status === 240 || status === 247) {
        const kind = status === 255 ? bytes[index++] : null;
        let length;
        [length, index] = sheetVlq(bytes, index, end);
        if (index + length > end) throw new Error('Sự kiện MIDI bị cắt.');
        if (kind === 81) {
          if (length !== 3) throw new Error('Tempo MIDI không hợp lệ.');
          const value = bytes[index] * 65536 + bytes[index + 1] * 256 + bytes[index + 2];
          if (!value || (tempo !== null && tempo !== value) || (tempo === null && tick !== 0)) {
            throw new Error('MIDI thay đổi tốc độ. Hãy xuất một đoạn có tempo cố định.');
          }
          tempo = value;
        }
        if (kind === 88 && (length !== 4 || bytes[index] !== 4 || bytes[index + 1] !== 2)) {
          throw new Error('Studio hiện nhập MIDI nhịp 4/4.');
        }
        index += length;
        continue;
      }
      if (status < 128 || status >= 240) throw new Error('Sự kiện MIDI không được hỗ trợ.');
      const type = status >> 4, channel = status & 15;
      const size = type === 12 || type === 13 ? 1 : 2;
      if (index + size > end) throw new Error('Dữ liệu MIDI bị cắt.');
      const midi = bytes[index], velocity = size === 2 ? bytes[index + 1] : 0;
      index += size;
      if (midi >= 128 || velocity >= 128) throw new Error('Dữ liệu MIDI không hợp lệ.');
      if (channel === 9) continue;
      if ((type === 11 && midi === 64 && velocity >= 64) || (type === 14 && (midi !== 0 || velocity !== 64))) {
        throw new Error('MIDI có pedal ngân hoặc uốn cao độ. Hãy xuất nốt giai điệu đã ghi trường độ.');
      }
      if (type !== 8 && type !== 9) continue;
      const key = channel * 128 + midi;
      if (!channels.has(channel)) channels.set(channel, {notes: [], invalid: false});
      const voice = channels.get(channel);
      if (type === 9 && velocity) {
        if (active.has(key)) voice.invalid = true;
        active.set(key, tick);
      } else if (active.has(key)) {
        const start = active.get(key);
        active.delete(key);
        if (tick <= start) voice.invalid = true;
        if (voice.notes.length <= sheetMaxNotes) voice.notes.push({start, end: tick, midi});
      } else {
        voice.invalid = true;
      }
    }
    for (const key of active.keys()) channels.get(Math.floor(key / 128)).invalid = true;
    for (const voice of channels.values()) {
      if (voice.invalid) throw new Error('MIDI có nốt chồng cùng cao độ hoặc thiếu điểm kết thúc.');
      if (voice.notes.length) voices.push(voice.notes);
    }
  }
  if (voices.length !== 1) throw new Error('Hãy xuất một bè giai điệu MIDI riêng, gồm một kênh nhạc cụ.');
  const selected = voices[0].sort((a, b) => a.start - b.start);
  if (selected.length > sheetMaxNotes) throw new Error('MIDI vượt quá 1.024 nốt.');
  const sequence = sheetSequence();
  let previousEnd = 0, maxError = 0;
  const quantize = tick => {
    const beat = tick / ppq;
    const unit = Math.round(beat * 4);
    maxError = Math.max(maxError, Math.abs(beat - unit / 4));
    return unit;
  };
  for (const note of selected) {
    if (note.midi < 48 || note.midi > 84 || note.start < previousEnd) {
      throw new Error('Hãy dùng một bè MIDI không chồng nốt trong âm vực C3–C6.');
    }
    const start = quantize(note.start), end = quantize(note.end);
    if (maxError > .09 || end <= start) throw new Error('Trường độ MIDI lệch quá 0,09 phách so với lưới 1/16.');
    sequence.append(null, start - sequence.position);
    sequence.append(note.midi, end - start);
    previousEnd = note.end;
  }
  return {title, bpm: sheetBpm(60_000_000 / (tempo ?? 500000)), notes: sequence.notes, origin: 'midi-import', maxError};
}

const sheetChild = (element, name) => Array.from(element.children).find(child => child.localName === name);
const sheetText = (element, name) => sheetChild(element, name)?.textContent.trim() ?? '';

function sheetXmlHarmony(event) {
  const root = sheetChild(event, 'root'), bass = sheetChild(event, 'bass'), kind = sheetChild(event, 'kind');
  function name(pitch, type) {
    const step = sheetText(pitch, type+'-step'), alter = Number(sheetText(pitch, type+'-alter') || 0);
    if (!/^[A-G]$/.test(step) || ![-1,0,1].includes(alter)) throw new Error('Ký hiệu hợp âm MusicXML chưa hỗ trợ.');
    return step+(alter === 1 ? '#' : alter === -1 ? 'b' : '');
  }
  const degrees = Array.from(event.children).filter(child => child.localName === 'degree');
  if (!root || !kind || sheetChild(event,'offset')) throw new Error('Vị trí hợp âm MusicXML chưa hỗ trợ.');
  const value = kind.textContent.trim(), label = kind.getAttribute('text') ?? '';
  const add9 = value === 'major' && degrees.length === 1 && sheetText(degrees[0], 'degree-value') === '9' &&
   sheetText(degrees[0], 'degree-alter') === '0' && sheetText(degrees[0], 'degree-type') === 'add';
  const suffix = add9 ? 'add9' : Object.keys(sheetHarmonyKinds).find(symbol => symbol !== 'add9' && sheetHarmonyKinds[symbol] === value);
  const other = value === 'other' && label === '7sus4' ? label : undefined;
  if ((suffix === undefined && other === undefined) || (degrees.length && !add9)) throw new Error('Loại hợp âm MusicXML chưa hỗ trợ.');
  return name(root,'root')+(suffix ?? other)+(bass ? '/'+name(bass,'bass') : '');
}

export function musicXmlToSheet(text, title = 'Bản nhạc MusicXML', Parser = globalThis.DOMParser) {
  // Standard MusicXML files often carry this external declaration. Strip it before parsing.
  const xml = text.replace(/<!DOCTYPE\s+score-partwise\s+PUBLIC\s+["']-\/\/Recordare\/\/DTD MusicXML [\d.]+ Partwise\/\/EN["']\s+["']https?:\/\/www\.musicxml\.org\/dtds\/partwise\.dtd["']\s*>/i, '');
  if (xml.length > 1_500_000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('MusicXML quá lớn hoặc chứa khai báo XML chưa hỗ trợ.');
  const document = new Parser().parseFromString(xml, 'application/xml');
  const root = document.documentElement;
  if (root?.localName !== 'score-partwise' || document.getElementsByTagName('parsererror').length) {
    throw new Error('Cần tệp MusicXML score-partwise hợp lệ, tối đa 1,5 MB.');
  }
  const parts = Array.from(root.children).filter(element => element.localName === 'part');
  if (parts.length !== 1) throw new Error('Studio hiện nhập MusicXML một bè. Hãy xuất riêng bè giai điệu.');
  const measures = Array.from(parts[0].children).filter(element => element.localName === 'measure');
  const sequence = sheetSequence(), voices = new Set();
  let divisions = 1, bpm = null, pendingTie = null;
  for (const [index, measure] of measures.entries()) {
    const start = sequence.position;
    let harmony = null;
    for (const event of measure.children) {
      if (event.localName === 'attributes') {
        if (sheetChild(event,'transpose')) throw new Error('MusicXML có nhạc cụ chuyển giọng. Hãy xuất ở cao độ thực.');
        if (sheetChild(event, 'divisions')) divisions = Number(sheetText(event, 'divisions'));
        if (!Number.isInteger(divisions) || divisions < 1) throw new Error('Divisions MusicXML không hợp lệ.');
        const time = sheetChild(event, 'time');
        if (time && (sheetText(time, 'beats') !== '4' || sheetText(time, 'beat-type') !== '4')) {
          throw new Error('Studio hiện nhập MusicXML nhịp 4/4.');
        }
      }
      if (event.localName === 'direction' || event.localName === 'sound') {
        const sound = event.localName === 'sound' ? event : sheetChild(event, 'sound');
        const metronome = sheetChild(sheetChild(event, 'direction-type') ?? event, 'metronome');
        if (metronome && !sound?.hasAttribute('tempo') && (sheetText(metronome, 'beat-unit') !== 'quarter' || sheetChild(metronome, 'beat-unit-dot'))) {
          throw new Error('MusicXML cần tempo theo nốt đen.');
        }
        const tempo = sound?.getAttribute('tempo') ?? (metronome ? sheetText(metronome, 'per-minute') : null);
        if (tempo !== null) {
          const value = sheetBpm(Number(tempo));
          if ((bpm !== null && bpm !== value) || (bpm === null && sequence.position !== 0)) throw new Error('MusicXML thay đổi tốc độ giữa bài.');
          bpm = value;
        }
      }
      if (event.localName === 'backup' || event.localName === 'forward') throw new Error('MusicXML có nhiều bè hoặc vị trí ngắt chưa hỗ trợ.');
      if (event.localName === 'harmony') {
        if (harmony !== null) throw new Error('Có nhiều hợp âm tại một vị trí MusicXML.');
        harmony = sheetXmlHarmony(event);
      }
      if (event.localName !== 'note') continue;
      voices.add(sheetText(event, 'voice') || '1');
      if (voices.size > 1 || sheetChild(event, 'chord') || sheetChild(event, 'grace') || sheetChild(event, 'cue')) {
        throw new Error('Studio hỗ trợ MusicXML một bè, không có chồng nốt hoặc nốt hoa mỹ.');
      }
      const units = Number(sheetText(event, 'duration')) / divisions * 4;
      if (!Number.isInteger(units) || units < 1 || sequence.position - start + units > 16) {
        throw new Error('Trường độ MusicXML cần khớp lưới 1/16 và ô nhịp 4/4.');
      }
      const pitch = sheetChild(event, 'pitch');
      let midi = null;
      if (pitch) {
        const semitone = {C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11}[sheetText(pitch, 'step')];
        const octave = sheetText(pitch, 'octave'), alter = Number(sheetText(pitch, 'alter') || 0);
        if (!/^[0-8]$/.test(octave) || !Number.isInteger(alter) || Math.abs(alter) > 2) throw new Error('Cao độ MusicXML không hợp lệ.');
        midi = (Number(octave) + 1) * 12 + semitone + alter;
        if (!Number.isInteger(midi) || midi < 48 || midi > 84) throw new Error('Cao độ MusicXML nằm ngoài âm vực C3–C6.');
      } else if (!sheetChild(event, 'rest')) {
        throw new Error('MusicXML có nốt không xác định được cao độ.');
      }
      const ties = Array.from(event.children).filter(child => child.localName === 'tie').map(child => child.getAttribute('type'));
      if ((pendingTie !== null) !== ties.includes('stop') || (pendingTie !== null && midi !== pendingTie) || (midi === null && ties.length)) {
        throw new Error('MusicXML có dấu nối thiếu nốt liên kết.');
      }
      const lyric = sheetChild(event, 'lyric');
      const line = lyric ? sheetText(lyric, 'text').slice(0, 120) : '';
      const syllabic = lyric ? sheetText(lyric, 'syllabic') : '';
      pendingTie = ties.includes('start') ? midi : null;
      sequence.append(midi, units, {...(pendingTie !== null ? {tie: true} : {}), ...(line ? {lyric: line, syllabic} : {}), ...(harmony ? {chord: harmony} : {})});
      harmony = null;
    }
    if (harmony !== null) throw new Error('Hợp âm MusicXML nằm ngoài vị trí nốt hoặc dấu lặng.');
    if (index < measures.length - 1 && sequence.position - start !== 16) {
      throw new Error('MusicXML có ô nhịp lấy đà hoặc thiếu phách giữa bài.');
    }
  }
  if (pendingTie !== null || !sequence.notes.some(note => note.midi !== null)) throw new Error('MusicXML thiếu nốt hoàn chỉnh.');
  const work = sheetChild(root, 'work'), identification = sheetChild(root, 'identification');
  const creator = identification && Array.from(identification.children).find(child => child.localName === 'creator' && child.getAttribute('type') === 'composer');
  const sourceStatus = identification && sheetChild(identification, 'miscellaneous');
  const sourceOrigin = sourceStatus && Array.from(sourceStatus.children).find(child => child.getAttribute('name') === 'goc-sheet-origin')?.textContent;
  return {
    title: (work && sheetText(work, 'work-title')) || sheetText(root, 'movement-title') || title,
    author: creator?.textContent.trim() ?? '', bpm: bpm ?? 80, notes: sequence.notes,
    origin: ['audio-draft', 'piano-draft', 'organ-draft'].includes(sourceOrigin) ? sourceOrigin : 'musicxml-import'
  };
}

export function chordAccompaniment(song, instrument, {transpose, chord, bpm = 80} = {}) {
  if (!['piano','organ'].includes(instrument)) throw new Error('Nhạc cụ chưa hỗ trợ.');
  const tags = Array.from(String(song?.content ?? '').matchAll(/\[([^\]\r\n]{1,24})\]/g), match => match[1].trim());
  const sequence = sheetSequence();
  for (const original of tags) {
    if (!/^[A-G](?:[#b♯♭])?(?:[^\s/]*)(?:\/[A-G](?:[#b♯♭])?)?$/.test(original)) continue;
    const symbol = transpose(original.replace(/♯/g, '#').replace(/♭/g, 'b'));
    const [, root, accidental, quality, bass] = /^([A-G])([#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(symbol) ?? [];
    const tonic = sheetChordPitches[root + accidental];
    const suffix = Object.hasOwn(sheetChordAliases, quality) ? sheetChordAliases[quality] : quality;
    const extras = Object.hasOwn(sheetExtendedChords, suffix) ? sheetExtendedChords[suffix] : null;
    const notes = extras ? extras.map(interval => 60 + tonic + interval) : chord(sheetChordNames[tonic], suffix);
    if (!notes.length || (bass && sheetChordPitches[bass] === undefined)) throw new Error('Chưa tạo được bè đệm với hợp âm ' + original + '.');
    const bassNote = bass ? 48 + sheetChordPitches[bass] : notes[0] - 12;
    const pattern = instrument === 'piano' ? [bassNote, notes[1], notes[2], notes.at(-1)] : [bassNote, notes[1]];
    pattern.forEach((midi, index) => sequence.append(midi, 16 / pattern.length, index === 0 ? {chord: root+accidental+suffix+(bass ? '/'+bass : '')} : {}));
  }
  if (!sequence.notes.length) throw new Error('Mở bài có hợp âm để tạo bè đệm.');
  return {title: song.title + (instrument === 'piano' ? ' · Đệm piano' : ' · Đệm organ'), bpm, notes: sequence.notes, origin: instrument + '-draft'};
}
