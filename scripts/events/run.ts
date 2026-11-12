/**
 * One run of the events step (ADR-057), with its world injected so the tests need no network:
 * for every event in the registry, read RSI's schedule when it is due, the FAQ from the news pack
 * always, and return what to write. RSI is read once when an event first appears and then once
 * each time the event moves on (it opens, a new day starts, it ends): two requests a day, at the
 * hour RSI itself turns the day over. A changed phase also changes the state file, so the
 * workflow's commit rebuilds the site when the day turns, even when RSI changed nothing.
 */
import {
  type ContentItem,
  EventRecord,
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

/** What the state file keeps for each event: the phase it was last read in. */
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

export interface RunOutput {
  /** The records to write, by slug: every event, changed or not. */
  readonly records: Map<string, EventRecord>;
  readonly state: EventState;
  /** The raw pages read this run, for `--save-samples`. */
  readonly pages: { slug: string; page: string; body: string }[];
  readonly requests: number;
}

/** The latest revision of an item in the news pack, or null. */
function latest(
  news: readonly ContentItem[],
  source: ContentItem["source"],
  externalId: string,
): ContentItem | null {
  let best: ContentItem | null = null;
  for (const row of news) {
    if (row.source !== source || row.external_id !== externalId) continue;
    if (best === null || row.revision > best.revision) best = row;
  }
  return best === null || best.takedown ? null : best;
}

/**
 * Whether RSI is due a read for an event: never read, read in another phase than now, or forced.
 * Over and read once it was over, never again.
 */
export function isDue(
  record: EventRecord | undefined,
  seen: EventState[string] | undefined,
  at: Date,
  force: boolean,
): boolean {
  if (force || record === undefined || seen === undefined) return true;
  return seen.phase !== phaseKey(record, eventPhase(record, at));
}

/** The page RSI serves without the redirect its old addresses answer with (`/en/` first). */
export function englishUrl(url: string): string {
  const u = new URL(url);
  if (!u.pathname.startsWith("/en/")) u.pathname = `/en${u.pathname}`;
  return u.toString();
}

export async function runEvents(
  input: RunInput,
  deps: RunDeps,
): Promise<RunOutput> {
  const records = new Map(input.records);
  const state: EventState = { ...input.state };
  const pages: RunOutput["pages"] = [];
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
    const link = latest(input.news, "comm_link", source.schedule_comm_link);
    if (link === null) {
      deps.log({
        event: "events.waiting",
        slug: source.slug,
        reason: `Comm-Link ${source.schedule_comm_link} is not in the news pack yet`,
      });
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
        : latest(input.news, "spectrum", source.faq_thread);
    if (source.faq_thread !== null && faqRow === null) {
      deps.log({
        event: "events.faq_missing",
        slug: source.slug,
        thread: source.faq_thread,
      });
    }
    const faq: FaqPost | null =
      faqRow === null
        ? null
        : {
            external_id: faqRow.external_id,
            url: faqRow.url,
            title: faqRow.thread_title ?? faqRow.title,
            published_at: faqRow.published_at,
            revision: faqRow.revision,
            body_html: faqRow.body_html ?? "",
          };
    const record = records.get(source.slug);
    if (!isDue(record, state[source.slug], at, input.force)) {
      // Not due: RSI is not asked; the FAQ, from the pack, is read again for its sale.
      if (record !== undefined && faq !== null) {
        const sales = parseFaq(faq, new Date(faq.published_at));
        const faqRef = {
          kind: "spectrum" as const,
          external_id: faq.external_id,
          url: faq.url,
          title: faq.title,
          published_at: faq.published_at,
          revision: faq.revision,
        };
        records.set(
          source.slug,
          EventRecord.parse({
            ...record,
            sales: sales === null ? null : { ...sales, source: faqRef },
            sources: [
              ...record.sources.filter((s) => s.kind !== "spectrum"),
              faqRef,
            ],
          }),
        );
      }
      deps.log({ event: "events.not_due", slug: source.slug });
      continue;
    }
    const page = await get(englishUrl(commLink.url));
    const bodyUrl = bodyUrlOf(page);
    const body = await get(bodyUrl);
    pages.push({ slug: source.slug, page, body });
    const built = buildEvent({
      source,
      commLink,
      bodyUrl,
      body: parseScheduleBody(body),
      faq,
      fetchedAt: deps.now(),
    });
    records.set(source.slug, built);
    state[source.slug] = {
      phase: phaseKey(built, eventPhase(built, at)),
      body_url: bodyUrl,
      read_at: deps.now().toISOString(),
    };
    deps.log({
      event: "events.read",
      slug: source.slug,
      days: built.days.length,
      ships: built.days.reduce((n, d) => n + d.ships.length, 0),
      hulls: built.sales?.hulls.length ?? 0,
      phase: state[source.slug]!.phase,
    });
  }
  return { records, state, pages, requests };
}
