import type { Metadata } from "next";
import { TextLink } from "ui";
import { stories } from "ui/stories";
import { Site } from "../../lib/site";

export const metadata: Metadata = {
  title: "Component gallery",
  robots: { index: false, follow: false },
};

/** Development gallery: one page per story and scheme, screenshotted by Playwright (ADR-005). */
export default function GalleryPage() {
  return (
    <Site>
      <div className="flex max-w-prose flex-col gap-6 pt-8">
        <h1 className="text-title text-primary">Component gallery</h1>
        <p className="text-body text-secondary">
          Every Phase 0 component rendered from fixture rows, in both schemes.
          Not linked from the site; used for screenshots.
        </p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-ui">
          {stories.map((story) => (
            <li key={story.id} className="flex items-baseline gap-4">
              <span className="text-primary">{story.title}</span>
              <TextLink href={`/gallery/light/${story.id}`}>light</TextLink>
              <TextLink href={`/gallery/dark/${story.id}`}>dark</TextLink>
            </li>
          ))}
        </ul>
      </div>
    </Site>
  );
}
