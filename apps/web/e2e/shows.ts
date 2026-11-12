import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EventRecord, EventSource } from "schema";

/**
 * The shows on file (ADR-057), read straight from `fixtures/events/` for the e2e specs, which run
 * outside Next and cannot load the site's own modules; and the clock the build used: the test's,
 * or SITE_CLOCK when a local run pins it.
 */
const dir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "fixtures",
  "events",
);

export const shows: readonly EventRecord[] = EventSource.array()
  .parse(JSON.parse(readFileSync(join(dir, "registry.json"), "utf8")))
  .map((s) =>
    EventRecord.parse(
      JSON.parse(readFileSync(join(dir, `${s.slug}.json`), "utf8")),
    ),
  );

export const clock: Date =
  (process.env["SITE_CLOCK"] ?? "") === ""
    ? new Date()
    : new Date(process.env["SITE_CLOCK"]!);
