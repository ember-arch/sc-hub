/**
 * What CIG has stated about a showcase ship where the game has no data for it (ADR-012), written as
 * neutral facts, each backed by a verbatim quote from the ship's Comm-Link. `pnpm exec tsx
 * scripts/media/claims.ts` checks every quote against the article copied in fixtures/showcase and
 * writes fixtures/ship-claims/ShipClaim.json. A quote that is not in the article stops the run.
 * These are statements from marketing, not game data: the page labels them as stated by CIG.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type ClaimSection = "operations" | "combat" | "logistics" | "command";

export interface ClaimInput {
  readonly section: ClaimSection;
  readonly label: string;
  readonly value: string;
  readonly quote: string;
}

const CLAIMS: Readonly<Record<string, readonly ClaimInput[]>> = {
  odin: [
    {
      section: "operations",
      label: "Central hangar",
      value: "Heavy support craft, for example the Anvil Asgard or Valkyrie",
      quote:
        "Deploy heavy support craft, such as the Anvil Asgard or Valkyrie, from the central hangar",
    },
    {
      section: "operations",
      label: "Side hangars",
      value: "Six, for repair, refuel, rearm and redeploy",
      quote:
        "Rapidly repair, refuel, rearm, and redeploy support ships from six integrated side hangars",
    },
    {
      section: "combat",
      label: "Turrets",
      value: "23 operable",
      quote: "An incomparable 23 operable turrets",
    },
    {
      section: "combat",
      label: "Payload types",
      value: "Torpedoes, ballistics, energy weapons",
      quote: "Torpedoes. Ballistics. Energy payloads.",
    },
    {
      section: "combat",
      label: "Retractable weapons",
      value: "Weapon systems stay inside the hull until used",
      quote:
        "Entire weapons systems remain concealed within the Odin’s hull until the instant of attack.",
    },
    {
      section: "combat",
      label: "Main gun",
      value: "Twelve-emitter beam weapon, anti-capital",
      quote: "Capital ships perish beneath the Odin’s mortal gaze",
    },
    {
      section: "command",
      label: "Bridge",
      value: "Raised above the hull",
      quote:
        "Positioned high above the hull in classic naval tradition, the Odin’s reinforced bridge",
    },
    {
      section: "command",
      label: "Briefing room",
      value: "War room for planning",
      quote:
        "Coordinate assaults, track emerging threats, and prepare for battles ahead from a war room",
    },
    {
      section: "logistics",
      label: "Cargo",
      value:
        "8,000 SCU stated (the ship matrix lists 6,000), including a 2,000 SCU cargo lift",
      quote: "An astonishing 8000 SCU cargo capacity",
    },
    {
      section: "logistics",
      label: "Ammunition",
      value: "Ship-wide ammunition reserve",
      quote: "A vast ship-spanning ammunition reserve",
    },
  ],
  perseus: [
    {
      section: "combat",
      label: "Torpedoes",
      value: "Reloaded from the adjacent cargo hold",
      quote:
        "torpedoes that can be reloaded quickly from the adjacent cargo hold",
    },
    {
      section: "combat",
      label: "Turret layout",
      value: "2 manned (S8 and S3), 2 remote (S3), 6 point-defence",
      quote: "2x Manned 2x S8, 2x S3",
    },
    {
      section: "logistics",
      label: "Hold",
      value: "Cargo and ground vehicles",
      quote: "flexible storage allows for cargo and ground vehicle transport",
    },
  ],
};

export interface ShipClaimRow extends ClaimInput {
  readonly slug: string;
  readonly source_url: string;
  readonly source_title: string;
  readonly published_at: string;
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = join(here, "..", "..");
  const rows: ShipClaimRow[] = [];
  for (const [slug, claims] of Object.entries(CLAIMS)) {
    const articlePath = join(
      root,
      "fixtures",
      "showcase",
      slug,
      "article.json",
    );
    if (!existsSync(articlePath))
      throw new Error(`${slug}: no article; run fetch-showcase first`);
    const article = JSON.parse(readFileSync(articlePath, "utf8")) as {
      title: string;
      url: string;
      published_at: string;
      text: string;
    };
    for (const claim of claims) {
      if (!article.text.includes(claim.quote)) {
        throw new Error(`${slug}: quote not in the article: ${claim.quote}`);
      }
      rows.push({
        slug,
        ...claim,
        source_url: article.url,
        source_title: article.title,
        published_at: article.published_at,
      });
    }
  }
  const out = join(root, "fixtures", "ship-claims");
  mkdirSync(out, { recursive: true });
  writeFileSync(
    join(out, "ShipClaim.json"),
    `${JSON.stringify(rows, null, 2)}\n`,
  );
  console.log(JSON.stringify({ job: "media:claims", claims: rows.length }));
}

main();
