"use client";

import { useId, useMemo, useState, useSyncExternalStore } from "react";
import {
  type Column,
  DataTable,
  RankBar,
  type RankValue,
  TextLink,
  formatNumber,
} from "ui";
import type { CombatPeer } from "../../../lib/combat";
import {
  type EditorOption,
  type EditorSlot,
  type LoadoutTotals,
  SLOT_GROUPS,
  type SlotGroup,
  optionsFor,
  totals,
} from "../../../lib/loadout-editor";

/**
 * The loadout editor (ADR-016): every swappable port on the ship, grouped by system, with what it
 * carries. Opening a port lists the parts that fit it, sortable by the figures a captain compares
 * them by, each with the difference it would make to the part fitted now. The summary adds the
 * build up (damage per second by type, alpha, missiles, shields, power drawn against power made,
 * quantum drive) beside the stock build. A build is kept in the address (`?build=`), so it can be
 * shared. Every figure comes from the parts' records; the editor only sums them.
 */

type Fitted = Readonly<Record<string, string | null>>;

const n0 = (v: number): string => formatNumber(v, 0);
const n2 = (v: number): string => formatNumber(v, 2);

function delta(now: number, was: number): string | null {
  if (Math.abs(now - was) < 0.005) return null;
  const sign = now > was ? "+" : "−";
  const diff = Math.abs(now - was);
  if (was === 0) return `${sign}${n0(diff)}`;
  return `${sign}${n0((diff / was) * 100)}%`;
}

/** The address form of a build: changed slots by position, `-` for an emptied one. */
function encode(slots: readonly EditorSlot[], fitted: Fitted): string {
  return slots
    .flatMap((s, i) =>
      s.key in fitted && fitted[s.key] !== s.stock
        ? [`${i}.${fitted[s.key] ?? "-"}`]
        : [],
    )
    .join("~");
}

function decode(
  text: string,
  slots: readonly EditorSlot[],
  options: Readonly<Record<string, EditorOption>>,
): Fitted {
  const out: Record<string, string | null> = {};
  for (const part of text.split("~")) {
    const dot = part.indexOf(".");
    const slot = slots[Number(part.slice(0, dot))];
    const id = part.slice(dot + 1);
    if (slot === undefined || dot < 1) continue;
    if (id === "-") {
      out[slot.key] = null;
      continue;
    }
    const o = options[id];
    if (
      o !== undefined &&
      o.group === slot.group &&
      o.size >= slot.sizeMin &&
      o.size <= slot.sizeMax
    )
      out[slot.key] = id;
  }
  return out;
}

const BUILD_EVENT = "sc-hub:build";

function subscribeBuild(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  window.addEventListener(BUILD_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(BUILD_EVENT, onChange);
  };
}

const readBuild = (): string =>
  new URLSearchParams(window.location.search).get("build") ?? "";

const current = (slot: EditorSlot, fitted: Fitted): string | null =>
  slot.key in fitted ? (fitted[slot.key] ?? null) : slot.stock;

/** The figures shown for a part on its slot's row. */
function summary(o: EditorOption): string {
  const s = o.stats;
  const bits: string[] = [];
  if (o.kind !== null) bits.push(o.kind);
  switch (o.group) {
    case "guns":
      if (s.dps !== null) bits.push(`${n0(s.dps)} DPS`);
      if (s.alpha !== null) bits.push(`${n0(s.alpha)} per shot`);
      if (s.range !== null) bits.push(`${n2(s.range / 1000)} km`);
      {
        const lasts = ammoSeconds(o);
        if (s.ammo !== null && lasts !== null)
          bits.push(`${n0(s.ammo)} rounds, ${duration(lasts)} of fire`);
      }
      break;
    case "missiles":
      if (s.tracking !== null) bits.push(s.tracking);
      if (s.damage !== null) bits.push(`${n0(s.damage)} damage`);
      break;
    case "shields":
      if (s.shieldHp !== null) bits.push(`${n0(s.shieldHp)} HP`);
      if (s.shieldRegen !== null) bits.push(`${n0(s.shieldRegen)}/s`);
      break;
    case "power":
      if (s.powerOut !== null) bits.push(`${n0(s.powerOut)} segments`);
      break;
    case "cooling":
      if (s.coolantOut !== null) bits.push(`${n0(s.coolantOut)} coolant`);
      break;
    case "quantum":
      if (s.qdSpeed !== null) bits.push(`${n0(s.qdSpeed / 1e6)} Mm/s`);
      if (s.qdSpool !== null) bits.push(`${n2(s.qdSpool)} s spool`);
      break;
  }
  return bits.join(" · ");
}

