// An in-memory media store for the publish tests (ADR-034, ADR-048): keys, sizes, ETags that
// change on every write, and conditional writes that fail with a 412 like the real store's.
import type { MediaStore, PutOptions, StoredObject } from "../media/blob.js";

export interface FakeStoreOptions {
  /** Runs at the start of every put, before the store checks anything: a rival writer's moment. */
  readonly beforePut?: (key: string, store: FakeStore) => void;
  /**
   * The write lands but its answer is lost, and the SDK's repeat is refused with a 412: the
   * store holds the new bytes, the caller sees a lost race.
   */
  readonly landThenRefuse?: (key: string) => boolean;
}

export interface FakeStore {
  readonly store: MediaStore;
  readonly objects: Map<string, Uint8Array>;
  readonly puts: ({ key: string } & PutOptions)[];
  readonly deletes: string[];
  readonly base: string;
  /** Writes as another writer would, outside the store's interface; the ETag changes. */
  set(key: string, body: Uint8Array): void;
}

export function fakeStore(
  initial: readonly { key: string; body: Uint8Array }[] = [],
  options: FakeStoreOptions = {},
): FakeStore {
  const base = "https://store.public.blob.vercel-storage.com";
  const objects = new Map<string, Uint8Array>();
  const etags = new Map<string, string>();
  let version = 0;
  const set = (key: string, body: Uint8Array): void => {
    objects.set(key, body);
    version += 1;
    etags.set(key, `"v${version}"`);
  };
  for (const o of initial) set(o.key, o.body);
  const puts: ({ key: string } & PutOptions)[] = [];
  const deletes: string[] = [];
  const stored = (key: string): StoredObject => ({
    key,
    size: objects.get(key)!.byteLength,
    url: `${base}/${key}`,
  });
  const fake: FakeStore = {
    store: {
      async list(prefix) {
        return new Map(
          [...objects.keys()]
            .filter((k) => k.startsWith(prefix))
            .map((k) => [k, stored(k)]),
        );
      },
      async put(key, body, putOptions) {
        options.beforePut?.(key, fake);
        if (
          putOptions.ifMatch !== undefined &&
          etags.get(key) !== putOptions.ifMatch
        ) {
          throw Object.assign(new Error("precondition failed"), {
            status: 412,
          });
        }
        if (
          objects.has(key) &&
          !putOptions.overwrite &&
          putOptions.ifMatch === undefined
        ) {
          throw Object.assign(new Error("exists"), { status: 409 });
        }
        set(key, body);
        puts.push({ key, ...putOptions });
        if (options.landThenRefuse?.(key) === true) {
          throw Object.assign(new Error("precondition failed"), {
            status: 412,
          });
        }
        return stored(key);
      },
      async delete(key) {
        objects.delete(key);
        etags.delete(key);
        deletes.push(key);
      },
      async read(key) {
        const bytes = objects.get(key);
        return bytes === undefined ? null : { bytes, etag: etags.get(key)! };
      },
    },
    objects,
    puts,
    deletes,
    base,
    set,
  };
  return fake;
}
