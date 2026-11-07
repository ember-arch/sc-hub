// Build step: write packages/ui/tokens.css from tokens.ts. Run by `pnpm --filter ui build:tokens`.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderTokensCss } from "./tokens-css";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "tokens.css");
writeFileSync(out, renderTokensCss());
console.log(`wrote ${out}`);
