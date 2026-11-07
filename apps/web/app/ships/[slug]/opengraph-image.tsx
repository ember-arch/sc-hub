import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { ImageResponse } from "next/og";
import { color, font, type as typeTokens } from "ui/tokens";
import { SITE_NAME } from "ui/brand";
import { repo } from "../../../lib/data";
import { resolveSlug } from "../../../lib/slugs";

/**
 * Open Graph image per ship (spec 02, "SEO"). The spec wants the pipeline thumbnail or the
 * fankit render; neither exists yet (no R2, fankit not downloaded), so this is a placeholder
 * drawn from the design tokens: the dark page color, the ship name in the display size, the
 * manufacturer and role, the site name. Generated at build for every ship in the pack, so the
 * PNG is a static file served by the host, not an asset routed through the app server.
 */

export const alt = "Ship name and manufacturer on a plain dark card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-static";

export function generateStaticParams() {
  return repo().ships.map((s) => ({ slug: s.vehicle.slug }));
}

/** Geist Medium from the geist package (ADR-005's face), by walking from an exported entry. */
async function geistMedium(): Promise<ArrayBuffer | null> {
  try {
    const require = createRequire(import.meta.url);
    const entry = require.resolve("geist/font/sans");
    const path = join(
      dirname(entry),
      "fonts",
      "geist-sans",
      "Geist-Medium.ttf",
    );
    const buffer = await readFile(path);
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;
  } catch {
    return null;
  }
}

export default async function OpenGraphImage({
  params,
}: {
  readonly params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const r = repo();
  const result = resolveSlug(
    r.ships.map((s) => s.vehicle),
    slug,
  );
  const ship =
    result.status === "missing" ? undefined : r.shipBySlug(result.entity.slug);
  const name = ship?.vehicle.name ?? SITE_NAME;
  const line = [
    ship?.manufacturer?.name ?? ship?.vehicle.manufacturer_code,
    ship?.vehicle.role,
  ]
    .filter((x): x is string => typeof x === "string" && x !== "")
    .join(" · ");
  const data = await geistMedium();
  const dark = color.dark;
  const options: ConstructorParameters<typeof ImageResponse>[1] = { ...size };
  if (data !== null) {
    options.fonts = [
      {
        name: font.sans.family,
        data,
        weight: typeTokens.display.weight,
        style: "normal",
      },
    ];
  }
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 96,
        background: dark["bg.page"],
        color: dark["text.primary"],
        fontFamily: data === null ? "sans-serif" : font.sans.family,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            fontSize: typeTokens.caption.size * 2,
            color: dark["text.secondary"],
          }}
        >
          {line}
        </div>
        <div
          style={{
            fontSize: typeTokens.display.size * 2.4,
            lineHeight: 1.05,
            fontWeight: typeTokens.display.weight,
          }}
        >
          {name}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: typeTokens.body.size * 2,
          color: dark["text.secondary"],
        }}
      >
        <span>{SITE_NAME}</span>
        <span>Fan reference</span>
      </div>
    </div>,
    options,
  );
}
