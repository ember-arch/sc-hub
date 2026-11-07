// Build step: write one JSON Schema file per entity to dist/json/, plus an index.
// Run by `pnpm --filter schema build` after tsc.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { toJsonSchemas } from "../json-schema.js";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "dist", "json");
mkdirSync(outDir, { recursive: true });

const schemas = toJsonSchemas();
const names = Object.keys(schemas).sort();
for (const [name, schema] of Object.entries(schemas)) {
  writeFileSync(
    join(outDir, `${name}.schema.json`),
    `${JSON.stringify(schema, null, 2)}\n`,
  );
}
writeFileSync(
  join(outDir, "index.json"),
  `${JSON.stringify(
    {
      draft: "https://json-schema.org/draft/2020-12/schema",
      schemas: names.map((name) => ({ name, file: `${name}.schema.json` })),
    },
    null,
    2,
  )}\n`,
);

console.log(
  JSON.stringify({
    event: "schema.json_schema.emitted",
    count: names.length,
    out_dir: "packages/schema/dist/json",
  }),
);
