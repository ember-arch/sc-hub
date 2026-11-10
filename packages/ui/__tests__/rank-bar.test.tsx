import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RankBar } from "../components/rank-bar";

// The marker positions are rounded to four decimals: the browser serialises a percentage to
// about six significant digits, so a longer server-rendered value would not match the client
// at hydration.
describe("RankBar", () => {
  const values = [
    { key: "a", value: 1944.5, current: true },
    { key: "b", value: 3 },
    { key: "c", value: 100 / 3 },
    { key: "d", value: 1234567 },
  ];

  it("places every marker with at most four decimals, the same on every render", () => {
    const once = renderToStaticMarkup(
      <RankBar label="Gun damage" values={values} scale="log" most="Hardest" />,
    );
    const twice = renderToStaticMarkup(
      <RankBar label="Gun damage" values={values} scale="log" most="Hardest" />,
    );
    expect(twice).toBe(once);
    const lefts = [...once.matchAll(/left:([0-9.]+)%/g)].map((m) => m[1]!);
    expect(lefts).toHaveLength(values.length);
    for (const left of lefts) {
      const decimals = left.split(".")[1] ?? "";
      expect(decimals.length).toBeLessThanOrEqual(4);
    }
  });
});
