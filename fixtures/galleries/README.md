# fixtures/galleries

The Star Citizen Wiki's gallery of RSI's art for every ship (ADR-024), copied by `scripts/media/fetch-galleries.ts` from each ship's wiki article: the first eight pictures of the article's "Official" tab and the first four of its "In-game" tab, as the wiki hosts them. One request per article page and one per upload, five seconds apart, article pages and uploads only (ADR-017).

Git-ignored: only this README, `sources.json` (every file's address, size and checksum, per ship) and `samples/` (the Gladius article's gallery section, which the parser's unit test reads) are committed. The art is Cloud Imperium's; it stays on the machine that copied it (ADR-009, ADR-019). The pages credit "Images: Roberts Space Industries, via the Star Citizen Wiki" and link the article.

`scripts/media/prepare.ts` turns each ship's pictures into a showcase of the shape the Odin and Perseus use: the first official picture is the cover, the second the poster, the next seven lead the ship file's sections, the rest stand in the gallery.
