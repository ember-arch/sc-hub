import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PatchStrip } from "../components/patch-strip";

// ADR-046: LIVE always, with its empty state; PTU only when a PTU build is recorded.
describe("PatchStrip", () => {
  it("shows LIVE's empty state and no PTU slot when nothing is recorded", () => {
    const html = renderToStaticMarkup(<PatchStrip versions={[]} />);
    expect(html).toContain("LIVE");
    expect(html).toContain("no build recorded");
    expect(html).not.toContain("PTU");
  });

  it("shows PTU with its build once one is recorded", () => {
    const html = renderToStaticMarkup(
      <PatchStrip
        versions={[
          { channel: "LIVE", version: "4.10.2-LIVE.1" },
          { channel: "PTU", version: "4.10.3-PTU.2" },
        ]}
      />,
    );
    expect(html).toContain("4.10.2-LIVE.1");
    expect(html).toContain("PTU");
    expect(html).toContain("4.10.3-PTU.2");
    expect(html).not.toContain("no build recorded");
  });

  // ADR-049, amended: a version CIG released ahead of the figures on record.
  it("names a release ahead of the figures beside the build they are from", () => {
    const html = renderToStaticMarkup(
      <PatchStrip
        versions={[
          {
            channel: "LIVE",
            version: "4.10.2-LIVE.12881860",
            released: "4.10.3",
          },
        ]}
      />,
    );
    expect(html.indexOf("4.10.3")).toBeLessThan(
      html.indexOf("4.10.2-LIVE.12881860"),
    );
    expect(html).toContain("figures from");
    // The separator is not read aloud.
    expect(html).toContain('<span aria-hidden="true">·</span>');
  });
});
