/**
 * One run of the events step (ADR-057), with its world injected so the tests need no network:
 * for every event in the registry, read RSI's schedule when it is due, the FAQ from the news pack
 * always, and return what to write. RSI is read when an event first appears, each time it moves
 * on (it opens, a new day starts) and once each UTC day while it is ahead or running: at most a
 * few requests a day. Entering `after` asks RSI nothing. A changed phase changes the state file,
 * so the workflow's commit rebuilds the site when the day turns, even when RSI changed nothing.
 *
 * A failure is the event's own: its record stays as it was (CLAUDE.md section 5, nothing from a
 * failed read goes live), the other events carry on, and its state still records the phase and
 * the attempt, so the day turns on the site and RSI is not asked again until the next phase or
 * day. A FAQ the parser cannot read keeps the sale on file and does not hold back the schedule.
 * A taken-down schedule Comm-Link removes the event; a taken-down FAQ removes the sale.
 */
import {
  type ContentItem,
  EventRecord,
  type EventSourceRef,
  type EventSource,
  eventPhase,
  phaseKey,
} from "schema";
import { z } from "zod";
import { rsiGet } from "../rsi-fetch.js";
import {
  type CommLinkMeta,
  type FaqPost,
  buildEvent,
  parseFaq,
} from "./build.js";
import { EventShapeError, bodyUrlOf, parseScheduleBody } from "./parse.js";

/** RSI's pages: one request every 5 seconds (CLAUDE.md section 9). */
export const RSI_SPACING_MS = 5_000;

/** What the state file keeps for each event: the phase it was last read in, and when. */
export const EventState = z.record(
  z.string(),
  z.strictObject({
    phase: z.string().min(1),
    body_url: z.url(),
    read_at: z.iso.datetime({ offset: true }),
  }),
);
export type EventState = z.infer<typeof EventState>;

export interface RunDeps {
  readonly fetch: typeof fetch;
  readonly sleep: (ms: number) => Promise<unknown>;
  readonly now: () => Date;
  readonly userAgent: string;
  readonly log: (event: Record<string, unknown>) => void;
}

export interface RunInput {
  readonly registry: readonly EventSource[];
  readonly news: readonly ContentItem[];
  /** The records on file, by slug. */
  readonly records: ReadonlyMap<string, EventRecord>;
  readonly state: EventState;
  /** Read RSI for every event, due or not. */
  readonly force: boolean;
}

/** A part of an event that could not be read this run. */
export interface RunFailure {
  readonly slug: string;
  readonly part: "schedule" | "faq";
  readonly error: string;
  readonly detail: Record<string, unknown> | undefined;
}

export interface RunOutput {
  /** The records to write, by slug: every event on file, changed or not. */
  readonly records: Map<string, EventRecord>;
  /** Events whose schedule Comm-Link is under takedown: their files are removed. */
  readonly removed: string[];
  readonly state: EventState;
  /** The raw pages read this run, for `--save-samples`, kept even when parsing them fails. */
  readonly pages: { slug: string; page: string; body: string }[];
  readonly requests: number;
  readonly failures: RunFailure[];
}

/** The latest revision of an item in the news pack, takedowns included, or null. */
function latestRow(
  news: readonly ContentItem[],
  source: ContentItem["source"],
  externalId: string,
): ContentItem | null {
  let best: ContentItem | null = null;
  for (const row of news) {
    if (row.source !== source || row.external_id !== externalId) continue;
    if (best === null || row.revision > best.revision) best = row;
  }
  return best;
}

const utcDay = (ms: number): number => Math.floor(ms / 86_400_000);

/**
 * Whether RSI is due a read for an event: never read, forced, moved into another phase than the
 * one last read, or last read on an earlier UTC day while it is ahead or running. Once it is over,
 * never: the record is final.
 */
export function isDue(
  record: EventRecord | undefined,
  seen: EventState[string] | undefined,
  at: Date,
  force: boolean,
): boolean {
  if (force || record === undefined || seen === undefined) return true;
  const phase = phaseKey(record, eventPhase(record, at));
  if (phase === "after") return false;
  if (seen.phase !== phase) return true;
  return utcDay(Date.parse(seen.read_at)) < utcDay(at.getTime());
}

/** The page RSI serves without the redirect its old addresses answer with (`/en/` first). */
export function englishUrl(url: string): string {
  const u = new URL(url);
  if (!u.pathname.startsWith("/en/")) u.pathname = `/en${u.pathname}`;
  return u.toString();
}

const failureOf = (
  slug: string,
  part: RunFailure["part"],
  error: unknown,
): RunFailure => ({
  slug,
  part,
  error: error instanceof Error ? error.message : String(error),
  detail: error instanceof EventShapeError ? error.detail : undefined,
});

const faqRefOf = (faq: FaqPost): EventSourceRef => ({
  kind: "spectrum",
  external_id: faq.external_id,
  url: faq.url,
  title: faq.title,
  published_at: faq.published_at,
  revision: faq.revision,
});

/** The record with the FAQ's sale in place of the one on file (null removes it). */
function withSale(
  record: EventRecord,
  faq: FaqPost | null,
  sales: ReturnType<typeof parseFaq>,
): EventRecord {
  const others = record.sources.filter((s) => s.kind !== "spectrum");
  if (faq === null)
    return EventRecord.parse({ ...record, sales: null, sources: others });
  const ref = faqRefOf(faq);
  return EventRecord.parse({
    ...record,
    sales: sales === null ? null : { ...sales, source: ref },
    sources: [...others, ref],
  });
}

