/**
 * A serial, spaced client for starcitizen.tools and its media host (ADR-017). The wiki's
 * robots.txt asks for a 5 second crawl delay and rules out its API, so this reads plain article
 * pages and uploads only, one at a time, at least `spacingMs` apart, retries included, with the
 * project User-Agent. `fetch`, `sleep` and `now` are injected so tests run with no network.
 */

export const USER_AGENT =
  "sc-hub-titles/0.0 (non-commercial fan reference in development; github.com/ember-arch/sc-hub)";

export const WIKI_SPACING_MS = 5_000;
export const BACKOFF_MS: readonly number[] = [30_000, 120_000];

export type FetchLike = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

export interface PoliteOptions {
  readonly fetch: FetchLike;
  readonly userAgent: string;
  readonly spacingMs?: number;
  readonly backoffMs?: readonly number[];
  readonly sleep?: (ms: number) => Promise<void>;
  readonly now?: () => number;
  readonly log?: (event: Record<string, unknown>) => void;
}

export interface PoliteClient {
  text(url: string): Promise<string>;
  bytes(url: string): Promise<Uint8Array>;
  readonly requests: number;
}

export class PoliteFetchError extends Error {
  readonly url: string;
  readonly status: number | undefined;

  constructor(message: string, url: string, status?: number) {
    super(message);
    this.name = "PoliteFetchError";
    this.url = url;
    this.status = status;
  }
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function createPoliteClient(options: PoliteOptions): PoliteClient {
  const spacingMs = options.spacingMs ?? WIKI_SPACING_MS;
  const backoffMs = options.backoffMs ?? BACKOFF_MS;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const log = options.log ?? (() => undefined);
  let queue: Promise<unknown> = Promise.resolve();
  let lastStart = Number.NEGATIVE_INFINITY;
  let requests = 0;

  async function once<T>(
    url: string,
    read: (r: Awaited<ReturnType<FetchLike>>) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      const wait = lastStart + spacingMs - now();
      if (wait > 0) await sleep(wait);
      lastStart = now();
      requests += 1;
      let response: Awaited<ReturnType<FetchLike>>;
      try {
        response = await options.fetch(url, {
          headers: { "User-Agent": options.userAgent },
        });
      } catch (error) {
        const backoff = backoffMs[attempt];
        if (backoff === undefined) {
          throw new PoliteFetchError(`network error: ${String(error)}`, url);
        }
        log({ event: "titles.fetch.retry", url, attempt, backoff_ms: backoff });
        await sleep(backoff);
        continue;
      }
      if (response.ok) return read(response);
      const backoff = backoffMs[attempt];
      if (
        (response.status === 429 || response.status >= 500) &&
        backoff !== undefined
      ) {
        log({
          event: "titles.fetch.retry",
          url,
          attempt,
          status: response.status,
          backoff_ms: backoff,
        });
        await sleep(backoff);
        continue;
      }
      throw new PoliteFetchError(
        `HTTP ${response.status}`,
        url,
        response.status,
      );
    }
  }

  function enqueue<T>(job: () => Promise<T>): Promise<T> {
    const turn = queue.then(job);
    queue = turn.catch(() => undefined);
    return turn;
  }

  return {
    text: (url) => enqueue(() => once(url, (r) => r.text())),
    bytes: (url) =>
      enqueue(() =>
        once(url, async (r) => new Uint8Array(await r.arrayBuffer())),
      ),
    get requests(): number {
      return requests;
    },
  };
}