/** The part's headline figure in words, first on its line so it shows on phones too. */
function headlineText(o: EditorOption): string | null {
  const s = o.stats;
  switch (o.group) {
    case "guns":
      return s.dps === null ? null : `${n0(s.dps)} DPS`;
    case "missiles":
      return s.damage === null ? null : `${n0(s.damage)} damage`;
    case "shields":
      return s.shieldHp === null ? null : `${n0(s.shieldHp)} HP`;
    case "power":
      return s.powerOut === null ? null : `${n0(s.powerOut)} segments`;
    case "cooling":
      return s.coolantOut === null ? null : `${n0(s.coolantOut)} coolant`;
    case "quantum":
      return s.qdSpeed === null ? null : `${n0(s.qdSpeed / 1e6)} Mm/s`;
  }
}

interface Row {
  readonly option: EditorOption;
  readonly fitted: boolean;
  readonly stock: boolean;
}

/** One number cell with how it compares to the part fitted now. */
function Compare({
  value,
  was,
  digits = 0,
  scale = 1,
}: {
  readonly value: number | null;
  readonly was: number | null;
  readonly digits?: 0 | 2;
  readonly scale?: number;
}) {
  if (value === null) return <span className="text-secondary">—</span>;
  const v = value / scale;
  const diff = was === null ? null : v - was / scale;
  return (
    <span className="whitespace-nowrap font-mono">
      {formatNumber(v, digits)}
      {diff === null || Math.abs(diff) < 0.005 ? null : (
        <span className="block text-caption text-secondary">
          {diff > 0 ? "+" : "−"}
          {formatNumber(Math.abs(diff), digits)}
        </span>
      )}
    </span>
  );
}

