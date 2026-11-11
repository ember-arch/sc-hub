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
  BlobPreconditionFailedError,
  BlobServiceRateLimited,
  BlobStoreNotFoundError,
  BlobStoreSuspendedError,
  BlobUnknownError,
  del,
  get,
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
  /**
   * Write only if the object's current ETag is this one (ADR-048): the manifest's read-modify-write
   * fails with a 412 instead of overwriting a manifest another writer put up since it was read.
   */
  readonly ifMatch?: string;
}

/** An object's bytes as the store holds them now, with the ETag a conditional write names. */
export interface CurrentObject {
  readonly bytes: Uint8Array;
  readonly etag: string;
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
  /**
   * The bytes at `key` from the store itself, never an edge copy, with their ETag; null when
   * there is none (ADR-048).
   */
  read(key: string): Promise<CurrentObject | null>;
}

/** `https://x.public.blob.vercel-storage.com/media/a.webp` + `media/a.webp` → the store's base. */
export function storeBaseUrl(url: string, key: string): string {
  const suffix = `/${key}`;
  if (!url.endsWith(suffix)) {
    throw new Error(`${url} does not end with ${suffix}`);
  }
  return url.slice(0, -suffix.length);
}

/** An error the sync's retry logic can read: a refusal carries a 4xx `status`, rate limiting 429; a lost conditional write 412. */
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
  // Another writer changed the object since it was read (ADR-048): read again, never retry blind.
  if (error instanceof BlobPreconditionFailedError) return withStatus(412);
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
  // A plain BlobError is the store's own "bad request" (an existing blob, a refused OIDC
  // environment): repeating it changes nothing.
  if (Object.getPrototypeOf(error) === BlobError.prototype)
    return withStatus(400);
  return error;
}

/** Two ETags for the same bytes: equal once a weak marker (`W/`, added by compression) is set aside. */
export const sameEtag = (a: string, b: string): boolean =>
  a.replace(/^W\//, "") === b.replace(/^W\//, "");

/** The store's answer when a key is already taken and overwriting was not asked for. */
export const isAlreadyThere = (error: unknown): boolean =>
  error instanceof BlobError && /already exists/i.test(error.message);

/** A read-write token, or the OIDC pair `vercel env pull` writes (the token itself is sensitive). */
export type BlobAuth =
  | { readonly token: string }
  | { readonly oidcToken: string; readonly storeId: string };

export function vercelBlobStore(auth: BlobAuth): MediaStore {
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
        try {
          const result = await put(key, Buffer.from(body), {
            ...credentials,
            access: "public",
            addRandomSuffix: false,
            allowOverwrite: options.overwrite || options.ifMatch !== undefined,
            contentType: options.contentType,
            cacheControlMaxAge: options.cacheMaxAge,
            ...(options.ifMatch === undefined
              ? {}
              : { ifMatch: options.ifMatch }),
          });
          return {
            key: result.pathname,
            size: body.byteLength,
            url: result.url,
          };
        } catch (error) {
          // A key is its content: an object already there with these bytes' size is this upload,
          // landed by an earlier attempt the SDK or a previous run did not hear back from.
          if (!isAlreadyThere(error)) throw error;
          const held = await head(key, credentials);
          if (held.size !== body.byteLength) throw error;
          return { key: held.pathname, size: held.size, url: held.url };
        }
      }),
    delete: (key) =>
      call(async () => {
        await del(key, credentials);
      }),
    read: (key) =>
      call(async () => {
        // The manifest's read-modify-write (ADR-048) needs the bytes and the ETag a conditional
        // write is checked against. `head` gives the store's own, strong ETag; `get` with
        // useCache: false gives the bytes from the store, not an edge copy, with the ETag of
        // its HTTP answer, which compression weakens (`W/"..."`). The bytes are the head's only
        // when the two agree; when they do not, a write landed in between, so read again.
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          let etag: string;
          let result: Awaited<ReturnType<typeof get>>;
          try {
            etag = (await head(key, credentials)).etag;
            result = await get(key, {
              ...credentials,
              access: "public",
              useCache: false,
            });
          } catch (error) {
            if (error instanceof BlobNotFoundError) return null;
            throw error;
          }
          if (result === null) return null;
          if (result.statusCode !== 200) {
            throw new Error(`${key}: the store answered ${result.statusCode}`);
          }
          const bytes = new Uint8Array(
            await new Response(result.stream).arrayBuffer(),
          );
          if (sameEtag(etag, result.blob.etag)) return { bytes, etag };
        }
        throw new Error(`${key} kept changing while it was read`);
      }),
  };
}
