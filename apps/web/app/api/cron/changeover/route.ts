import { changeoverSkip } from "../../../../lib/events";
import { startNews } from "../../../../lib/news-dispatch";

/**
 * The change-over clock (ADR-057, amended 2026-11-15): Vercel's cron calls this a minute past each
 * hour (apps/web/vercel.json). When a show's day opened within the last quarter hour, RSI's
 * change-over (16:00 UTC for IAE 2956: 8:00 in the Pacific), it starts the News workflow at once,
 * like the news clock, so what RSI puts up then reaches the site minutes later rather than at the
 * next half hour; any other hour it starts nothing. The site's pages turn the day on their own.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request): Promise<Response> {
  return startNews(request, {
    job: "changeover-clock",
    skip: (now) => changeoverSkip(now),
    // The hour's YouTube feed stays with the :07 run (CLAUDE.md section 9).
    videoFeed: false,
  });
}
