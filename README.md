# Góc Hợp Âm

**Người phát triển: NPT Duy.**

A Vietnamese chord library with an independent visual shell, member accounts and a protected administrator area.

- `/` — discovery, personal favorites and a native chord reader with transposition, font size and auto-scroll controls.
- `/api/catalog`, `/api/reader` — server-side catalogue and single-song text retrieval; the browser never embeds or navigates to the catalogue source.
- `/dang-ky`, `/dang-nhap` — application account registration and sign-in.
- `/tai-khoan` — profile and password updates.
- `/quan-tri` — administrator-only members, original song publishing and site settings.

The hosting platform's access policy remains unchanged. Application roles are enforced on the server in addition to that boundary. No user password or credential is included in the browser bundle.

## Runtime

D1 binding: `DB`. Initial administrator provisioning uses the secret runtime variables `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH`. The password hash uses salted PBKDF2-SHA256. Once an administrator account exists, its database password takes precedence over the bootstrap secret, including after a password change.

Migrations are schema-only under `drizzle/`. Production publication applies the initial migration. Connected songs are retrieved on demand as plain text with source credit. Third-party HTML, scripts, links, forms and navigation are never rendered in the application. Upstream failure shows an inline retry; it never opens a source frame or redirects. These connected songs remain separate from the original songs editable in the admin area.

## Checks

- `node tests/accounts.test.mjs` — real in-memory SQLite integration covering registration, sessions, authorization, settings/song writes and password rotation.
- `node tests/passwords.test.mjs` — password and token cryptography.
- `node tests/catalog.test.mjs` — metadata parsing and source URL validation.
- `node tests/reader.test.mjs` — native text extraction, unsafe markup exclusion, caching, failure handling and chord transposition.
- Build and publish with the Sites workflow.

## Recording and video follow

The home page and mobile UI expose user-started recording. Browser media permissions are scoped to the current origin; unsupported display capture is explained before starting. Android uses a native microphone/screen service and a Camera2 front-camera recorder. YouTube lyric following aligns public captions to lyrics against the actual video clock, without microphone input; videos without matching captions require LRC or user-marked cues. Original project credit: NPT Duy, see COPYRIGHT.md.