function columns(
  group: SlotGroup,
  now: EditorOption | null,
  fit: (id: string) => void,
): Column<Row>[] {
  const name: Column<Row> = {
    key: "name",
    header: "Part",
    primary: true,
    render: (r) => (
      <span className="flex flex-col items-start gap-1">
        <button
          type="button"
          onClick={() => fit(r.option.id)}
          disabled={r.fitted}
          className="rounded-control text-left text-ui text-primary underline decoration-hairline-strong underline-offset-2 hover:decoration-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:no-underline"
        >
          {r.option.name}
        </button>
        <span className="text-caption text-secondary">
          {[
            headlineText(r.option),
            r.option.kind,
            r.option.maker,
            `S${r.option.size}`,
            r.fitted ? "Fitted" : r.stock ? "Stock" : null,
          ]
            .filter((x) => x !== null)
            .join(" · ")}
        </span>
      </span>
    ),
    sortValue: (r) => r.option.name,
  };
  const stat = (
    key: string,
    header: string,
    pick: (o: EditorOption) => number | null,
    unit?: string,
    digits: 0 | 2 = 0,
    scale = 1,
  ): Column<Row> => ({
    key,
    header,
    unit,
    align: "right",
    render: (r) => (
      <Compare
        value={pick(r.option)}
        was={now === null || r.fitted ? null : pick(now)}
        digits={digits}
        scale={scale}
      />
    ),
    sortValue: (r) => pick(r.option),
  });
  const draw = stat("power", "Power", (o) => o.stats.powerDraw, "seg", 2);
  switch (group) {
    case "guns":
      return [
        name,
        stat("dps", "Damage", (o) => o.stats.dps, "/s"),
        stat("alpha", "Per shot", (o) => o.stats.alpha),
        stat("range", "Range", (o) => o.stats.range, "km", 2, 1000),
        stat("speed", "Speed", (o) => o.stats.speed, "m/s"),
        stat("ammo", "Ammo", (o) => o.stats.ammo),
        draw,
      ];
    case "missiles":
      return [
        name,
        {
          key: "tracking",
          header: "Tracks",
          render: (r) => r.option.stats.tracking ?? "—",
          sortValue: (r) => r.option.stats.tracking,
        },
        stat("damage", "Damage", (o) => o.stats.damage),
        stat("speed", "Speed", (o) => o.stats.speed, "m/s"),
        stat("lock", "Lock range", (o) => o.stats.lockRange, "km", 2, 1000),
      ];
    case "shields":
      return [
        name,
        stat("hp", "Health", (o) => o.stats.shieldHp, "HP"),
        stat("regen", "Regen", (o) => o.stats.shieldRegen, "HP/s"),
        draw,
      ];
    case "power":
      return [name, stat("out", "Output", (o) => o.stats.powerOut, "seg")];
    case "cooling":
      return [
        name,
        stat("coolant", "Coolant", (o) => o.stats.coolantOut, "seg"),
        draw,
      ];
    case "quantum":
      return [
        name,
        stat("speed", "Speed", (o) => o.stats.qdSpeed, "Mm/s", 0, 1e6),
        stat("spool", "Spool", (o) => o.stats.qdSpool, "s", 2),
        stat("fuel", "Fuel", (o) => o.stats.qdFuel, "per Gm", 2),
        draw,
      ];
  }
}

