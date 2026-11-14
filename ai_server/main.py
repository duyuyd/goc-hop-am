import asyncio
import logging
import json
import os
import re
from contextlib import asynccontextmanager
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Annotated

import anyio
from fastapi import FastAPI, HTTPException, Query, Request, Response
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile
from starlette.formparsers import MultiPartException, MultiPartParser

from .transcription import AudioError, load_model, transcribe
from .auth import AuthVerifier
from .ai_worker import run_job

MAX_UPLOAD = 36 * 1024 * 1024
FORM_OVERHEAD = 64 * 1024
MUSICXML = 'application/vnd.recordare.musicxml+xml'
AUDIO_TYPES = {'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave', 'audio/mpeg', 'audio/mp3', 'application/octet-stream'}
log = logging.getLogger(__name__)


class UploadTooLarge(MultiPartException):
    def __init__(self):
        super().__init__('Tệp âm thanh vượt quá 36 MiB.')


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.auth = AuthVerifier.from_environment(os.environ)
    app.state.model = await run_in_threadpool(load_model)
    app.state.inference = asyncio.Lock()
    app.state.queue = asyncio.Queue(maxsize=3)
    app.state.queued = set()
    async def consume():
        while True:
            job = await app.state.queue.get()
            try:
                async with app.state.inference:
                    await run_in_threadpool(run_job, job, app.state.model)
            except Exception:
                log.exception('Background score job failed')
            finally:
                app.state.queued.discard(job['id'])
                app.state.queue.task_done()
    task = asyncio.create_task(consume())
    try:
        yield
    finally:
        task.cancel()


app = FastAPI(title='Góc Hợp Âm · Audio Transcription', lifespan=lifespan)


async def bounded_stream(request: Request, maximum: int):
    size = 0
    async for block in request.stream():
        size += len(block)
        if size > maximum:
            raise UploadTooLarge()
        if block:
            yield block


async def save_audio(request: Request, destination: Path) -> None:
    media_type = request.headers.get('content-type', '').partition(';')[0].strip().lower()
    multipart = media_type == 'multipart/form-data'
    if not multipart and media_type not in AUDIO_TYPES:
        raise HTTPException(415, 'Chỉ hỗ trợ âm thanh MP3 hoặc WAV.')
    if request.headers.get('content-encoding', 'identity').lower() != 'identity':
        raise HTTPException(415, 'Hãy gửi trực tiếp tệp MP3 hoặc WAV.')
    limit = MAX_UPLOAD + FORM_OVERHEAD if multipart else MAX_UPLOAD
    length = request.headers.get('content-length')
    if length is not None:
        if not length.isascii() or not length.isdecimal() or len(length) > 10:
            raise HTTPException(400, 'Kích thước tải lên không hợp lệ.')
        if int(length) > limit:
            raise UploadTooLarge()

    async with await anyio.open_file(destination, 'wb') as output:
        if multipart:
            parser = MultiPartParser(request.headers, bounded_stream(request, limit), max_files=1, max_fields=0)
            form = await parser.parse()
            try:
                file = form.get('file')
                if not isinstance(file, UploadFile) or not file.size:
                    raise HTTPException(400, 'Cần một tệp âm thanh trong trường file.')
                if file.size > MAX_UPLOAD:
                    raise UploadTooLarge()
                while block := await file.read(256 * 1024):
                    await output.write(block)
            finally:
                await form.close()
        else:
            async for block in bounded_stream(request, limit):
                await output.write(block)

    if destination.stat().st_size == 0:
        raise HTTPException(400, 'Tệp âm thanh trống.')


@app.get('/healthz')
async def health():
    return {'status': 'ready'}


@app.post('/jobs', status_code=202)
async def enqueue_job(request: Request):
    if not app.state.auth.verify(request.headers.get('authorization', ''), 120, 'enqueue'):
        raise HTTPException(401, 'Cần mã truy cập dịch vụ.')
    raw = bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw) > 4096:
            raise HTTPException(413, 'Thông tin công việc quá lớn.')
    try:
        job = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(400, 'Thông tin công việc không hợp lệ.')
    if not isinstance(job, dict) or not re.fullmatch(r'[0-9a-f-]{36}', str(job.get('id', ''))) or \
       not isinstance(job.get('title'), str) or not 1 <= len(job['title']) <= 180 or \
       not isinstance(job.get('author'), str) or len(job['author']) > 120 or \
       job.get('callback_origin') != 'https://goc-hop-am.onwardcrust.chatgpt.site' or \
       not re.fullmatch(r'[A-Za-z0-9_-]{43}', str(job.get('callback_token', ''))):
        raise HTTPException(400, 'Thông tin công việc không hợp lệ.')
    if job['id'] not in app.state.queued:
        try:
            app.state.queue.put_nowait(job)
        except asyncio.QueueFull:
            raise HTTPException(503, 'Dịch vụ đang xử lý. Hãy thử lại.')
        app.state.queued.add(job['id'])
    return {'status': 'queued'}


@app.post('/transcribe', response_class=Response, responses={200: {'content': {MUSICXML: {}}}}, openapi_extra={
    'requestBody': {
        'required': True,
        'content': {
            'multipart/form-data': {'schema': {
                'type': 'object', 'required': ['file'],
                'properties': {'file': {'type': 'string', 'format': 'binary'}},
            }},
            'audio/wav': {'schema': {'type': 'string', 'format': 'binary'}},
            'audio/mpeg': {'schema': {'type': 'string', 'format': 'binary'}},
        },
    },
})
async def create_score(request: Request, bpm: Annotated[int, Query(ge=40, le=240)] = 120):
    if not app.state.auth.verify(request.headers.get('authorization', ''), bpm):
        raise HTTPException(401, 'Cần mã truy cập dịch vụ.', headers={'WWW-Authenticate': 'Bearer'})
    if app.state.inference.locked():
        raise HTTPException(503, 'Dịch vụ đang chép bản phổ khác. Hãy thử lại.', headers={'Retry-After': '5'})

    async with app.state.inference:
        try:
            with TemporaryDirectory(prefix='gha-transcribe-') as folder:
                source = Path(folder) / 'upload'
                async with asyncio.timeout(60):
                    await save_audio(request, source)
                xml, notes, chords = await run_in_threadpool(transcribe, source, app.state.model, bpm)
        except UploadTooLarge as exc:
            raise HTTPException(413, exc.message) from exc
        except MultiPartException as exc:
            raise HTTPException(400, 'Gửi một tệp MP3 hoặc WAV trong trường file.') from exc
        except TimeoutError as exc:
            raise HTTPException(408, 'Tải tệp âm thanh quá lâu. Hãy thử lại.') from exc
        except AudioError as exc:
            raise HTTPException(exc.status, str(exc)) from exc
        except HTTPException:
            raise
        except Exception as exc:
            log.exception('Transcription failed')
            raise HTTPException(500, 'Chưa tạo được bản phổ. Hãy thử lại.') from exc

    return Response(xml, media_type=MUSICXML, headers={
        'Content-Disposition': 'attachment; filename="ban-pho.musicxml"',
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
        'X-Transcribed-Notes': str(notes), 'X-Transcribed-Chords': str(chords),
    })
