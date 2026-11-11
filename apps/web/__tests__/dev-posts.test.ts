import { Author, ContentItem } from "schema";
import { describe, expect, it } from "vitest";
import {
  authorByHandle,
  authorOf,
  authorsWithPosts,
  devPosts,
  excerptOf,
  postsBy,
  renderBody,
  threadUrl,
} from "../lib/dev-posts";

// Rows in the shape the Spectrum worker writes (workers/poll-spectrum), not game data: two
// developers across two threads, one of them answering twice in the same thread.

const THREAD =
  "https://robertsspaceindustries.com/spectrum/community/SC/forum/65300/thread/changes-for-the-polaris";
const OTHER =
  "https://robertsspaceindustries.com/spectrum/community/SC/forum/3/thread/the-galaxy";

const authors = Author.array().parse([
  {
    id: "a0000000-0000-5000-8000-000000000001",
    handle: "Lujayn",
    display_name: "Lujayn",
    role: "Staff",
    first_seen: "2026-11-01T00:00:00.000Z",
    post_count: 2,
    takedown: false,
  },
  {
    id: "a0000000-0000-5000-8000-000000000002",
    handle: "Zyloh-CIG",
    display_name: "Zyloh",
    role: "Community Manager",
    first_seen: "2026-10-01T00:00:00.000Z",
    post_count: 1,
    takedown: false,
  },
]);

function item(
  n: number,
  fields: Partial<ContentItem> & Pick<ContentItem, "published_at">,
): ContentItem {
  return ContentItem.parse({
    id: `b0000000-0000-5000-8000-00000000000${n}`,
    source: "spectrum",
    external_id: String(n),
    url: `${THREAD}/${n}`,
    title: "Re: Changes for the Polaris",
    summary: "A paragraph.",
    body_html: "<p>A paragraph.</p>",
    fetched_at: "2026-11-10T00:00:00.000Z",
    revision: 1,
    author_id: authors[0]!.id,
    thread_id: "576489",
    thread_title: "Changes for the Polaris",
    forum: "Roberts Space Industries",
    takedown: false,
    ...fields,
  });
}

const news: ContentItem[] = [
  item(3, { published_at: "2026-11-09T18:00:00.000Z" }),
  item(2, {
    published_at: "2026-11-09T12:00:00.000Z",
    url: OTHER,
    title: "The Galaxy",
    thread_id: "576637",
    thread_title: "The Galaxy",
    author_id: authors[1]!.id,
  }),
  item(1, { published_at: "2026-11-09T09:00:00.000Z" }),
  ContentItem.parse({
    ...item(4, { published_at: "2026-11-09T20:00:00.000Z" }),
    source: "comm_link",
    url: "https://robertsspaceindustries.com/comm-link/transmission/1",
    author_id: null,
    thread_id: null,
    thread_title: null,
    forum: null,
  }),
];

describe("the dev tracker's reading", () => {
  it("keeps only Spectrum items", () => {
    expect(devPosts(news).map((p) => p.external_id)).toEqual(["3", "2", "1"]);
  });

  it("takes a reply's thread address without the post number and an opening post's as is", () => {
    expect(threadUrl(news[0]!)).toBe(THREAD);
    expect(threadUrl(news[1]!)).toBe(OTHER);
  });

  it("finds authors by id and by handle, case aside, and ranks them by posts shown", () => {
    const posts = devPosts(news);
    expect(authorOf(posts[0]!, authors)?.handle).toBe("Lujayn");
    expect(authorByHandle(authors, "zyloh-cig")?.display_name).toBe("Zyloh");
    expect(authorByHandle(authors, "nobody")).toBeUndefined();
    expect(authorsWithPosts(posts, authors).map((a) => a.handle)).toEqual([
      "Lujayn",
      "Zyloh-CIG",
    ]);
    expect(postsBy(posts, authors[1]!).map((p) => p.external_id)).toEqual([
      "2",
    ]);
  });
});

