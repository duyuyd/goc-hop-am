import asyncio
import base64
import json
import secrets
import time
import unittest

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi import HTTPException, Request

from ai_server.auth import AuthVerifier
from ai_server.main import app, enqueue_job


class JobEndpointTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.private = Ed25519PrivateKey.generate()
        app.state.auth = AuthVerifier(public_key=self.private.public_key())
        app.state.queue = asyncio.Queue(maxsize=3)
        app.state.queued = set()
        self.job = {
            'id': '00000000-0000-4000-8000-000000000001',
            'title': 'Bài kiểm thử', 'author': 'Nhạc sĩ',
            'callback_origin': 'https://goc-hop-am.onwardcrust.chatgpt.site',
            'callback_token': 'a' * 43,
        }

    def request(self, job, purpose='enqueue'):
        issued = str(int(time.time()))
        nonce = secrets.token_hex(16)
        message = f'goc-hop-am:{purpose}:v1:{issued}:{nonce}:120'.encode()
        signature = base64.urlsafe_b64encode(self.private.sign(message)).decode().rstrip('=')
        auth = f'Signature {issued}.{nonce}.{signature}'.encode()
        data = json.dumps(job).encode()

        async def receive():
            return {'type': 'http.request', 'body': data, 'more_body': False}

        return Request({'type': 'http', 'method': 'POST', 'path': '/jobs',
                        'headers': [(b'authorization', auth)]}, receive)

    async def test_signed_enqueue_deduplicates_and_rejects_other_purposes(self):
        self.assertEqual(await enqueue_job(self.request(self.job)), {'status': 'queued'})
        self.assertEqual(await enqueue_job(self.request(self.job)), {'status': 'queued'})
        self.assertEqual(app.state.queue.qsize(), 1)
        with self.assertRaises(HTTPException) as error:
            await enqueue_job(self.request(self.job, 'transcribe'))
        self.assertEqual(error.exception.status_code, 401)

    async def test_only_our_callback_origin_and_bounded_queue(self):
        wrong = dict(self.job, callback_origin='https://other.example')
        with self.assertRaises(HTTPException) as error:
            await enqueue_job(self.request(wrong))
        self.assertEqual(error.exception.status_code, 400)
        for index in range(3):
            await enqueue_job(self.request(dict(self.job, id=f'00000000-0000-4000-8000-{index:012}')))
        with self.assertRaises(HTTPException) as error:
            await enqueue_job(self.request(dict(self.job, id='00000000-0000-4000-8000-000000000003')))
        self.assertEqual(error.exception.status_code, 503)
