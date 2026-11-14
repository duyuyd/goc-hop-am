"""Background score jobs: discover audio, transcribe it, and return MusicXML."""
import logging
import re
import subprocess
import unicodedata
from pathlib import Path
from tempfile import TemporaryDirectory

import pretty_midi
import requests
from basic_pitch.inference import predict
from music21 import converter, metadata
from music21.musicxml.m21ToXml import GeneralObjectExporter
from yt_dlp import YoutubeDL

from .transcription import label_harmony

log = logging.getLogger(__name__)
MAX_AUDIO_BYTES = 40 * 1024 * 1024
MAX_SECONDS = 600
SEGMENT_SECONDS = 60
MAX_NOTES = 6000
MAX_XML_BYTES = 6 * 1024 * 1024
CALLBACK = 'https://goc-hop-am.onwardcrust.chatgpt.site/api/ai/worker'


def _words(value):
    value = unicodedata.normalize('NFKD', value.replace('đ', 'd').replace('Đ', 'D'))
    return set(re.findall(r'[a-z0-9]+', ''.join(c for c in value.lower() if not unicodedata.combining(c))))


def find_and_download(title, author, directory):
    """Find a plausible recording by title; reject mismatches rather than guess."""
    title_words = _words(title)
    if not title_words or (sum(map(len, title_words)) < 4 and not author):
        raise ValueError('Insufficient song identity')
    options = {'quiet': True, 'no_warnings': True, 'noplaylist': True, 'socket_timeout': 12,
               'retries': 1, 'extractor_retries': 1, 'fragment_retries': 1,
               'js_runtimes': {'node': {}}, 'extract_flat': True}
    with YoutubeDL(options) as downloader:
        search = downloader.extract_info('ytsearch5:' + title + ' ' + author, download=False)
    matches = []
    for entry in search.get('entries', []) if search else []:
        if not isinstance(entry, dict):
            continue
        video_id = str(entry.get('id') or '')
        words = _words(str(entry.get('title') or ''))
        if re.fullmatch(r'[A-Za-z0-9_-]{11}', video_id) and title_words.issubset(words):
            matches.append((len(_words(author) & words), video_id))
    if not matches:
        raise ValueError('No matching recording')
    matches.sort(key=lambda item: item[0], reverse=True)
    destination = str(Path(directory) / 'recording.%(ext)s')
    options.update({'extract_flat': False, 'format': 'bestaudio/best', 'outtmpl': destination,
                    'max_filesize': MAX_AUDIO_BYTES, 'max_downloads': 1, 'overwrites': False})
    with YoutubeDL(options) as downloader:
        info = downloader.extract_info('https://www.youtube.com/watch?v=' + matches[0][1], download=True)
        duration = info.get('duration') if info else None
        path = Path(downloader.prepare_filename(info)) if info else None
    if not path or not path.is_file() or path.stat().st_size > MAX_AUDIO_BYTES or not duration or duration > MAX_SECONDS:
        raise ValueError('Unsupported recording')
    return path, float(duration)


def transcribe_recording(path, duration, model, directory):
    """Transcribe the complete recording in bounded segments and merge MIDI."""
    combined = pretty_midi.PrettyMIDI(initial_tempo=120)
    part = pretty_midi.Instrument(program=0)
    total_notes = 0
    for offset in range(0, int(duration) + 1, SEGMENT_SECONDS):
        if offset >= duration:
            break
        segment = Path(directory) / f'segment-{offset}.wav'
        subprocess.run(['ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error', '-xerror',
                        '-protocol_whitelist', 'file', '-ss', str(offset), '-i', str(path),
                        '-t', str(min(SEGMENT_SECONDS, duration - offset)), '-ac', '1', '-ar', '22050',
                        '-c:a', 'pcm_s16le', str(segment)], check=True, timeout=90,
                       stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        _, midi, _ = predict(segment, model, midi_tempo=120, onset_threshold=0.60,
                             frame_threshold=0.38, melodia_trick=False)
        for instrument in midi.instruments:
            for note in instrument.notes:
                part.notes.append(pretty_midi.Note(velocity=note.velocity, pitch=note.pitch,
                                                   start=note.start + offset, end=note.end + offset))
                total_notes += 1
                if total_notes > MAX_NOTES:
                    raise ValueError('Too many notes')
        segment.unlink()
    if not total_notes:
        raise ValueError('No notes detected')
    combined.instruments.append(part)
    midi_path = Path(directory) / 'combined.mid'
    combined.write(str(midi_path))
    score = converter.parse(midi_path, format='midi', quantizePost=True, quarterLengthDivisors=(4, 3))
    score.metadata = metadata.Metadata(title='Bản phổ từ bản thu')
    score.metadata.software = ['Góc Hợp Âm']
    for part in score.parts:
        label_harmony(part)
    xml = GeneralObjectExporter(score).parse()
    if len(xml) > MAX_XML_BYTES:
        raise ValueError('Score too large')
    return xml


def callback(job, status, payload=b''):
    response = requests.post(CALLBACK, params={'id': job['id'], 'status': status}, data=payload,
                             headers={'X-Job-Token': job['callback_token'],
                                      'Content-Type': 'application/vnd.recordare.musicxml+xml'},
                             timeout=(10, 45), allow_redirects=False)
    response.raise_for_status()


def run_job(job, model):
    try:
        callback(job, 'processing')
        with TemporaryDirectory(prefix='gha-job-') as directory:
            path, duration = find_and_download(job['title'], job['author'], directory)
            xml = transcribe_recording(path, duration, model, directory)
            callback(job, 'completed', xml)
    except Exception as exc:
        log.warning('Score job failed: %s', type(exc).__name__)
        try:
            callback(job, 'failed')
        except requests.RequestException:
            log.warning('Unable to record score job failure')
