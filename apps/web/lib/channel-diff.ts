/**
 * PTU as a diff against LIVE (CLAUDE.md section 5: LIVE is canonical, PTU values display as a
 * diff, never as the default). Pure: takes two stat rows of the same shape and returns, per
 * numeric field, PTU minus LIVE where the two differ. Fields that are null on either side, equal,
 * or not numbers (identity, channel, version, `raw`) are left out, so an empty result means
 * "no PTU differences for this version".
 */

export type Deltas<T> = Readonly<Partial<Record<keyof T, number>>>;

export function channelDeltas<T extends object>(
  live: T,
  ptu: T | null,
): Deltas<T> {
  const out: Partial<Record<keyof T, number>> = {};
  if (ptu === null) return out;
  for (const key of Object.keys(live) as (keyof T)[]) {
    const a = live[key];
    const b = ptu[key];
    if (typeof a !== "number" || typeof b !== "number") continue;
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (a === b) continue;
    out[key] = b - a;
  }
  return out;
}

export function hasDeltas<T>(deltas: Deltas<T>): boolean {
  return Object.keys(deltas).length > 0;
}
