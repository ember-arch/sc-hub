import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ICON_NAMES, Icon } from "../components/icon";

// ADR-044: one line set, in the text's colour, hidden beside its label, no colour of its own.

describe("Icon", () => {
  it("draws every glyph as strokes in the text's colour, hidden from assistive tech", () => {
    for (const name of ICON_NAMES) {
      const svg = renderToStaticMarkup(<Icon name={name} />);
      expect(svg, name).toContain('aria-hidden="true"');
      expect(svg, name).toContain('stroke="currentColor"');
      expect(svg, name).toContain('fill="none"');
      expect(svg, name).toMatch(/<path d="M/);
      // No colour, gradient, filter or text of its own (CLAUDE.md section 2).
      expect(svg, name).not.toMatch(
        /#[0-9a-f]{3,8}|rgb|gradient|filter|<text/i,
      );
    }
  });

  it("comes at the two sizes the spacing scale allows", () => {
    expect(renderToStaticMarkup(<Icon name="shield" />)).toContain(
      'width="16"',
    );
    expect(renderToStaticMarkup(<Icon name="shield" size={24} />)).toContain(
      'width="24"',
    );
  });
});
