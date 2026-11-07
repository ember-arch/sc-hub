import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDb } from "../src/client.js";
import { HOOK_TIMEOUT, rawRows } from "./helpers.js";

describe("createDb", () => {
  it(
    "opens an in-memory PGlite database by default and closes it",
    async () => {
      const handle = await createDb();
      expect(handle.driver).toBe("pglite");
      const rows = await rawRows<{ one: number }>(handle, sql`select 1 as one`);
      expect(rows).toEqual([{ one: 1 }]);
      await expect(handle.close()).resolves.toBeUndefined();
    },
    HOOK_TIMEOUT,
  );

  it(
    "treats an empty url as unset",
    async () => {
      const handle = await createDb({ url: "" });
      expect(handle.driver).toBe("pglite");
      await handle.close();
    },
    HOOK_TIMEOUT,
  );
});
