import type { Metadata } from "next";
import { Section } from "ui";
import { SITE_NAME } from "ui/brand";
import { Site } from "../../lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  alternates: { canonical: "/privacy" },
};

/** docs/legal/obligations.md, Privacy: short, present from Phase 0. */
export default function PrivacyPage() {
  return (
    <Site>
      <div className="flex max-w-prose flex-col gap-12 pt-8">
        <div className="flex flex-col gap-4">
          <h1 className="text-title text-primary">Privacy</h1>
          <p className="text-body text-secondary">
            {SITE_NAME} has no accounts and sets no cookies. There are no
            third-party trackers, no advertising and no sale of data.
          </p>
        </div>
        <Section id="browser" title="What stays in your browser">
          <p className="text-ui text-secondary">
            The search palette remembers the last few entities you opened in
            your browser's local storage so it can show them again. Nothing is
            sent anywhere; clearing site data removes it.
          </p>
        </Section>
        <Section id="videos" title="Videos">
          <p className="text-ui text-secondary">
            The videos on the front page and the news page are CIG's uploads on
            YouTube. Their thumbnails load from YouTube's image servers, which
            then see your IP address as with any image; no referrer is sent with
            them. The player loads from youtube-nocookie.com, YouTube's
            privacy-enhanced mode, only when you press a video, and is unloaded
            when you close it; while it plays, YouTube's own privacy policy
            applies. Every video also links to YouTube, if you would rather
            watch it there.
          </p>
        </Section>
        <Section id="later" title="Planned">
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-ui text-secondary">
            <li>
              Visit counts through self-hosted, cookieless analytics (Umami).
              Not active yet.
            </li>
            <li>
              Error reports (Sentry) with IP addresses and request bodies
              removed. Not active yet.
            </li>
          </ul>
          <p className="text-caption text-secondary">
            This page changes before either is switched on.
          </p>
        </Section>
      </div>
    </Site>
  );
}
