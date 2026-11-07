import { describe, expect, it } from "vitest";
import { Slug, Timestamp, Uuid } from "../common.js";
import { ContentItem } from "../entities/content-item.js";
import {
  ENTITY_LINK_DISPLAY_THRESHOLD,
  EntityLink,
  isEntityLinkVisible,
} from "../entities/entity-link.js";
import { Model } from "../entities/model.js";
import { loadFixture } from "./helpers.js";

// The entity round-trip tests prove the shapes; these prove the constraints on top of them,
// so that loosening a bound by accident fails the suite.

describe("Slug", () => {
  it.each(["aegs-gladius", "f7c-mk2", "a"])("accepts %s", (value) => {
    expect(Slug.safeParse(value).success).toBe(true);
  });
  it.each(["Not-A-Slug", "a--b", "-a", "a-", "a b", "a_b", ""])(
    "rejects %j",
    (value) => {
      expect(Slug.safeParse(value).success).toBe(false);
    },
  );
});

describe("Timestamp", () => {
  it.each([
    "2026-01-01T00:00:00Z",
    "2026-01-01T00:00:00.000Z",
    "2026-01-01T12:00:00+02:00",
  ])("accepts %s", (value) => {
    expect(Timestamp.safeParse(value).success).toBe(true);
  });
  it.each(["2026-01-01", "2026-01-01T00:00:00", "yesterday", "1700000000"])(
    "rejects %s",
    (value) => {
      expect(Timestamp.safeParse(value).success).toBe(false);
    },
  );
});

describe("Uuid", () => {
  it("accepts a v4 uuid", () => {
    expect(Uuid.safeParse("9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f").success).toBe(
      true,
    );
  });
  it.each(["123", "not-a-uuid", "9c1d2e3f4a5b4c6d8e7f0a1b2c3d4e5f"])(
    "rejects %s",
    (value) => {
      expect(Uuid.safeParse(value).success).toBe(false);
    },
  );
});

describe("ContentItem", () => {
  const fixture = loadFixture("ContentItem");

  it.each([
    "https://robertsspaceindustries.com/comm-link/1",
    "http://example.test/a",
  ])("accepts the source url %s", (url) => {
    expect(ContentItem.safeParse({ ...fixture, url }).success).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "ftp://example.test/a",
    "localhost:3000/a",
    "/relative",
  ])("rejects a displayed url that is not http(s): %s", (url) => {
    expect(ContentItem.safeParse({ ...fixture, url }).success).toBe(false);
  });

  it("starts revisions at 1", () => {
    expect(ContentItem.safeParse({ ...fixture, revision: 1 }).success).toBe(
      true,
    );
    expect(ContentItem.safeParse({ ...fixture, revision: 0 }).success).toBe(
      false,
    );
    expect(ContentItem.safeParse({ ...fixture, revision: 1.5 }).success).toBe(
      false,
    );
  });
});

describe("EntityLink", () => {
  const fixture = loadFixture("EntityLink");

  it.each([0, 0.5, 0.9, 1])("accepts confidence %d", (confidence) => {
    expect(EntityLink.safeParse({ ...fixture, confidence }).success).toBe(true);
  });
  it.each([-0.1, 1.5, 2])("rejects confidence %d", (confidence) => {
    expect(EntityLink.safeParse({ ...fixture, confidence }).success).toBe(
      false,
    );
  });
  it("rejects negative or fractional character positions", () => {
    expect(EntityLink.safeParse({ ...fixture, char_start: -1 }).success).toBe(
      false,
    );
    expect(EntityLink.safeParse({ ...fixture, char_end: 2.5 }).success).toBe(
      false,
    );
  });

  it("displays at the data-model threshold or when confirmed", () => {
    expect(ENTITY_LINK_DISPLAY_THRESHOLD).toBe(0.9);
    expect(isEntityLinkVisible({ confidence: 0.9, confirmed: false })).toBe(
      true,
    );
    expect(isEntityLinkVisible({ confidence: 0.95, confirmed: false })).toBe(
      true,
    );
    expect(isEntityLinkVisible({ confidence: 0.89, confirmed: false })).toBe(
      false,
    );
    expect(isEntityLinkVisible({ confidence: 0.6, confirmed: false })).toBe(
      false,
    );
    expect(isEntityLinkVisible({ confidence: 0.5, confirmed: true })).toBe(
      true,
    );
  });
});

describe("Model", () => {
  const fixture = loadFixture("Model");

  it.each(["bytes", "triangles", "texture_count"])(
    "rejects a negative or fractional %s",
    (key) => {
      expect(Model.safeParse({ ...fixture, [key]: -1 }).success).toBe(false);
      expect(Model.safeParse({ ...fixture, [key]: 1.5 }).success).toBe(false);
      expect(Model.safeParse({ ...fixture, [key]: 0 }).success).toBe(true);
    },
  );
});
