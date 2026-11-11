/**
 * A small S3 client for Cloudflare R2 (ADR-034): Signature Version 4 and the five calls the
 * publish script needs (list, put, delete, bucket CORS). Takes an injected `fetch`, so the unit
 * tests run it with nothing reaching the network (CLAUDE.md section 6). No SDK: the calls are few
 * and the signing is forty lines.
 */
import { createHash, createHmac } from "node:crypto";

export const sha256Hex = (data: string | Uint8Array): string =>
  createHash("sha256").update(data).digest("hex");

const hmac = (key: string | Buffer, data: string): Buffer =>
  createHmac("sha256", key).update(data).digest();

/** RFC 3986 encoding as SigV4 wants it: `encodeURIComponent` plus the five characters it leaves. */
export function encodeRfc3986(text: string): string {
  return encodeURIComponent(text).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export interface SignInput {
  readonly method: string;
  readonly url: URL;
  /** Headers to sign besides `host` and `x-amz-date`, which are added here. */
  readonly headers: Readonly<Record<string, string>>;
  /** Hex SHA-256 of the body (`sha256Hex("")` for none). */
  readonly payloadHash: string;
  readonly now: Date;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly region: string;
  readonly service: string;
}

/** `2015-08-30T12:36:00.000Z` → `20150830T123600Z`. */
export const amzDate = (now: Date): string =>
  now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");

/**
 * The request's headers with `Authorization`, `host` and `x-amz-date` added. Every header given
 * is signed. `host` is signed but must not be sent by hand: fetch sets it from the URL.
 */
export function signRequest(input: SignInput): Record<string, string> {
  const date = amzDate(input.now);
  const day = date.slice(0, 8);
  const headers: Record<string, string> = {
    host: input.url.host,
    "x-amz-date": date,
  };
  for (const [name, value] of Object.entries(input.headers)) {
    headers[name.toLowerCase()] = value;
  }
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names
    .map((n) => `${n}:${headers[n]!.trim().replace(/\s+/g, " ")}\n`)
    .join("");
  const signedHeaders = names.join(";");
  const canonicalUri =
    input.url.pathname
      .split("/")
      .map((segment) => encodeRfc3986(decodeURIComponent(segment)))
      .join("/") || "/";
  const canonicalQuery = [...input.url.searchParams.entries()]
    .map(([k, v]) => [encodeRfc3986(k), encodeRfc3986(v)] as const)
    .sort((a, b) =>
      a[0] < b[0]
        ? -1
        : a[0] > b[0]
          ? 1
          : a[1] < b[1]
            ? -1
            : a[1] > b[1]
              ? 1
              : 0,
    )
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const canonicalRequest = [
    input.method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    input.payloadHash,
  ].join("\n");
  const scope = `${day}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    date,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = hmac(
    hmac(
      hmac(hmac(`AWS4${input.secretAccessKey}`, day), input.region),
      input.service,
    ),
    "aws4_request",
  );
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign)
    .digest("hex");
  return {
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

export interface R2Credentials {
  readonly accountId: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly bucket: string;
}

export interface StoredObject {
  readonly key: string;
  readonly size: number;
  readonly etag: string;
}

const unescapeXml = (text: string): string =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

/** One page of a ListObjectsV2 answer: its objects and the token for the next page, if any. */
export function parseListing(xml: string): {
  objects: StoredObject[];
  next: string | null;
} {
  const objects: StoredObject[] = [];
  for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
    const entry = match[1]!;
    const key = /<Key>([\s\S]*?)<\/Key>/.exec(entry)?.[1];
    const size = /<Size>(\d+)<\/Size>/.exec(entry)?.[1];
    const etag = /<ETag>([\s\S]*?)<\/ETag>/.exec(entry)?.[1];
    if (key === undefined || size === undefined) continue;
    objects.push({
      key: unescapeXml(key),
      size: Number(size),
      etag: unescapeXml(etag ?? "").replace(/^"|"$/g, ""),
    });
  }
  const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
  const token =
    /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)?.[1];
  return {
    objects,
    next: truncated && token !== undefined ? unescapeXml(token) : null,
  };
}

/** The CORS rule the bucket needs: the holoviewer fetches models cross-origin (ADR-034). */
export const CORS_RULES = [
  {
    AllowedOrigins: ["*"],
    AllowedMethods: ["GET", "HEAD"],
    AllowedHeaders: ["*"],
    MaxAgeSeconds: 86400,
  },
] as const;

export const corsXml = (): string =>
  `<CORSConfiguration>${CORS_RULES.map(
    (rule) =>
      `<CORSRule>${rule.AllowedOrigins.map((o) => `<AllowedOrigin>${o}</AllowedOrigin>`).join("")}${rule.AllowedMethods.map((m) => `<AllowedMethod>${m}</AllowedMethod>`).join("")}${rule.AllowedHeaders.map((h) => `<AllowedHeader>${h}</AllowedHeader>`).join("")}<MaxAgeSeconds>${rule.MaxAgeSeconds}</MaxAgeSeconds></CORSRule>`,
  ).join("")}</CORSConfiguration>`;

export class R2Error extends Error {
  constructor(
    readonly status: number,
    readonly operation: string,
    body: string,
  ) {
    super(
      `${operation}: HTTP ${status}${body === "" ? "" : `: ${body.slice(0, 300)}`}`,
    );
    this.name = "R2Error";
  }
}

export class R2Client {
  private readonly endpoint: string;

  constructor(
    private readonly credentials: R2Credentials,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly clock: () => Date = () => new Date(),
  ) {
    this.endpoint = `https://${credentials.accountId}.r2.cloudflarestorage.com`;
  }

  /** The object's address on the S3 endpoint, each key segment encoded. */
  objectUrl(key: string): URL {
    const path = key.split("/").map(encodeRfc3986).join("/");
    return new URL(`${this.endpoint}/${this.credentials.bucket}/${path}`);
  }

  private async request(
    operation: string,
    method: string,
    url: URL,
    body: Uint8Array | string | null = null,
    headers: Readonly<Record<string, string>> = {},
  ): Promise<Response> {
    const payload: Uint8Array =
      body === null
        ? new Uint8Array()
        : typeof body === "string"
          ? new TextEncoder().encode(body)
          : body;
    const payloadHash = sha256Hex(payload);
    const signed = signRequest({
      method,
      url,
      headers: { ...headers, "x-amz-content-sha256": payloadHash },
      payloadHash,
      now: this.clock(),
      accessKeyId: this.credentials.accessKeyId,
      secretAccessKey: this.credentials.secretAccessKey,
      region: "auto",
      service: "s3",
    });
    // fetch sets Host itself from the URL; sending it by hand is refused.
    const { host: _host, ...outgoing } = signed;
    void _host;
    const response = await this.fetchImpl(url, {
      method,
      headers: outgoing,
      body: body === null ? null : payload,
    });
    if (!response.ok) {
      throw new R2Error(response.status, operation, await response.text());
    }
    return response;
  }

  /** Every object under `prefix`, by key, across however many pages the bucket answers. */
  async list(prefix: string): Promise<Map<string, StoredObject>> {
    const out = new Map<string, StoredObject>();
    let token: string | null = null;
    do {
      const url = new URL(`${this.endpoint}/${this.credentials.bucket}`);
      url.searchParams.set("list-type", "2");
      url.searchParams.set("prefix", prefix);
      url.searchParams.set("max-keys", "1000");
      if (token !== null) url.searchParams.set("continuation-token", token);
      const response = await this.request("ListObjectsV2", "GET", url);
      const page = parseListing(await response.text());
      for (const object of page.objects) out.set(object.key, object);
      token = page.next;
    } while (token !== null);
    return out;
  }

  async put(
    key: string,
    body: Uint8Array | string,
    headers: { readonly contentType: string; readonly cacheControl: string },
  ): Promise<void> {
    await this.request("PutObject", "PUT", this.objectUrl(key), body, {
      "content-type": headers.contentType,
      "cache-control": headers.cacheControl,
    });
  }

  async delete(key: string): Promise<void> {
    await this.request("DeleteObject", "DELETE", this.objectUrl(key));
  }

  /** Needs a token with bucket configuration rights (R2 "Admin Read & Write"); 403 otherwise. */
  async putCors(): Promise<void> {
    const url = new URL(`${this.endpoint}/${this.credentials.bucket}`);
    url.searchParams.set("cors", "");
    await this.request("PutBucketCors", "PUT", url, corsXml(), {
      "content-type": "application/xml",
    });
  }
}
