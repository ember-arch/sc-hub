import { startNews } from "../../../../lib/news-dispatch";

/**
 * The news clock (ADR-053): Vercel's cron calls this at seven and thirty-seven past the hour
 * (apps/web/vercel.json), and it starts the News workflow unless a dispatched run is queued or
 * under way (`startNews`, which holds the rules the clocks share).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request): Promise<Response> {
  return startNews(request, { job: "news-clock" });
}
