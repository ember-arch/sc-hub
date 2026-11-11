# fixtures/spectrum-media

The pictures CIG staff attached to the Spectrum posts on the news pack (ADR-036), copied at the size they were uploaded for the developer tracker to show them as the posts do. The pictures are git-ignored and never committed; only this README and `sources.json` are.

`sources.json` records, for each picture: Spectrum's upload id (the `data-upload` the post's `img` carries in `body_html`), the file, the post's page on Spectrum, the exact image URL, the content type, size, SHA-256 and when it was fetched.

The addresses come from `fixtures/spectrum/uploads.json`, which `pnpm workers:poll-spectrum` writes when it reads a thread's posts in full (ADR-036). Copy the pictures, then build the web copies the site reads:

```
pnpm exec tsx scripts/media/fetch-spectrum.ts
pnpm --filter schema build && pnpm exec tsx scripts/media/prepare.ts
```

The fetch makes one request per picture not yet on disk, at least 5 seconds apart (CLAUDE.md section 9), with the project User-Agent and the contact address and no cookies or signed-in session. Only pictures in posts the site shows (the latest revision of each, none under takedown) are fetched; a copy from the same address is kept. A post whose picture is not on disk shows a captioned placeholder, never a hotlink to Spectrum (ADR-009).

Showing the pictures on the public site is the owner's decision of 2026-11-10, recorded in `docs/legal/cig-approval.md` under the Spectrum box and in ADR-036; they are published with the rest of the media (ADR-034).
