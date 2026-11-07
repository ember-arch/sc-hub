/**
 * A polite client for api.star-citizen.wiki. One serial queue spaces every request, including
 * retries, so the script can never exceed the CLAUDE.md section 9 limit of 30 requests per minute.
 * `fetch` and `sleep` are injected so unit tests run on fake timers with no network.
 */

export const WIKI_BASE_URL = "https://api.star-citizen.wiki";
export const DEFAULT_SPACING_MS = 2500;
export const DEFAULT_BACKOFF_MS: readonly number[] = [5_000, 20_000, 60_000];

export type FetchLike = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export interface WikiClientOptions {
  fetch: FetchLike;
  userAgent: string;
  baseUrl?: string;
  spacingMs?: number;
  backoffMs?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  log?: (event: Record<string, unknown>) => void;
}

export interface WikiClient {
  /** Fetches `baseUrl + path` as JSON, waiting for its turn in the queue. */
  getJson(path: string): Promise<unknown>;
  /** Requests sent so far, retries included. */
  readonly requests: number;
}

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

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function createWikiClient(options: WikiClientOptions): WikiClient {
  const baseUrl = options.baseUrl ?? WIKI_BASE_URL;
  const spacingMs = options.spacingMs ?? DEFAULT_SPACING_MS;
  const backoffMs = options.backoffMs ?? DEFAULT_BACKOFF_MS;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const log = options.log ?? (() => undefined);
  const headers = {
    "User-Agent": options.userAgent,
    Accept: "application/json",
  };

  let queue: Promise<unknown> = Promise.resolve();
  let lastStart = Number.NEGATIVE_INFINITY;
  let requests = 0;

  async function once(url: string): Promise<unknown> {
    for (let attempt = 0; ; attempt += 1) {
      const wait = lastStart + spacingMs - now();
      if (wait > 0) await sleep(wait);
      lastStart = now();
      requests += 1;

      let response: Awaited<ReturnType<FetchLike>>;
      try {
        response = await options.fetch(url, { headers });
      } catch (error) {
        const backoff = backoffMs[attempt];
        if (backoff === undefined) {
          throw new FetchError(
            `network error after ${attempt + 1} attempts: ${String(error)}`,
            url,
          );
        }
        log({
          event: "bootstrap.fetch.retry",
          url,
          attempt,
          reason: "network",
          backoff_ms: backoff,
        });
        await sleep(backoff);
        continue;
      }

      if (response.ok) {
        try {
          return await response.json();
        } catch (error) {
          throw new FetchError(
            `response is not JSON: ${String(error)}`,
            url,
            response.status,
          );
        }
      }

      const retryable = response.status === 429 || response.status >= 500;
      const backoff = backoffMs[attempt];
      if (retryable && backoff !== undefined) {
        log({
          event: "bootstrap.fetch.retry",
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

  return {
    getJson(path: string): Promise<unknown> {
      const url = baseUrl + path;
      const turn = queue.then(() => once(url));
      queue = turn.catch(() => undefined);
      return turn;
    },
    get requests(): number {
      return requests;
    },
  };
}
