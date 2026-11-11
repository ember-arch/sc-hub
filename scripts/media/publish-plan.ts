/**
 * What `publish.ts` uploads and under which keys (ADR-034). Pure functions, so the unit tests run
 * them on a small manifest with no files and no network.
 *
 * Every file is content-addressed: `/media/ships/aegs_gladius-1280.webp` is published as
 * `media/ships/aegs_gladius-1280-<first twelve hex of its SHA-256>.webp`, and the manifest is
 * rewritten to name those keys before it is uploaded. A key's bytes therefore never change, so
 * the CDN and browsers may cache them for a year, a changed picture gets a new key rather than a
 * stale copy, and a run can skip everything the bucket already holds by key alone. The manifest is
 * the one mutable object and carries a short TTL.
 */
import { MediaManifest } from "schema";

export const MEDIA_PREFIX = "/media/";
export const MANIFEST_KEY = "media/manifest.json";
export const HASH_LENGTH = 12;

/** Renditions, models and videos: content-addressed, so cacheable for a year (in seconds). */
export const IMMUTABLE_MAX_AGE = 31536000;
/** The manifest: five minutes, so a publish reaches the next build soon and the CDN still helps. */
export const MANIFEST_MAX_AGE = 300;

/** By extension; a new kind of file is a decision, so an unknown one fails rather than guessing. */
export const CONTENT_TYPES: Readonly<Record<string, string>> = {
  webp: "image/webp",
  glb: "model/gltf-binary",
  mp4: "video/mp4",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
};

export function contentTypeOf(path: string): string {
  const extension = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase();
  const type = extension === undefined ? undefined : CONTENT_TYPES[extension];
  if (type === undefined) throw new Error(`no content type for ${path}`);
  return type;
}

/** `/media/holo/abc.glb` + hash → `/media/holo/abc-<hash12>.glb`; the separator keeps every schema regex happy. */
export function hashedPath(src: string, sha256: string): string {
  const match = /^(.*)\.([a-z0-9]+)$/i.exec(src);
  if (match === null) throw new Error(`no extension on ${src}`);
  if (!/^[0-9a-f]{64}$/.test(sha256))
    throw new Error(`not a SHA-256: ${sha256}`);
  return `${match[1]}-${sha256.slice(0, HASH_LENGTH)}.${match[2]}`;
}

/** Every `/media/...` string anywhere in `value`, in order of first appearance, once each. */
export function mediaPathsIn(value: unknown): string[] {
  const found = new Set<string>();
  const walk = (node: unknown): void => {
    if (typeof node === "string") {
      if (node.startsWith(MEDIA_PREFIX)) found.add(node);
    } else if (Array.isArray(node)) {
      node.forEach(walk);
    } else if (node !== null && typeof node === "object") {
      Object.values(node).forEach(walk);
    }
  };
  walk(value);
  return [...found];
}

/** `value` with every `/media/...` string replaced by `map(string)`; nothing else touched. */
export function rewriteMediaPaths<T>(
  value: T,
  map: (src: string) => string,
): T {
  if (typeof value === "string") {
    return (value.startsWith(MEDIA_PREFIX)
      ? map(value)
      : value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewriteMediaPaths(item, map)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = rewriteMediaPaths(item, map);
    }
    return out as T;
  }
  return value;
}

export interface LocalFile {
  /** As the manifest names it: `/media/...`. */
  readonly src: string;
  readonly sha256: string;
  readonly bytes: number;
}

export interface PlannedObject {
  /** The bucket key, without a leading slash. */
  readonly key: string;
  /** The local file it is the copy of. */
  readonly src: string;
  readonly bytes: number;
  /** Its content hash, which the key is built from; the upload checks the bytes against it. */
  readonly sha256: string;
  readonly contentType: string;
  /** Seconds for the CDN and browsers; the store composes the Cache-Control header. */
  readonly cacheMaxAge: number;
}

export interface PublishPlan {
  readonly objects: readonly PlannedObject[];
  /** The manifest as it goes to the bucket: every path content-addressed, valid against the schema. */
  readonly manifest: MediaManifest;
  /** Files under the media folder the manifest does not name; not uploaded. */
  readonly unreferenced: readonly string[];
}

/**
 * Plans a publish of `manifest` given the files on disk. Throws when the manifest names a file
 * that is not there: that is a broken local build, and uploading its manifest would publish
 * pictures that cannot load.
 */
export function planPublish(
  manifest: MediaManifest,
  files: readonly LocalFile[],
): PublishPlan {
  const byPath = new Map(files.map((f) => [f.src, f]));
  const referenced = mediaPathsIn(manifest);
  const missing = referenced.filter((src) => !byPath.has(src));
  if (missing.length > 0) {
    throw new Error(
      `the manifest names ${missing.length} file(s) not on disk: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ", ..." : ""}`,
    );
  }
  const published = new Map(
    referenced.map((src) => [src, hashedPath(src, byPath.get(src)!.sha256)]),
  );
  const rewritten = MediaManifest.parse(
    rewriteMediaPaths(manifest, (src) => published.get(src) ?? src),
  );
  const objects = referenced.map((src) => {
    const file = byPath.get(src)!;
    return {
      key: published.get(src)!.slice(1),
      src,
      bytes: file.bytes,
      sha256: file.sha256,
      contentType: contentTypeOf(src),
      cacheMaxAge: IMMUTABLE_MAX_AGE,
    };
  });
  const wanted = new Set(referenced);
  const unreferenced = files
    .map((f) => f.src)
    .filter((src) => !wanted.has(src) && src !== `/${MANIFEST_KEY}`);
  return { objects, manifest: rewritten, unreferenced };
}