describe("renderBody", () => {
  const body =
    '<p>Hi everyone,</p>\n<img data-upload="3463136" width="1680" height="945" alt="">\n<p><strong>Mobile</strong></p>\n<img data-upload="3463137" alt="">';
  const picture = (id: string) =>
    id === "3463136"
      ? {
          src: "/media/spectrum/3463136-1280.webp",
          srcSet:
            "/media/spectrum/3463136-1280.webp 1280w, /media/spectrum/3463136-640.webp 640w",
          width: 1280,
          height: 720,
          alt: "",
          credit: {
            text: "Image: Cloud Imperium Games, via Spectrum",
            href: THREAD,
          },
        }
      : null;

  it("makes a plate of a picture on file, with its web copies and the credit linked to the post, and a captioned placeholder of one not yet copied", () => {
    const out = renderBody(body, picture, THREAD);
    expect(out).toContain("<p>Hi everyone,</p>");
    expect(out).toContain(
      `<figure class="dev-post-plate"><img src="/media/spectrum/3463136-1280.webp" srcset="/media/spectrum/3463136-1280.webp 1280w, /media/spectrum/3463136-640.webp 640w" sizes="(min-width: 1400px) 1320px, (min-width: 768px) calc(100vw - 5rem), calc(100vw - 4rem)" width="1280" height="720" alt="" loading="lazy" decoding="async"><figcaption><a href="${THREAD}" target="_blank" rel="noopener noreferrer" class="lab">Image: Cloud Imperium Games, via Spectrum</a></figcaption></figure>`,
    );
    expect(out).toContain(
      `<figure class="dev-post-plate dev-post-plate-pending"><figcaption><span>Picture on Spectrum, not yet copied here</span><a href="${THREAD}" target="_blank" rel="noopener noreferrer" class="lab">Image: Cloud Imperium Games, via Spectrum</a></figcaption></figure>`,
    );
    // Nothing points at Spectrum's own media host, and no bare img is left.
    expect(out).not.toMatch(/robertsspaceindustries\.com\/[^"]*\.(jpg|png)/);
    expect(out).not.toContain("data-upload");
  });

  it("makes a plate or a placeholder of an embedded picture's e- id too (ADR-037)", () => {
    const embedded =
      '<p>Vara</p>\n<img data-upload="e-tgcvmgrkzycyy" width="1119" height="600" alt="">';
    const found = renderBody(
      embedded,
      (id) =>
        id === "e-tgcvmgrkzycyy"
          ? {
              src: "/media/spectrum/e-tgcvmgrkzycyy-960.webp",
              srcSet: "/media/spectrum/e-tgcvmgrkzycyy-960.webp 960w",
              width: 1119,
              height: 600,
              alt: "",
              credit: { text: "Image", href: THREAD },
            }
          : null,
      THREAD,
    );
    expect(found).toContain('src="/media/spectrum/e-tgcvmgrkzycyy-960.webp"');
    expect(found).not.toContain("data-upload");
    const pending = renderBody(embedded, () => null, THREAD);
    expect(pending).toContain("dev-post-plate-pending");
    expect(pending).not.toContain("data-upload");
  });

  it("leaves a body without pictures as it is, and the excerpt still reads the stored body", () => {
    const plain = "<p>Just <em>words</em>.</p>";
    expect(renderBody(plain, picture, THREAD)).toBe(plain);
    expect(excerptOf(body)).toBe("Hi everyone, Mobile");
  });
});

describe("excerptOf", () => {
  it("gives the post's first lines as plain text, entities decoded, cut on a word", () => {
    expect(
      excerptOf("<p>Hey y&#39;all,</p><p>It&amp;s time &lt;again&gt;.</p>"),
    ).toBe("Hey y'all, It&s time <again>.");
    // An escaped entity in the post's own text stays text.
    expect(excerptOf("<p>say &amp;lt; here</p>")).toBe("say &lt; here");
    expect(excerptOf("")).toBeNull();
    expect(excerptOf("<p> </p>")).toBeNull();
    const long = `<p>${"word ".repeat(100)}</p>`;
    const cut = excerptOf(long)!;
    expect(cut.length).toBeLessThanOrEqual(281);
    expect(cut.endsWith("…")).toBe(true);
    expect(cut).not.toMatch(/ …$/);
  });
});