function Picker({
  slot,
  slots,
  fitted,
  options,
  onFit,
  onClose,
}: {
  readonly slot: EditorSlot;
  readonly slots: readonly EditorSlot[];
  readonly fitted: Fitted;
  readonly options: Readonly<Record<string, EditorOption>>;
  readonly onFit: (keys: readonly string[], id: string | null) => void;
  readonly onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const nowId = current(slot, fitted);
  const now = nowId === null ? null : (options[nowId] ?? null);
  // Matching slots: the same kind of port carrying the same part now, such as a pair of wing guns.
  const matching = slots.filter(
    (s) =>
      s.group === slot.group &&
      s.sizeMin === slot.sizeMin &&
      s.sizeMax === slot.sizeMax &&
      current(s, fitted) === nowId,
  );
  const [all, setAll] = useState(matching.length > 1);
  const keys = all ? matching.map((s) => s.key) : [slot.key];
  const words = query.trim().toLowerCase();
  const rows: Row[] = optionsFor(slot, options)
    .filter(
      (o) =>
        words === "" ||
        `${o.name} ${o.maker} ${o.kind ?? ""}`.toLowerCase().includes(words),
    )
    .map((o) => ({
      option: o,
      fitted: o.id === nowId,
      stock: o.id === slot.stock,
    }));
  const id = useId();
  return (
    <div
      role="region"
      aria-label={`Parts that fit the ${slot.location.toLowerCase()} port`}
      className="flex flex-col gap-3 border-t border-hairline bg-page p-3"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={`${id}-q`} className="sr-only">
          Filter parts
        </label>
        <input
          id={`${id}-q`}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name, maker or type"
          // The picker opens on a reader's request; its filter takes the focus.
          autoFocus
          className="min-w-0 basis-full rounded-control border border-hairline-strong bg-surface px-2 py-1 text-ui text-primary placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent sm:basis-auto sm:flex-1"
        />
        {matching.length > 1 ? (
          <label className="flex items-center gap-2 text-caption text-secondary">
            <input
              type="checkbox"
              checked={all}
              onChange={(e) => setAll(e.target.checked)}
              className="accent-accent"
            />
            Fit all {matching.length} matching ports
          </label>
        ) : null}
        {nowId === null ? null : (
          <button
            type="button"
            onClick={() => onFit(keys, null)}
            className="rounded-control border border-hairline-strong px-2 py-1 text-caption text-secondary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Leave empty
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-control border border-hairline-strong px-2 py-1 text-caption text-secondary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          Close
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="m-0 text-ui text-secondary">No part matches.</p>
      ) : (
        <DataTable
          caption={`Parts for the ${slot.location.toLowerCase()} port, size ${slot.sizeMin === slot.sizeMax ? slot.sizeMax : `${slot.sizeMin} to ${slot.sizeMax}`}`}
          rows={rows}
          rowKey={(r) => r.option.id}
          columns={columns(slot.group, now, (pick) => onFit(keys, pick))}
          unitsBelow
        />
      )}
      <p className="m-0 text-caption text-secondary">
        Differences are against the part fitted now
        {now === null ? "" : `, ${now.name}`}. Choose a part to fit it.
      </p>
    </div>
  );
}

function SlotRow({
  slot,
  fitted,
  options,
  open,
  onOpen,
  onReset,
  panelId,
}: {
  readonly slot: EditorSlot;
  readonly fitted: Fitted;
  readonly options: Readonly<Record<string, EditorOption>>;
  readonly open: boolean;
  readonly onOpen: () => void;
  readonly onReset: () => void;
  readonly panelId: string;
}) {
  const id = current(slot, fitted);
  const o = id === null ? null : (options[id] ?? null);
  const changed = slot.key in fitted && fitted[slot.key] !== slot.stock;
  const size =
    slot.sizeMin === slot.sizeMax
      ? `S${slot.sizeMax}`
      : `S${slot.sizeMin}–${slot.sizeMax}`;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3">
      <span className="w-12 shrink-0 rounded-control border border-hairline-strong px-1 py-1 text-center font-mono text-caption text-primary">
        {size}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-caption text-secondary">
          {slot.location}
          {slot.mount === null ? "" : ` · ${slot.mount}`}
          {changed ? <span className="text-accent"> · Changed</span> : null}
        </span>
        {o === null ? (
          <span className="text-ui text-secondary">Empty</span>
        ) : (
          <>
            <TextLink href={`/components/${o.slug}`} className="text-ui">
              {o.name}
            </TextLink>
            <span className="text-caption text-secondary">{summary(o)}</span>
          </>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        {changed ? (
          <button
            type="button"
            onClick={onReset}
            className="rounded-control border border-hairline-strong px-2 py-1 text-caption text-secondary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            Stock
          </button>
        ) : null}
        <button
          type="button"
          onClick={onOpen}
          aria-expanded={open}
          aria-controls={panelId}
          className={`rounded-control border px-2 py-1 text-caption focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${open ? "border-accent bg-accent-bg text-primary" : "border-hairline-strong text-primary hover:border-accent"}`}
        >
          {open ? "Close" : "Change"}
        </button>
      </div>
    </div>
  );
}

/** A labelled figure with its change against the stock build. */
function Figure({
  label,
  value,
  unit,
  now,
  was,
  note,
}: {
  readonly label: string;
  readonly value: string;
  readonly unit?: string | undefined;
  readonly now: number;
  readonly was: number;
  readonly note?: string | undefined;
}) {
  const d = delta(now, was);
  return (
    <div className="flex flex-col gap-1 border-b border-hairline py-2">
      <dt className="text-caption text-secondary">{label}</dt>
      <dd className="m-0 flex flex-wrap items-baseline gap-x-2">
        <span className="font-mono text-title text-primary">{value}</span>
        {unit === undefined ? null : (
          <span className="text-caption text-secondary">{unit}</span>
        )}
        {d === null ? null : (
          <span className="font-mono text-caption text-accent">
            {d} on stock
          </span>
        )}
      </dd>
      {note === undefined ? null : (
        <dd className="m-0 text-caption text-secondary">{note}</dd>
      )}
    </div>
  );
}

/** Damage per second by type, as one bar: what the guns do to shields and hulls differs by type. */
function DamageMix({ t }: { readonly t: LoadoutTotals }) {
  const parts = [
    { key: "Energy", value: t.dpsByType.Energy, fill: "bg-accent" },
    { key: "Physical", value: t.dpsByType.Physical, fill: "bg-primary" },
    {
      key: "Distortion",
      value: t.dpsByType.Distortion,
      fill: "bg-hairline-strong",
    },
  ].filter((p) => p.value > 0);
  const sum = parts.reduce((n, p) => n + p.value, 0);
  if (sum === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex h-2 w-full overflow-hidden rounded-control bg-inset"
        aria-hidden="true"
      >
        {parts.map((p) => (
          <span
            key={p.key}
            className={p.fill}
            style={{ width: `${(p.value / sum) * 100}%` }}
          />
        ))}
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-caption text-secondary">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2">
            <span className={`inline-block size-2 rounded-control ${p.fill}`} />
            {p.key} {n0(p.value)}/s ({n0((p.value / sum) * 100)}%)
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * What the parts here would draw at full power against what the power plants make. Stock builds
 * often want more than is made; it is a comparison between builds, not a warning.
 */
/** Seconds of continuous fire a ballistic gun's rounds last at its listed rate; null for energy guns. */
function ammoSeconds(o: EditorOption): number | null {
  const { ammo, rpm } = o.stats;
  return ammo === null || rpm === null || rpm <= 0 ? null : ammo / (rpm / 60);
}

/** "2 min 41 s", "48 s". */
function duration(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return s % 60 === 0 ? `${m} min` : `${m} min ${s % 60} s`;
}

/** Which ballistic gun runs dry first, holding the trigger: ammunition is the limit energy guns lack. */
function AmmoNote({
  slots,
  fitted,
  options,
}: {
  readonly slots: readonly EditorSlot[];
  readonly fitted: Fitted;
  readonly options: Readonly<Record<string, EditorOption>>;
}) {
  const ballistic = slots.flatMap((s) => {
    if (s.group !== "guns") return [];
    const id = current(s, fitted);
    const o = id === null ? undefined : options[id];
    const lasts = o === undefined ? null : ammoSeconds(o);
    return o === undefined || lasts === null ? [] : [{ o, lasts }];
  });
  if (ballistic.length === 0) return null;
  const first = ballistic.reduce((a, b) => (b.lasts < a.lasts ? b : a));
  return (
    <p className="m-0 text-caption text-secondary">
      {ballistic.length === 1
        ? `The ${first.o.name} carries ${n0(first.o.stats.ammo ?? 0)} rounds: ${duration(first.lasts)} of continuous fire at its listed rate.`
        : `Of the ${ballistic.length} ballistic guns, the ${first.o.name} runs out of rounds first, after ${duration(first.lasts)} of continuous fire at its listed rate.`}{" "}
      Energy guns draw on power instead.
    </p>
  );
}

/**
 * The build among the ships on record: its sums against each other ship's stock build, the same
 * rank bars the rest of the ship file uses. Log scales, because the ships on record span a fighter
 * to a capital ship.
 */
function Ranks({
  name,
  t,
  peers,
  changed,
}: {
  readonly name: string;
  readonly t: LoadoutTotals;
  readonly peers: readonly CombatPeer[];
  readonly changed: boolean;
}) {
  if (peers.length === 0) return null;
  const label = changed ? `${name}, this build` : name;
  const values = (
    pick: (
      p: Pick<CombatPeer, "gunDps" | "missileDamage" | "shieldHp">,
    ) => number,
  ): RankValue[] =>
    [
      ...peers.map((p) => ({ key: p.key, name: p.name, value: pick(p) })),
      { key: "build", name: label, value: pick(t), current: true },
    ].filter((v) => v.value > 0);
  return (
    <div className="flex flex-col border-t border-hairline pt-2">
      <p className="m-0 text-caption text-secondary">
        Against the other ships on record, each as it comes from the factory
      </p>
      <RankBar
        label="Gun damage"
        unit="per s"
        most="Hardest hitting"
        scale="log"
        values={values((p) => p.gunDps)}
      />
      <RankBar
        label="Missile damage"
        unit="damage"
        most="Most missile damage"
        scale="log"
        values={values((p) => p.missileDamage)}
      />
      <RankBar
        label="Shields"
        unit="HP"
        most="Best shielded"
        scale="log"
        values={values((p) => p.shieldHp)}
      />
    </div>
  );
}

function PowerBar({
  t,
  stock,
}: {
  readonly t: LoadoutTotals;
  readonly stock: LoadoutTotals;
}) {
  if (t.powerOut === 0) return null;
  const share = Math.min(1, t.powerDraw / t.powerOut);
  const stockShare = Math.min(1, stock.powerDraw / Math.max(stock.powerOut, 1));
  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative h-2 w-full overflow-hidden rounded-control bg-inset"
        aria-hidden="true"
      >
        <span
          className="block h-full bg-accent"
          style={{ width: `${share * 100}%` }}
        />
        <span
          className="absolute inset-y-0 w-px bg-primary"
          style={{ left: `${stockShare * 100}%` }}
        />
      </div>
      <p className="m-0 text-caption text-secondary">
        At full draw the parts here want {n2(t.powerDraw)} power segments; the
        power plants make {n0(t.powerOut)}. The line marks the stock build.
      </p>
    </div>
  );
}

export function LoadoutEditor({
  name,
  slots,
  options,
  peers,
}: {
  readonly name: string;
  readonly slots: readonly EditorSlot[];
  readonly options: Readonly<Record<string, EditorOption>>;
  /** The other ships' stock sums, to rank this build among them. */
  readonly peers: readonly CombatPeer[];
}) {
  // The address holds the build, so a shared link opens it and the server renders stock.
  const build = useSyncExternalStore(subscribeBuild, readBuild, () => "");
  const fitted = useMemo(
    () => decode(build, slots, options),
    [build, slots, options],
  );
  const setFitted = (update: (f: Fitted) => Fitted) => {
    const url = new URL(window.location.href);
    const next = encode(slots, update(fitted));
    if (next === "") url.searchParams.delete("build");
    else url.searchParams.set("build", next);
    window.history.replaceState(window.history.state, "", url);
    window.dispatchEvent(new Event(BUILD_EVENT));
  };
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const base = useId();

  const stock = useMemo(() => totals(slots, {}, options), [slots, options]);
  const now = useMemo(
    () => totals(slots, fitted, options),
    [slots, fitted, options],
  );
  const changed = slots.filter(
    (s) => s.key in fitted && fitted[s.key] !== s.stock,
  ).length;

  const fit = (keys: readonly string[], id: string | null) => {
    setFitted((f) => {
      const next: Record<string, string | null> = { ...f };
      for (const key of keys) {
        const slot = slots.find((s) => s.key === key);
        if (slot === undefined) continue;
        if (id === slot.stock) delete next[key];
        else next[key] = id;
      }
      return next;
    });
    setOpen(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-label={`${name} build summary`}
        className="flex flex-col gap-4 rounded-card border border-hairline bg-surface p-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="m-0 text-ui font-medium text-primary">
            {changed === 0
              ? "Stock build"
              : `Your build: ${changed} ${changed === 1 ? "part" : "parts"} changed`}
          </h3>
          <div className="flex gap-2">
            {changed === 0 ? null : (
              <button
                type="button"
                onClick={() => setFitted(() => ({}))}
                className="rounded-control border border-hairline-strong px-2 py-1 text-caption text-primary hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                Back to stock
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(window.location.href)
                  .then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2000);
                  })
                  .catch(() => undefined);
              }}
              className="rounded-control border border-hairline-strong px-2 py-1 text-caption text-primary hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              {copied ? "Link copied" : "Copy link to this build"}
            </button>
          </div>
        </div>
        <dl className="m-0 grid grid-cols-2 gap-x-6 sm:grid-cols-3">
          <Figure
            label="Gun damage"
            value={n0(now.gunDps)}
            unit="per s"
            now={now.gunDps}
            was={stock.gunDps}
          />
          <Figure
            label="Per volley"
            value={n0(now.gunAlpha)}
            unit="damage"
            now={now.gunAlpha}
            was={stock.gunAlpha}
          />
          <Figure
            label="Missiles"
            value={n0(now.missileDamage)}
            unit="damage"
            now={now.missileDamage}
            was={stock.missileDamage}
            note={`${now.missiles} carried`}
          />
          <Figure
            label="Shields"
            value={n0(now.shieldHp)}
            unit="HP"
            now={now.shieldHp}
            was={stock.shieldHp}
            note={`${n0(now.shieldRegen)} HP/s back`}
          />
          <Figure
            label="Power"
            value={`${n2(now.powerDraw)} / ${n0(now.powerOut)}`}
            unit="segments"
            now={now.powerDraw}
            was={stock.powerDraw}
          />
          <Figure
            label="Quantum"
            value={now.qdSpeed === null ? "—" : n0(now.qdSpeed / 1e6)}
            unit="Mm/s"
            now={now.qdSpeed ?? 0}
            was={stock.qdSpeed ?? 0}
            note={
              now.qdSpool === null ? undefined : `${n2(now.qdSpool)} s to spool`
            }
          />
        </dl>
        <DamageMix t={now} />
        <AmmoNote slots={slots} fitted={fitted} options={options} />
        <PowerBar t={now} stock={stock} />
        <Ranks name={name} t={now} peers={peers} changed={changed > 0} />
      </section>

      {SLOT_GROUPS.map((g) => {
        const own = slots.filter((s) => s.group === g.id);
        if (own.length === 0) return null;
        const sub =
          g.id === "guns"
            ? `${n0(now.gunDps)} damage per s`
            : g.id === "missiles"
              ? `${now.missiles} carried, ${n0(now.missileDamage)} damage`
              : g.id === "shields"
                ? `${n0(now.shieldHp)} HP`
                : g.id === "power"
                  ? `${n0(now.powerOut)} segments`
                  : g.id === "cooling"
                    ? `${n0(now.coolantOut)} coolant`
                    : now.qdSpeed === null
                      ? ""
                      : `${n0(now.qdSpeed / 1e6)} Mm/s`;
        return (
          <section
            key={g.id}
            aria-labelledby={`${base}-${g.id}`}
            className="overflow-hidden rounded-card border border-hairline bg-surface"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hairline px-3 py-2">
              <h3
                id={`${base}-${g.id}`}
                className="m-0 text-ui font-medium text-primary"
              >
                {g.title}{" "}
                <span className="font-mono text-secondary">{own.length}</span>
              </h3>
              <span className="text-caption text-secondary">{sub}</span>
            </div>
            <ul className="m-0 list-none divide-y divide-hairline p-0">
              {own.map((slot) => {
                const panelId = `${base}-${slot.key.replace(/[^a-z0-9]/gi, "-")}`;
                return (
                  <li key={slot.key}>
                    <SlotRow
                      slot={slot}
                      fitted={fitted}
                      options={options}
                      open={open === slot.key}
                      onOpen={() =>
                        setOpen((o) => (o === slot.key ? null : slot.key))
                      }
                      onReset={() =>
                        setFitted((f) => {
                          const next = { ...f };
                          delete next[slot.key];
                          return next;
                        })
                      }
                      panelId={panelId}
                    />
                    {open === slot.key ? (
                      <div id={panelId}>
                        <Picker
                          slot={slot}
                          slots={slots}
                          fitted={fitted}
                          options={options}
                          onFit={fit}
                          onClose={() => setOpen(null)}
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
