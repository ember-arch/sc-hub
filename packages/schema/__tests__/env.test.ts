import { describe, expect, it } from "vitest";
import { EnvError, envSchema, loadEnv, requiredFor, roles } from "../env.js";

// Fake values for the test only. None of these are real credentials or hosts.
const full: Record<string, string> = {
  DATABASE_URL: "postgres://user:password@db.example.test:5432/app",
  MEILI_HOST: "http://search.example.test:7700",
  MEILI_MASTER_KEY: "master-key-for-tests",
  MEILI_SEARCH_KEY: "search-key-for-tests",
  R2_ACCOUNT_ID: "account-id-for-tests",
  R2_ACCESS_KEY_ID: "access-key-for-tests",
  R2_SECRET_ACCESS_KEY: "secret-for-tests",
  R2_BUCKET: "bucket-for-tests",
  CDN_BASE_URL: "https://cdn.example.test",
  SPECTRUM_MODE: "off",
  SPECTRUM_FEED_URL: "https://feed.example.test/staff.json",
  SPECTRUM_SESSION_COOKIE: "cookie-for-tests",
  SENTRY_DSN: "https://key@sentry.example.test/1",
  SC_INSTALL_ROOT: "C:\\Games\\StarCitizen",
  STARBREAKER_BIN: "C:\\Tools\\starbreaker.exe",
};

function without(keys: string[]): Record<string, string> {
  const copy = { ...full };
  for (const key of keys) delete copy[key];
  return copy;
}

describe("envSchema", () => {
  it("covers every variable named in CLAUDE.md section 9", () => {
    const declared = Object.keys(envSchema.shape).sort();
    expect(declared).toEqual(Object.keys(full).sort());
  });

  it("defaults SPECTRUM_MODE to off", () => {
    expect(envSchema.parse({}).SPECTRUM_MODE).toBe("off");
  });

  it("rejects an unknown SPECTRUM_MODE", () => {
    expect(envSchema.safeParse({ SPECTRUM_MODE: "maybe" }).success).toBe(false);
  });

  it("rejects a malformed URL", () => {
    expect(envSchema.safeParse({ MEILI_HOST: "not a url" }).success).toBe(
      false,
    );
  });
});

describe.each(roles)("loadEnv(%s)", (role) => {
  it("loads from a complete source", () => {
    const env = loadEnv(role, full);
    expect(env.DATABASE_URL).toBe(full["DATABASE_URL"]);
  });

  it("fails naming every missing required variable", () => {
    const required = [...requiredFor[role]];
    expect(() => loadEnv(role, without(required))).toThrow(EnvError);
    try {
      loadEnv(role, without(required));
    } catch (error) {
      expect(error).toBeInstanceOf(EnvError);
      expect([...(error as EnvError).missing].sort()).toEqual(
        [...required].sort(),
      );
    }
  });

  it("treats an empty string as unset", () => {
    const first = requiredFor[role][0] as string;
    expect(() => loadEnv(role, { ...full, [first]: "" })).toThrow(first);
  });

  it("reads only the source it is given, never the ambient environment", () => {
    expect(() => loadEnv(role, {})).toThrow(EnvError);
  });
});

describe("role-specific rules", () => {
  it("web does not need the Windows-only or R2 variables", () => {
    const env = loadEnv(
      "web",
      without([
        "SC_INSTALL_ROOT",
        "STARBREAKER_BIN",
        "R2_ACCOUNT_ID",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "R2_BUCKET",
        "CDN_BASE_URL",
        "MEILI_MASTER_KEY",
      ]),
    );
    expect(env.SC_INSTALL_ROOT).toBeUndefined();
  });

  it("pipeline needs SC_INSTALL_ROOT and STARBREAKER_BIN", () => {
    expect(() => loadEnv("pipeline", without(["SC_INSTALL_ROOT"]))).toThrow(
      "SC_INSTALL_ROOT",
    );
    expect(() => loadEnv("pipeline", without(["STARBREAKER_BIN"]))).toThrow(
      "STARBREAKER_BIN",
    );
  });

  it("worker in feed mode needs SPECTRUM_FEED_URL", () => {
    const source = { ...without(["SPECTRUM_FEED_URL"]), SPECTRUM_MODE: "feed" };
    expect(() => loadEnv("worker", source)).toThrow("SPECTRUM_FEED_URL");
  });

  it("worker in poll mode needs SPECTRUM_SESSION_COOKIE", () => {
    const source = {
      ...without(["SPECTRUM_SESSION_COOKIE"]),
      SPECTRUM_MODE: "poll",
    };
    expect(() => loadEnv("worker", source)).toThrow("SPECTRUM_SESSION_COOKIE");
  });

  it("worker in off mode needs neither", () => {
    const source = without(["SPECTRUM_FEED_URL", "SPECTRUM_SESSION_COOKIE"]);
    expect(loadEnv("worker", source).SPECTRUM_MODE).toBe("off");
  });

  it("drops variables that are not part of the contract", () => {
    const env = loadEnv("web", { ...full, PATH: "/usr/bin" }) as Record<
      string,
      unknown
    >;
    expect(env["PATH"]).toBeUndefined();
  });
});
