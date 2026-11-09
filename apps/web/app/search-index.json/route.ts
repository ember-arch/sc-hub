import { searchIndex } from "../../lib/search-index";

/** The palette's index as one static document, built with the site (ADR-022). */
export const dynamic = "force-static";

export function GET(): Response {
  return Response.json(searchIndex(), {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
