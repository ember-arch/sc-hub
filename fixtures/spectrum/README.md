# fixtures/spectrum

What the Spectrum adapter (`workers/poll-spectrum`, spec 03, ADR-027) reads and writes locally.

- `samples/identify.sample.json`: Spectrum's identify answer (2026-11-10, read without a sign-in), cut to the community and its roles (id, name, description, tracked, highlightable, visible, colour); the staff role is the one named "staff" that Spectrum tracks, id "2", "CIG Staff". The worker resolves it from this call each run.
- `samples/search-extended.sample.json`: four hits of Spectrum's search answer as its web app receives them (2026-11-10, read without a sign-in, filtered to the staff highlight), with the member cut to id, names and badge names (no avatar, signature, languages or icons) and the vote count dropped: a patch-notes opening post and three replies, each with the thread and the channel. One reply's author carries only civilian badges and posted with the staff highlight, the case the highlight rule exists for. The parser's unit tests run on both samples; no test reaches the network.
- `staff.json` lives in `workers/poll-spectrum/staff.json`: the handles known to be CIG staff, kept by hand and reviewed each patch (spec 03, "Staff identification"). A post is a developer post when it is highlighted with the staff role, or when its author carries a staff badge or is on that list.

Developer posts and their authors are written to the news pack (`fixtures/news/ContentItem.json`, `fixtures/news/Author.json`) only when `SPECTRUM_MODE` is `poll` or `feed`; the site shows them only when its own `SPECTRUM_MODE` is on. `off` is the site's deployed default until the Spectrum box in `docs/legal/cig-approval.md` is ticked.
