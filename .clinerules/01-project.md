# Góc Hợp Âm — repository architecture and priorities

Project: duyuyd/goc-hop-am. Existing production and user data must be preserved; no replacement project.

- Current package.json uses Next.js 16.4.4, React 19, TypeScript, Tailwind 4, vinext/Vite and Cloudflare Wrangler. Follow the checked-in package versions, not a generic Next 15 template.
- Cloudflare D1 / Drizzle schema and migrations live in db/ and drizzle/. Keep schema migrations additive, reviewed and reversible. Do not assume the database is Supabase.
- App Router routes and UI live in app/ and components/. Existing catalog, chord reader, account/admin flows and native recording are functional surfaces that must not regress.
- Separate audio-to-sheet infrastructure is under ai_server/. Heavy AI transcription is asynchronous; do not run inference in a Cloudflare Worker HTTP request. Preserve existing job status and results.
- Maintain separate connected catalog records and owner-authored songs; retain correct song/source attribution, lyrics, chords, MusicXML, MIDI and existing exports without wiping or faking records.
- High-priority acceptance: search returns real matching songs; chord/lyric reader and transposition work; sheet renders; YouTube controls preserve reading area; Android interactions are usable.
- The ChatGPT Sites project and its live contents may be ahead of this GitHub mirror. NEVER deploy this repository on top of the Sites project or claim they are equivalent without first comparing their current code/data.
- Baseline checks after related changes: npm run lint; npm run build; node tests/accounts.test.mjs; node tests/catalog.test.mjs; node tests/reader.test.mjs. If the runtime is unavailable, disclose which checks were not run.