export async function runEvents(
  input: RunInput,
  deps: RunDeps,
): Promise<RunOutput> {
  const records = new Map(input.records);
  const state: EventState = { ...input.state };
  const pages: RunOutput["pages"] = [];
  const removed: string[] = [];
  const failures: RunFailure[] = [];
  let requests = 0;
  const get = async (url: string): Promise<string> => {
    // The first request too: the polls of the same job have just asked RSI.
    await deps.sleep(RSI_SPACING_MS);
    requests += 1;
    const response = await rsiGet(
      url,
      { headers: { "User-Agent": deps.userAgent, Accept: "text/html" } },
      { spacingMs: RSI_SPACING_MS, sleep: deps.sleep, fetch: deps.fetch },
    );
    if (!response.ok) {
      throw new EventShapeError(`RSI answered ${response.status}`, { url });
    }
    return response.text();
  };

  for (const source of input.registry) {
    const at = deps.now();
    const slug = source.slug;
    const link = latestRow(input.news, "comm_link", source.schedule_comm_link);
    if (link === null) {
      deps.log({
        event: "events.waiting",
        slug,
        reason: `Comm-Link ${source.schedule_comm_link} is not in the news pack yet`,
      });
      continue;
    }
    if (link.takedown) {
      // The source is under takedown (CLAUDE.md section 5): the event goes with it.
      records.delete(slug);
      delete state[slug];
      removed.push(slug);
      deps.log({ event: "events.takedown", slug, part: "schedule" });
      continue;
    }
    const commLink: CommLinkMeta = {
      external_id: link.external_id,
      url: link.url,
      title: link.title,
      published_at: link.published_at,
    };
    const faqRow =
      source.faq_thread === null
        ? null
        : latestRow(input.news, "spectrum", source.faq_thread);
    if (source.faq_thread !== null && faqRow === null) {
      deps.log({
        event: "events.faq_missing",
        slug,
        thread: source.faq_thread,
      });
    }
    const faq: FaqPost | null =
      faqRow === null || faqRow.takedown
        ? null
        : {
            external_id: faqRow.external_id,
            url: faqRow.url,
            title: faqRow.thread_title ?? faqRow.title,
            published_at: faqRow.published_at,
            revision: faqRow.revision,
            body_html: faqRow.body_html,
          };
    // The FAQ's sale, read from the pack; a failure keeps the sale on file.
    let sale: { ok: true; value: ReturnType<typeof parseFaq> } | { ok: false } =
      { ok: true, value: null };
    if (faq !== null) {
      try {
        sale = { ok: true, value: parseFaq(faq, new Date(faq.published_at)) };
      } catch (error) {
        failures.push(failureOf(slug, "faq", error));
        sale = { ok: false };
      }
    }
    const record = records.get(slug);
    const seen = state[slug];
    if (!isDue(record, seen, at, input.force)) {
      if (record !== undefined) {
        if (sale.ok) records.set(slug, withSale(record, faq, sale.value));
        const phase = phaseKey(record, eventPhase(record, at));
        // Entering `after` asks RSI nothing, but the site must still rebuild without the show.
        if (seen !== undefined && seen.phase !== phase) {
          state[slug] = { ...seen, phase };
        }
      }
      deps.log({ event: "events.not_due", slug });
      continue;
    }
    try {
      const page = await get(englishUrl(commLink.url));
      const bodyUrl = bodyUrlOf(page);
      const body = await get(bodyUrl);
      pages.push({ slug, page, body });
      let built = buildEvent({
        source,
        commLink,
        bodyUrl,
        body: parseScheduleBody(body),
        faq: sale.ok ? faq : null,
        fetchedAt: deps.now(),
      });
      if (!sale.ok && record !== undefined) {
        // The FAQ failed to parse: the new schedule with the sale on file.
        built = EventRecord.parse({
          ...built,
          sales: record.sales,
          sources: [
            ...built.sources,
            ...record.sources.filter((s) => s.kind === "spectrum"),
          ],
        });
      }
      records.set(slug, built);
      state[slug] = {
        phase: phaseKey(built, eventPhase(built, at)),
        body_url: bodyUrl,
        read_at: deps.now().toISOString(),
      };
      deps.log({
        event: "events.read",
        slug,
        days: built.days.length,
        ships: built.days.reduce((n, d) => n + d.ships.length, 0),
        hulls: built.sales?.hulls.length ?? 0,
        phase: state[slug]!.phase,
      });
    } catch (error) {
      failures.push(failureOf(slug, "schedule", error));
      if (record !== undefined) {
        // The record stays as it was; the phase and the attempt are recorded, so the day still
        // turns on the site and RSI is not asked again until the next phase or day.
        if (sale.ok) records.set(slug, withSale(record, faq, sale.value));
        state[slug] = {
          phase: phaseKey(record, eventPhase(record, at)),
          body_url: seen?.body_url ?? record.body_url,
          read_at: deps.now().toISOString(),
        };
      }
    }
  }
  return { records, removed, state, pages, requests, failures };
}
