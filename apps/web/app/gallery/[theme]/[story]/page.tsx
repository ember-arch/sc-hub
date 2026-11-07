import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "ui";
import { stories } from "ui/stories";
import { repo } from "../../../../lib/data";
import { storySample } from "../../../../lib/gallery";

const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];

interface Params {
  readonly params: Promise<{ theme: string; story: string }>;
}

export function generateStaticParams() {
  return THEMES.flatMap((theme) =>
    stories.map((story) => ({ theme, story: story.id })),
  );
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { story } = await params;
  const found = stories.find((s) => s.id === story);
  return {
    title: found === undefined ? "Story not found" : `${found.title} story`,
    robots: { index: false, follow: false },
  };
}

export default async function StoryPage({ params }: Params) {
  const { theme, story } = await params;
  const found = stories.find((s) => s.id === story);
  if (found === undefined || !THEMES.includes(theme as Theme)) notFound();
  const sample = storySample();
  const r = repo();
  const shell = found.id === "page-shell";
  return (
    <div data-theme={theme} className="min-h-dvh bg-page text-primary">
      <div
        data-story={found.id}
        data-width={found.width}
        className={shell ? "" : "p-4"}
      >
        {found.render(sample)}
      </div>
      {shell ? null : <Footer versions={r.versions} wikiCredit />}
    </div>
  );
}
