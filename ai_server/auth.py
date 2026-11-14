import base64
import re
import secrets
import time
from collections.abc import Mapping

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey


class AuthVerifier:
    """Authenticate a single-use, short-lived request or a legacy bearer token."""

    def __init__(self, public_key=None, token=b''):
        self.public_key = public_key
        self.token = token
        self.seen: dict[str, int] = {}

    @classmethod
    def from_environment(cls, env: Mapping[str, str]):
        encoded = env.get('TRANSCRIBE_PUBLIC_KEY', '')
        if encoded:
            if not re.fullmatch(r'[A-Za-z0-9_-]{43}', encoded):
                raise RuntimeError('Invalid TRANSCRIBE_PUBLIC_KEY.')
            return cls(public_key=Ed25519PublicKey.from_public_bytes(
                base64.urlsafe_b64decode(encoded + '=')))
        token = env.get('TRANSCRIBE_TOKEN', '')
        if not re.fullmatch(r'[A-Za-z0-9_-]{32,128}', token):
            raise RuntimeError('Set TRANSCRIBE_PUBLIC_KEY or TRANSCRIBE_TOKEN.')
        return cls(token=token.encode('ascii'))

    def verify(self, authorization: str, bpm: int, purpose: str = 'transcribe') -> bool:
        scheme, _, value = authorization.partition(' ')
        if self.public_key is None:
            return scheme.lower() == 'bearer' and secrets.compare_digest(value.encode(), self.token)
        if scheme.lower() != 'signature':
            return False
        match = re.fullmatch(r'(\d{10})\.([0-9a-f]{32})\.([A-Za-z0-9_-]{86})', value)
        if not match:
            return False
        issued, nonce, encoded = match.groups()
        now = int(time.time())
        if abs(now - int(issued)) > 120:
            return False
        self.seen = {key: expiry for key, expiry in self.seen.items() if expiry >= now}
        if nonce in self.seen or len(self.seen) >= 4096:
            return False
        if purpose not in ('transcribe', 'enqueue'):
            return False
        message = f'goc-hop-am:{purpose}:v1:{issued}:{nonce}:{bpm}'.encode('ascii')
        try:
            self.public_key.verify(base64.urlsafe_b64decode(encoded + '=='), message)
        except (InvalidSignature, ValueError):
            return False
        self.seen[nonce] = int(issued) + 120
        return True
