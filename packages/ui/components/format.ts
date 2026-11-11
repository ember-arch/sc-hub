/** Formatting helpers shared by components. Pure; no locale beyond en and UTC so server and client agree. */

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Numbers render with tabular figures (tokens.css) and thousands separators. */
export function formatNumber(value: number, digits: 0 | 2 = 0): string {
  return digits === 0 ? integer.format(value) : decimal.format(value);
}

const absolute = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * system.md section 5: relative under 7 days ("3 h ago"), then absolute ("12 Nov 2026").
 * `now` is injected so server render, client hydration and screenshots agree.
 */
export function formatTime(iso: string, now: Date): string {
  const then = new Date(iso);
  const diff = now.getTime() - then.getTime();
  if (Number.isNaN(diff)) return iso;
  if (diff < 0 || diff >= WEEK_MS) return absolute.format(then);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : absolute.format(d);
}

/** Sentence case for enum values: `flight_ready` → `Flight ready`. */
export function sentence(value: string): string {
  const words = value.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * A source's text without its emoji (CLAUDE.md section 2: no emoji anywhere in the UI): CIG's video
 * titles carry some (a parcel after "Cargo Hauling - Day 1 vs. Day 432"). The pack keeps the
 * source's text as it came; only what a page draws loses them, and the spaces they leave.
 */
const TYPOGRAPHIC = new Set(["©", "®", "™"]);

export function withoutEmoji(text: string): string {
  return (
    text
      // The trademark signs are typography, though Unicode files them with the pictographs.
      // Skin tones and the tags of subdivision flags are not pictographs themselves; they go too.
      .replace(
        /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|\p{Emoji_Modifier}|[\u{E0020}-\u{E007F}]/gu,
        (c) => (TYPOGRAPHIC.has(c) ? c : ""),
      )
      // The joiner, the two presentation selectors and the keycap mark, each on its own.
      .replace(/\u200D|\uFE0E|\uFE0F|\u20E3/gu, "")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}
