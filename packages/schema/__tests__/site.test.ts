import { describe, expect, it } from "vitest";
import {
  ABOUT_PAGE_URL,
  SITE_NAME,
  SITE_ORIGIN,
  SITE_PRODUCT,
  SITE_VERSION,
  userAgent,
} from "../site.js";

describe("the site's identity (ADR-036)", () => {
  it("names the about page on the production origin", () => {
    expect(SITE_ORIGIN).toBe("https://coppercork.com");
    expect(ABOUT_PAGE_URL).toBe("https://coppercork.com/about");
    expect(new URL(ABOUT_PAGE_URL).pathname).toBe("/about");
  });

  it("writes the name as a product token without spaces", () => {
    expect(SITE_NAME).toBe("Coppercork");
    expect(SITE_PRODUCT).toBe("Coppercork");
    expect(SITE_PRODUCT).toMatch(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/);
    expect(SITE_VERSION).toMatch(/^\d+\.\d+$/);
  });
});

describe("userAgent", () => {
  it("follows docs/legal/obligations.md: <site name>/<version> (+<about-page URL>; <contact email>)", () => {
    expect(userAgent("poll-news", "ventures@coppercork.com")).toBe(
      "Coppercork/1.0 (+https://coppercork.com/about; ventures@coppercork.com) poll-news",
    );
  });

  it("leaves the address out when none was given, and keeps the about page", () => {
    expect(userAgent("bootstrap", null)).toBe(
      "Coppercork/1.0 (+https://coppercork.com/about) bootstrap",
    );
  });

  it("no longer says the site is in development", () => {
    expect(userAgent("media", "x@example.com")).not.toMatch(/development/i);
    expect(userAgent("media", "x@example.com")).not.toContain("github.com");
  });

  it("refuses a tool name that is not a token", () => {
    expect(() => userAgent("poll news", null)).toThrow(/not an HTTP token/);
    expect(() => userAgent("", null)).toThrow(/not an HTTP token/);
    expect(() => userAgent('poll"news', null)).toThrow(/not an HTTP token/);
  });
});
