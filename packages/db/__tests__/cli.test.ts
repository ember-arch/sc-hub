import { describe, expect, it } from "vitest";
import {
  DEFAULT_PACK_DIR,
  DEFAULT_PGLITE_DIR,
  readDatabaseUrl,
} from "../src/cli/common.js";

describe("readDatabaseUrl", () => {
  it("returns undefined when the variable is unset or empty", () => {
    expect(readDatabaseUrl({})).toBeUndefined();
    expect(readDatabaseUrl({ DATABASE_URL: "" })).toBeUndefined();
  });

  it("returns the connection string when set", () => {
    expect(readDatabaseUrl({ DATABASE_URL: "postgres://u:p@h:5432/db" })).toBe(
      "postgres://u:p@h:5432/db",
    );
  });
});

describe("default locations", () => {
  const posix = (path: string): string => path.replace(/\\/g, "/");

  it("keep the embedded database inside packages/db and read the bootstrap pack", () => {
    expect(posix(DEFAULT_PGLITE_DIR)).toMatch(/\/packages\/db\/\.pglite\/$/);
    expect(posix(DEFAULT_PACK_DIR)).toMatch(/\/fixtures\/bootstrap\/$/);
  });
});
