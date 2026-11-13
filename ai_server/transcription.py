import subprocess
import wave
from pathlib import Path

from basic_pitch import FilenameSuffix, build_icassp_2022_model_path
from basic_pitch.inference import Model, predict
from music21 import chord, converter, defaults, harmony, metadata, stream
from music21.musicxml.m21ToXml import GeneralObjectExporter

MAX_SECONDS = 180
MAX_NOTES = 6_000
MAX_XML_BYTES = 6 * 1024 * 1024
SAMPLE_RATE = 22_050


class AudioError(ValueError):
    def __init__(self, message: str, status: int = 422):
        super().__init__(message)
        self.status = status


def load_model() -> Model:
    # This service does not know the original composer of an uploaded recording.
    defaults.author = ''
    return Model(build_icassp_2022_model_path(FilenameSuffix.tflite))


def normalize_audio(source: Path, output: Path) -> None:
    try:
        subprocess.run(
            [
                'ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error', '-xerror',
                '-protocol_whitelist', 'file', '-format_whitelist', 'mp3,wav',
                '-threads', '1', '-i', str(source), '-map', '0:a:0',
                '-ac', '1', '-ar', str(SAMPLE_RATE), '-c:a', 'pcm_s16le',
                '-t', str(MAX_SECONDS + 1), str(output),
            ],
            check=True, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL, timeout=20,
        )
    except subprocess.CalledProcessError as exc:
        raise AudioError('Không đọc được âm thanh. Hãy chọn tệp MP3 hoặc WAV hợp lệ.') from exc
    except subprocess.TimeoutExpired as exc:
        raise AudioError('Mất quá nhiều thời gian để đọc tệp âm thanh.') from exc

    with wave.open(str(output), 'rb') as wav:
        seconds = wav.getnframes() / wav.getframerate()
    if seconds > MAX_SECONDS:
        raise AudioError(f'Âm thanh chỉ được dài tối đa {MAX_SECONDS} giây.', 413)
    if seconds < 0.25:
        raise AudioError('Âm thanh quá ngắn để chép bản phổ.')


def label_harmony(part: stream.Part) -> int:
    """Label sustained, identifiable simultaneous pitches without adding notes."""
    count = 0
    previous = None
    original = {measure.offset: measure for measure in part.getElementsByClass(stream.Measure)}
    for reduced in part.chordify().getElementsByClass(stream.Measure):
        target = original[reduced.offset]
        for event in reduced.notesAndRests:
            if event.isRest and event.quarterLength >= 0.5:
                previous = None
            if not isinstance(event, chord.Chord) or event.quarterLength < 0.25:
                continue
            pitch_classes = set(event.pitchClasses)
            if not 3 <= len(pitch_classes) <= 4:
                continue
            try:
                figure, kind = harmony.chordSymbolFigureFromChord(event, includeChordType=True)
                if not kind or figure == previous:
                    continue
                symbol = harmony.ChordSymbol(figure)
            except (ValueError, harmony.ChordStepModificationException):
                continue
            if set(symbol.pitchClasses) != pitch_classes:
                continue
            target.insert(event.offset, symbol)
            previous = figure
            count += 1
    return count


def transcribe(source: Path, model: Model, bpm: int) -> tuple[bytes, int, int]:
    wav_path = source.with_name('audio.wav')
    midi_path = source.with_name('transcription.mid')
    normalize_audio(source, wav_path)
    _, midi, events = predict(
        wav_path, model, midi_tempo=bpm, onset_threshold=0.60,
        frame_threshold=0.38, melodia_trick=False,
    )
    if not events:
        raise AudioError('Không tìm thấy nốt đủ rõ. Hãy thử bản thu một nhạc cụ hoặc giọng hát rõ hơn.')
    if len(events) > MAX_NOTES:
        raise AudioError('Bản thu có quá nhiều nốt để xuất bản phổ. Hãy thử một đoạn ngắn hơn.')

    midi.write(str(midi_path))
    score = converter.parse(midi_path, format='midi', quantizePost=True, quarterLengthDivisors=(4, 3))
    score.metadata = metadata.Metadata(title='Bản phổ từ audio')
    score.metadata.software = ['Góc Hợp Âm']
    chords = sum(label_harmony(part) for part in score.parts)
    xml = GeneralObjectExporter(score).parse()
    if len(xml) > MAX_XML_BYTES:
        raise AudioError('Bản phổ quá lớn. Hãy thử một đoạn âm thanh ngắn hơn.')
    return xml, len(events), chords
