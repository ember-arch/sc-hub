# fixtures/spectrum

What the Spectrum adapter (`workers/poll-spectrum`, spec 03, ADR-027) reads and writes locally.

- `samples/search-extended.sample.json`: two hits of Spectrum's search answer as its web app receives them (2026-11-10, read without a sign-in), with the member cut to id, names and badges (no avatar, signature or languages): an original post and a reply, each with the thread and the channel. The parser's unit tests run on it; no test reaches the network.
- `staff.json` lives in `workers/poll-spectrum/staff.json`: the handles known to be CIG staff, kept by hand and reviewed each patch (spec 03, "Staff identification"); a post is a developer post when its author carries a staff badge or is on that list.

Developer posts and their authors are written to the news pack (`fixtures/news/ContentItem.json`, `fixtures/news/Author.json`) only when `SPECTRUM_MODE` is `poll` or `feed`; the site shows them only then. `off` is the deployed default until the Spectrum box in `docs/legal/cig-approval.md` is ticked.
