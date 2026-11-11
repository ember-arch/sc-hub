/**
 * One polite client for every source the news pollers read (CLAUDE.md section 9): requests to a
 * host are serial and spaced, the User-Agent is the one docs/legal/obligations.md asks for (the
 * site, its about page and, when set, the contact address; `userAgent` in `packages/schema`,
 * ADR-036), and an RSI host is refused without the address; a 429 or a 5xx is retried after a
 * pause, anything else is an error. `fetch`, `sleep` and `now` are injected so the tests run on
 * fixtures with no network.
 */
import { userAgent } from "schema/site";

export type FetchLike = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

export interface ClientOptions {
  readonly fetch: FetchLike;
  /** The contact address RSI requests carry; null when unset, which makes an RSI request an error. */
  readonly contact: string | null;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly now?: () => number;
  readonly log?: (event: Record<string, unknown>) => void;
}

/** Spacing per host, in milliseconds: the polite limits of CLAUDE.md section 9. */
export const SPACING_MS: Readonly<Record<string, number>> = {
  "robertsspaceindustries.com": 5_000,
  "api.star-citizen.wiki": 2_000,
  // One channel feed a run, once an hour (ADR-050); spaced like every other host all the same.
  "www.youtube.com": 5_000,
};
const RSI_HOSTS = new Set(["robertsspaceindustries.com"]);
/** Hosts asked once and never again in a run: a retry would be a second request inside the hour (ADR-050). */
const NO_RETRY_HOSTS = new Set(["www.youtube.com"]);
const BACKOFF_MS: readonly number[] = [30_000, 120_000];

export class FetchError extends Error {
  readonly url: string;
  readonly status: number | undefined;
  constructor(message: string, url: string, status?: number) {
    super(message);
    this.name = "FetchError";
    this.url = url;
    this.status = status;
  }
}

export interface Client {
  text(url: string): Promise<string>;
  json(url: string): Promise<unknown>;
  readonly requests: number;
}

export function createClient(options: ClientOptions): Client {
  const sleep =
    options.sleep ??
    ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;
  const log = options.log ?? (() => undefined);
  const lastStart = new Map<string, number>();
  let queue: Promise<unknown> = Promise.resolve();
  let requests = 0;

  async function once(url: string): Promise<string> {
    const host = new URL(url).hostname;
    if (RSI_HOSTS.has(host) && options.contact === null) {
      throw new FetchError(
        "Set SC_HUB_CONTACT_EMAIL: CLAUDE.md section 9 asks RSI requests to carry a contact address.",
        url,
      );
    }
    const spacing = SPACING_MS[host] ?? 5_000;
    for (let attempt = 0; ; attempt += 1) {
      const wait =
        (lastStart.get(host) ?? Number.NEGATIVE_INFINITY) + spacing - now();
      if (wait > 0) await sleep(wait);
      lastStart.set(host, now());
      requests += 1;
      let response: Awaited<ReturnType<FetchLike>>;
      try {
        response = await options.fetch(url, {
          headers: {
            "User-Agent": userAgent("poll-news", options.contact),
            Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
          },
        });
      } catch (error) {
        const backoff = NO_RETRY_HOSTS.has(host)
          ? undefined
          : BACKOFF_MS[attempt];
        if (backoff === undefined)
          throw new FetchError(`network error: ${String(error)}`, url);
        log({ event: "news.fetch.retry", url, attempt, backoff_ms: backoff });
        await sleep(backoff);
        continue;
      }
      if (response.ok) return response.text();
      const backoff = NO_RETRY_HOSTS.has(host)
        ? undefined
        : BACKOFF_MS[attempt];
      if (
        (response.status === 429 || response.status >= 500) &&
        backoff !== undefined
      ) {
        log({
          event: "news.fetch.retry",
          url,
          attempt,
          status: response.status,
          backoff_ms: backoff,
        });
        await sleep(backoff);
        continue;
      }
      throw new FetchError(`HTTP ${response.status}`, url, response.status);
    }
  }

  function enqueue<T>(job: () => Promise<T>): Promise<T> {
    const turn = queue.then(job);
    queue = turn.catch(() => undefined);
    return turn;
  }

  return {
    text: (url) => enqueue(() => once(url)),
    json: (url) => enqueue(async () => JSON.parse(await once(url)) as unknown),
    get requests() {
      return requests;
    },
  };
}
