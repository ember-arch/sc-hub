/**
 * The media store behind the CDN (ADR-034): Vercel Blob, through the `@vercel/blob` SDK, behind a
 * small interface so `publish-sync.ts` can be tested against an in-memory store with no network
 * (CLAUDE.md section 6). The store is connected to the Vercel project; its credentials are in the
 * owner's `.env.local` and nowhere else.
 */
import {
  BlobAccessError,
  BlobClientTokenExpiredError,
  BlobContentTypeNotAllowedError,
  BlobError,
  BlobFileTooLargeError,
  BlobNotFoundError,
  BlobPathnameMismatchError,
  BlobServiceRateLimited,
  BlobStoreNotFoundError,
  BlobStoreSuspendedError,
  BlobUnknownError,
  del,
  head,
  list,
  put,
} from "@vercel/blob";

export interface StoredObject {
  /** The pathname in the store, `media/...`. */
  readonly key: string;
  readonly size: number;
  /** The public address the CDN serves it from. */
  readonly url: string;
}

export interface PutOptions {
  readonly contentType: string;
  /** Seconds for the CDN and browsers; Blob composes the Cache-Control header from it. */
  readonly cacheMaxAge: number;
  /** Whether an object already at the key may be replaced; the store refuses otherwise. */
  readonly overwrite: boolean;
}

export interface MediaStore {
  /** Every object under `prefix`, by key. */
  list(prefix: string): Promise<Map<string, StoredObject>>;
  put(
    key: string,
    body: Uint8Array,
    options: PutOptions,
  ): Promise<StoredObject>;
  delete(key: string): Promise<void>;
  /** The bytes at `key` as the CDN serves them now, or null when there is none. */
  read(key: string): Promise<Uint8Array | null>;
}

/** `https://x.public.blob.vercel-storage.com/media/a.webp` + `media/a.webp` → the store's base. */
export function storeBaseUrl(url: string, key: string): string {
  const suffix = `/${key}`;
  if (!url.endsWith(suffix)) {
    throw new Error(`${url} does not end with ${suffix}`);
  }
  return url.slice(0, -suffix.length);
}

/** An error the sync's retry logic can read: a refusal carries a 4xx `status`, rate limiting 429. */
export interface StoreError extends Error {
  readonly status?: number;
  /** Seconds to wait, when the store said so. */
  readonly retryAfter?: number;
}

/**
 * The SDK's errors are classes without a status. The ones that mean "this will not work until
 * something changes" (a bad or expired token, a wrong store, a refused content type or size) get
 * a 4xx so `withRetries` stops at once; rate limiting gets 429 and the store's own wait; anything
 * else (network, 5xx) is left as it is and retried, after the SDK's own retries.
 */
export function classifyBlobError(error: unknown): unknown {
  if (!(error instanceof BlobError)) return error;
  const withStatus = (status: number, retryAfter?: number): StoreError =>
    Object.assign(
      error,
      retryAfter === undefined ? { status } : { status, retryAfter },
    );
  if (error instanceof BlobServiceRateLimited) {
    return withStatus(429, error.retryAfter);
  }
  if (
    error instanceof BlobAccessError ||
    error instanceof BlobClientTokenExpiredError
  ) {
    return withStatus(403);
  }
  if (error instanceof BlobStoreNotFoundError) return withStatus(404);
  if (
    error instanceof BlobStoreSuspendedError ||
    error instanceof BlobContentTypeNotAllowedError ||
    error instanceof BlobFileTooLargeError ||
    error instanceof BlobPathnameMismatchError ||
    // The SDK has already retried an unknown error ten times; a decision, not weather.
    error instanceof BlobUnknownError
  ) {
    return withStatus(400);
  }
  return error;
}

/** A read-write token, or the OIDC pair `vercel env pull` writes (the token itself is sensitive). */
export type BlobAuth =
  | { readonly token: string }
  | { readonly oidcToken: string; readonly storeId: string };

export function vercelBlobStore(
  auth: BlobAuth,
  fetchImpl: typeof fetch = fetch,
): MediaStore {
  const credentials =
    "token" in auth
      ? { token: auth.token }
      : { oidcToken: auth.oidcToken, storeId: auth.storeId };
  const call = async <T>(work: () => Promise<T>): Promise<T> => {
    try {
      return await work();
    } catch (error) {
      throw classifyBlobError(error);
    }
  };
  return {
    list: (prefix) =>
      call(async () => {
        const out = new Map<string, StoredObject>();
        let cursor: string | undefined;
        do {
          const page = await list({
            ...credentials,
            prefix,
            limit: 1000,
            ...(cursor === undefined ? {} : { cursor }),
          });
          for (const blob of page.blobs) {
            out.set(blob.pathname, {
              key: blob.pathname,
              size: blob.size,
              url: blob.url,
            });
          }
          cursor = page.hasMore ? page.cursor : undefined;
        } while (cursor !== undefined);
        return out;
      }),
    put: (key, body, options) =>
      call(async () => {
        const result = await put(key, Buffer.from(body), {
          ...credentials,
          access: "public",
          addRandomSuffix: false,
          allowOverwrite: options.overwrite,
          contentType: options.contentType,
          cacheControlMaxAge: options.cacheMaxAge,
        });
        return { key: result.pathname, size: body.byteLength, url: result.url };
      }),
    delete: (key) =>
      call(async () => {
        await del(key, credentials);
      }),
    read: (key) =>
      call(async () => {
        let url: string;
        try {
          url = (await head(key, credentials)).url;
        } catch (error) {
          if (error instanceof BlobNotFoundError) return null;
          throw error;
        }
        // Through the CDN, so an edge copy inside its TTL is what comes back; the sync notes it.
        const response = await fetchImpl(url, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`${url} answered ${response.status}`);
        }
        return new Uint8Array(await response.arrayBuffer());
      }),
  };
}
