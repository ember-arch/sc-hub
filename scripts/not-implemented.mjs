// Stub runner for root scripts whose real implementation lands in a later spec item.
// Spec 00, criterion 1: stubs print "not implemented in Phase 0" and exit 1.
const script = process.argv[2] ?? "<unknown>";

const landsWith = {
  dev: "docs/specs/00-foundation.md, Site shell",
  "test:e2e": "docs/specs/00-foundation.md, CI and Site shell",
  "db:migrate": "docs/specs/00-foundation.md, Database package",
  "db:seed": "docs/specs/00-foundation.md, Database package",
  "pipeline:detect": "docs/specs/01-data-spine.md, Version detection",
  "pipeline:extract": "docs/specs/01-data-spine.md, Raw extraction",
  "pipeline:normalize": "docs/specs/01-data-spine.md, Vehicle normalizer",
  "pipeline:models": "docs/specs/04-viewer.md, Export",
  "pipeline:publish": "docs/specs/01-data-spine.md, Publish",
  "pipeline:all": "docs/specs/01-data-spine.md, Runbook",
  "workers:import": "docs/specs/01-data-spine.md, Import job",
  "workers:poll-news":
    "docs/specs/03-news-and-dev-tracker.md, Comm-Link poller",
  "workers:poll-spectrum":
    "docs/specs/03-news-and-dev-tracker.md, Spectrum adapter interface",
  "workers:link": "docs/specs/03-news-and-dev-tracker.md, Entity linking job",
};

const where = landsWith[script] ?? "a later spec";
console.error(
  `not implemented in Phase 0 (pnpm ${script} lands with: ${where})`,
);
process.exit(1);
