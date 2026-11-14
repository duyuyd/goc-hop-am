import base64
import time
import unittest
from unittest.mock import patch

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from ai_server.auth import AuthVerifier


class AuthTests(unittest.TestCase):
    def test_signed_request_and_rejections(self):
        private = Ed25519PrivateKey.generate()
        public = private.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
        encoded = base64.urlsafe_b64encode(public).decode().rstrip('=')
        verifier = AuthVerifier.from_environment({'TRANSCRIBE_PUBLIC_KEY': encoded})
        issued = str(int(time.time()))
        nonce = '1' * 32
        message = f'goc-hop-am:transcribe:v1:{issued}:{nonce}:120'.encode('ascii')
        signature = base64.urlsafe_b64encode(private.sign(message)).decode().rstrip('=')
        header = f'Signature {issued}.{nonce}.{signature}'
        self.assertFalse(verifier.verify(header, 121))
        self.assertTrue(verifier.verify(header, 120))
        self.assertFalse(verifier.verify(header, 120))
        with patch('ai_server.auth.time.time', return_value=int(issued) + 121):
            self.assertFalse(AuthVerifier.from_environment({'TRANSCRIBE_PUBLIC_KEY': encoded}).verify(header, 120))
        self.assertFalse(verifier.verify('Bearer anything', 120))

    def test_legacy_token_and_invalid_configuration(self):
        token = 'a' * 43
        verifier = AuthVerifier.from_environment({'TRANSCRIBE_TOKEN': token})
        self.assertTrue(verifier.verify('Bearer ' + token, 120))
        self.assertFalse(verifier.verify('Bearer ' + 'b' * 43, 120))
        with self.assertRaises(RuntimeError):
            AuthVerifier.from_environment({})


if __name__ == '__main__':
    unittest.main()
