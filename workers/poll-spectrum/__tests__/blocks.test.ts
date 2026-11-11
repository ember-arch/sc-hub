import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ALLOWED_TAGS,
  UnknownBlockError,
  htmlFromBlocks,
  htmlFromDraft,
  withinAllowlist,
} from "../src/blocks.js";
import { postsInAnswer } from "../src/threads.js";

// ADR-037: a post's own blocks, from Spectrum's nested-thread answer, as HTML within the allowlist.
// Both samples are real answers of 2026-11-10, cut (fixtures/spectrum/README.md); no network here.

const samples = "../../../fixtures/spectrum/samples/";
const read = (name: string) =>
  JSON.parse(
    readFileSync(new URL(`${samples}${name}`, import.meta.url), "utf8"),
  ) as unknown;
const redesign = postsInAnswer(read("thread-nested.sample.json"));
const ironclad = postsInAnswer(read("thread-nested-target.sample.json"));

const html = (posts: typeof redesign, id: string) => {
  const post = posts.get(id);
  if (post === undefined || post.blocks === null) throw new Error(id);
  return htmlFromBlocks(post.blocks);
};

/** A Draft.js raw text block as Spectrum sends one. */
function draft(
  blocks: readonly {
    text: string;
    type?: string;
    depth?: number;
    inlineStyleRanges?: readonly {
      offset: number;
      length: number;
      style: string;
    }[];
    entityRanges?: readonly { offset: number; length: number; key: number }[];
  }[],
  entityMap: readonly { type: string; data: unknown }[] = [],
) {
  return {
    id: 1,
    type: "text",
    data: {
      blocks: blocks.map((b, i) => ({
        key: `k${i}`,
        type: "unstyled",
        depth: 0,
        inlineStyleRanges: [],
        entityRanges: [],
        data: [],
        ...b,
      })),
      entityMap: entityMap.map((e) => ({ mutability: "IMMUTABLE", ...e })),
    },
  };
}

describe("the thread answer's posts", () => {
  it("lists the opening post first, then every reply in depth-first order, erased ones marked", () => {
    expect([...redesign.keys()].slice(0, 4)).toEqual([
      "564187",
      "9044758",
      "9044809",
      "9044820",
    ]);
    expect(redesign.size).toBe(15);
    // An erased reply keeps its place in the tree with no content.
    const erased = redesign.get("9044764")!;
    expect(erased.erased).toBe(true);
    expect(erased.blocks).toEqual([]);
    // A staff reply deep in the tree, four levels down.
    expect(ironclad.get("8861609")?.blocks).not.toBeNull();
  });
});

describe("htmlFromBlocks on the real posts", () => {
  it("keeps every post within the allowlist", () => {
    for (const posts of [redesign, ironclad]) {
      for (const post of posts.values()) {
        if (post.blocks === null) continue;
        const { html: out } = htmlFromBlocks(post.blocks);
        expect(withinAllowlist(out), out.slice(0, 200)).toBe(true);
      }
    }
  });

  it("renders the announcement's paragraphs, headings as bold paragraphs, and its three pictures by upload id with no source", () => {
    const op = html(redesign, "564187");
    expect(op.first_paragraph).toBe("Hi everyone,");
    expect(op.html).toMatch(/^<p>Hi everyone,<\/p><p>The first phase/);
    expect(op.html).toContain(
      "<p><strong>What&#39;s New in Phase 1</strong></p>",
    );
    expect(op.html).toContain(
      '<img data-upload="3463136" width="1680" height="945" alt="">',
    );
    expect(op.html).not.toMatch(/src=/);
    expect(op.uploads).toEqual([
      {
        id: "3463136",
        url: "https://theverse.robertsspaceindustries.com/6jyg90p60itm0/source.jpg",
        width: 1680,
        height: 945,
      },
      expect.objectContaining({ id: "3463137" }),
      expect.objectContaining({ id: "3463138" }),
    ]);
    // Spectrum's blank spacer blocks make no paragraph.
    expect(op.html).not.toContain("<p></p>");
  });

  it("applies a bold range inside a paragraph and keeps underline and code as text", () => {
    expect(html(redesign, "9044758").html).toContain(
      "Please add the ability to <strong>navigate to parent comment</strong> when",
    );
    // "Messages & notifications:" is bold and underlined on Spectrum; underline has no tag here.
    expect(html(redesign, "9048700").html).toContain(
      "<p><strong>Messages &amp; notifications:</strong></p>",
    );
    expect(html(redesign, "9048700").html).not.toContain("<u>");
  });

  it("makes a link of a LINK entity, with rel noopener, and leaves a mention and an emoji shortcode as text", () => {
    const post = html(redesign, "9044798").html;
    expect(post).toContain(
      '<a href="https://robertsspaceindustries.com/spectrum/community/SC/forum/5/thread/some-spectrum-qol-items/4971184" target="_blank" rel="noopener noreferrer">https://robertsspaceindustries.com/spectrum/community/SC/forum/5/thread/some-spectrum-qol-items/4971184</a>',
    );
    expect(post).toContain("<p>and Discord&#39;s @time command.</p>");
    expect(html(redesign, "9048532").html).toContain(
      "<p>Hello @500servererror-CIG,</p>",
    );
    expect(html(redesign, "9044820").html).toContain(":wink:</p>");
  });

  it("groups list items into a list and drops a blank item", () => {
    const post = html(redesign, "9045254").html;
    expect(post).toMatch(/^<p>Feedback:<\/p><ul><li>Remove the bottom left/);
    expect(post).not.toContain("<li></li>");
    expect(post.match(/<li>/g)).toHaveLength(2);
    expect(post.endsWith("</li></ul>")).toBe(true);
  });

  it("renders a quote block as a blockquote with the quoted member's name and content, lists included", () => {
    const reply = html(ironclad, "8857142");
    expect(reply.html).toMatch(
      /^<blockquote><p><strong>Montic-CIG<\/strong><\/p><p>Ciao!<\/p><p>The expected damage behaviour/,
    );
    expect(reply.html).toContain(
      "<ul><li><strong>Armour</strong>: The Command Module inherits",
    );
    expect(reply.html).toContain("</blockquote>\n<p>Everyone, please funnel");
    // The quote is not the post's own first line; the paragraph after it is.
    expect(reply.first_paragraph).toMatch(
      /^Everyone, please funnel any contributions about damage/,
    );
  });

  it("gives a code block's lines as paragraphs", () => {
    const post = html(redesign, "9044772").html;
    expect(post).toMatch(/^<p>Before we finalize/);
    expect(post).not.toContain("<pre>");
  });
});

describe("htmlFromDraft on made-up blocks", () => {
  it("cuts ranges on Unicode code points, as Draft.js writes them, not UTF-16 units", () => {
    // The emoji is one code point and two UTF-16 units; Draft.js counts it as one.
    const { html: out } = htmlFromDraft(
      draft([
        {
          text: "😀 bold here",
          inlineStyleRanges: [{ offset: 2, length: 4, style: "BOLD" }],
        },
      ]).data,
    );
    expect(out).toBe("<p>😀 <strong>bold</strong> here</p>");
  });

  it("nests italic inside bold, shares one anchor across a link with a bold word, and keeps an unknown style as text", () => {
    const { html: out } = htmlFromDraft(
      draft(
        [
          {
            text: "see the notes now",
            inlineStyleRanges: [
              { offset: 4, length: 9, style: "BOLD" },
              { offset: 8, length: 5, style: "ITALIC" },
              { offset: 0, length: 3, style: "STRIKETHROUGH" },
            ],
            entityRanges: [{ offset: 4, length: 9, key: 0 }],
          },
        ],
        [{ type: "LINK", data: { href: "https://example.test/n" } }],
      ).data,
    );
    expect(out).toBe(
      '<p>see <a href="https://example.test/n" target="_blank" rel="noopener noreferrer"><strong>the </strong><strong><em>notes</em></strong></a> now</p>',
    );
  });

  it("refuses a link that is not http(s) and escapes text that looks like markup", () => {
    const { html: out } = htmlFromDraft(
      draft(
        [
          {
            text: '<script>alert("x")</script> click',
            entityRanges: [{ offset: 28, length: 5, key: 0 }],
          },
        ],
        [{ type: "LINK", data: { href: "javascript:alert(1)" } }],
      ).data,
    );
    expect(out).toBe(
      "<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; click</p>",
    );
    expect(withinAllowlist(out)).toBe(true);
  });

  it("reads the entity map in Draft.js's object form too, and a `url` field", () => {
    const { html: out } = htmlFromDraft({
      blocks: [
        {
          key: "a",
          text: "home",
          type: "unstyled",
          depth: 0,
          inlineStyleRanges: [],
          entityRanges: [{ offset: 0, length: 4, key: "7" }],
          data: {},
        },
      ],
      entityMap: {
        "7": {
          type: "LINK",
          mutability: "MUTABLE",
          data: { url: "https://example.test/" },
        },
      },
    });
    expect(out).toBe(
      '<p><a href="https://example.test/" target="_blank" rel="noopener noreferrer">home</a></p>',
    );
  });

  it("makes a paragraph of each soft line, keeping a range on its line", () => {
    const { html: out } = htmlFromDraft(
      draft([
        {
          text: "one\ntwo bold\nthree",
          inlineStyleRanges: [{ offset: 8, length: 4, style: "BOLD" }],
        },
      ]).data,
    );
    expect(out).toBe("<p>one</p><p>two <strong>bold</strong></p><p>three</p>");
  });

  it("nests lists by depth, switches between ordered and unordered, and groups quote blocks", () => {
    const { html: out } = htmlFromDraft(
      draft([
        { text: "a", type: "unordered-list-item" },
        { text: "a1", type: "unordered-list-item", depth: 1 },
        { text: "b", type: "unordered-list-item" },
        { text: "1", type: "ordered-list-item" },
        { text: "q1", type: "blockquote" },
        { text: "q2", type: "blockquote" },
        { text: "after", type: "header-two" },
      ]).data,
    );
    expect(out).toBe(
      "<ul><li>a<ul><li>a1</li></ul></li><li>b</li></ul><ol><li>1</li></ol><blockquote><p>q1</p><p>q2</p></blockquote><p><strong>after</strong></p>",
    );
  });

  it("halts on a Draft.js block type it does not know, naming it", () => {
    expect(() =>
      htmlFromDraft(draft([{ text: "x", type: "table-cell" }]).data),
    ).toThrow(UnknownBlockError);
    expect(() =>
      htmlFromDraft(draft([{ text: "x", type: "table-cell" }]).data),
    ).toThrow(/unknown Draft.js block type "table-cell"/);
  });
});

describe("htmlFromBlocks on made-up blocks", () => {
  it("halts on a content block type it does not know, with the block in the error", () => {
    let caught: unknown;
    try {
      htmlFromBlocks([{ id: 1, type: "embed", data: { url: "https://x" } }]);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(UnknownBlockError);
    expect((caught as UnknownBlockError).block).toEqual({
      id: 1,
      type: "embed",
      data: { url: "https://x" },
    });
  });

  it("halts on an upload from a host that is not RSI's, and on an upload id of another shape", () => {
    const upload = (id: string, url: string) => [
      {
        id: 1,
        type: "image",
        data: [
          {
            id,
            type: "upload",
            data: { url, image_width: 1, image_height: 1 },
          },
        ],
      },
    ];
    expect(() =>
      htmlFromBlocks(upload("upload:1", "https://evil.test/a.jpg")),
    ).toThrow();
    expect(() =>
      htmlFromBlocks(
        upload(
          "upload:x",
          "https://theverse.robertsspaceindustries.com/a/source.jpg",
        ),
      ),
    ).toThrow();
    const ok = htmlFromBlocks(
      upload(
        "upload:9",
        "https://theverse.robertsspaceindustries.com/a/source.png",
      ),
    );
    expect(ok.html).toBe('<img data-upload="9" width="1" height="1" alt="">');
  });

  it("takes an image embedded by address from RSI's media host as a picture keyed e- and its slug, and makes a link of any other embed", () => {
    // The entry as Spectrum's answer of 2026-11-11 carries it, in "Day of the Vara 2956".
    const vara = {
      id: "embed:tgcvmgrkzycyy",
      slug: "tgcvmgrkzycyy",
      type: "embed",
      data: {
        embed_type: "photo",
        url: "https://media.robertsspaceindustries.com/3l2owd4euw4r9/channel_item_full.png",
        provider_name: "robertsspaceindustries",
        title:
          "https://media.robertsspaceindustries.com/3l2owd4euw4r9/channel_item_full.png",
        description: null,
        image_width: 1119,
        image_height: 600,
        time_fetched: 1792600210,
      },
    };
    const photo = htmlFromBlocks([{ id: 1, type: "image", data: [vara] }]);
    expect(photo.html).toBe(
      '<img data-upload="e-tgcvmgrkzycyy" width="1119" height="600" alt="">',
    );
    expect(photo.uploads).toEqual([
      {
        id: "e-tgcvmgrkzycyy",
        url: "https://media.robertsspaceindustries.com/3l2owd4euw4r9/channel_item_full.png",
        width: 1119,
        height: 600,
      },
    ]);
    expect(withinAllowlist(photo.html)).toBe(true);
    // A picture on another host, and a video, are links; nothing is copied from them.
    const elsewhere = htmlFromBlocks([
      {
        id: 2,
        type: "image",
        data: [
          {
            ...vara,
            id: "embed:abc",
            slug: "abc",
            data: {
              ...vara.data,
              url: "https://i.imgur.com/a.png",
              title: null,
            },
          },
          {
            ...vara,
            id: "embed:def",
            slug: "def",
            data: {
              ...vara.data,
              embed_type: "video",
              url: "https://www.youtube.com/watch?v=x",
              title: "Inside Star Citizen",
            },
          },
        ],
      },
    ]);
    expect(elsewhere.uploads).toEqual([]);
    expect(elsewhere.html).toContain(
      '<p><a href="https://i.imgur.com/a.png" target="_blank" rel="noopener noreferrer">https://i.imgur.com/a.png</a></p>',
    );
    expect(elsewhere.html).toContain(
      '<p><a href="https://www.youtube.com/watch?v=x" target="_blank" rel="noopener noreferrer">Inside Star Citizen</a></p>',
    );
    expect(withinAllowlist(elsewhere.html)).toBe(true);
    // An entry of neither shape still halts.
    expect(() =>
      htmlFromBlocks([
        {
          id: 3,
          type: "image",
          data: [{ id: "gif:1", type: "gif", data: {} }],
        },
      ]),
    ).toThrow();
  });

  it("joins blocks with a newline and takes the first paragraph from the first text block with one", () => {
    const parsed = htmlFromBlocks([
      draft([{ text: "" }]),
      draft([{ text: "Second block speaks first." }]),
    ]);
    expect(parsed.html).toBe("\n<p>Second block speaks first.</p>");
    expect(parsed.first_paragraph).toBe("Second block speaks first.");
  });
});

describe("withinAllowlist", () => {
  it("lists exactly the tags the brief allows and refuses anything else", () => {
    expect(ALLOWED_TAGS).toEqual([
      "p",
      "strong",
      "em",
      "a",
      "blockquote",
      "ul",
      "ol",
      "li",
      "img",
    ]);
    expect(withinAllowlist("<p>x</p><h2>y</h2>")).toBe(false);
    expect(withinAllowlist("<script>x</script>")).toBe(false);
    expect(withinAllowlist('<img src="https://x/a.jpg" alt="">')).toBe(false);
    expect(withinAllowlist('<a href="javascript:x">y</a>')).toBe(false);
    expect(withinAllowlist('<p class="x">y</p>')).toBe(false);
    expect(
      withinAllowlist(
        '<p><a href="https://x/" target="_blank" rel="noopener noreferrer">y</a></p><img data-upload="1" alt="">',
      ),
    ).toBe(true);
  });
});

describe("what the parser refuses or leaves out", () => {
  it("drops the pictures inside a quote, which are the quoted member's, and collects no upload for them", () => {
    const quoted = {
      id: "q",
      type: "quote",
      reply_id: "1",
      member: { displayname: "Someone" },
      data: [
        draft([{ text: "Look:" }]),
        {
          id: 2,
          type: "image",
          data: [
            {
              id: "upload:77",
              type: "upload",
              data: {
                url: "https://theverse.robertsspaceindustries.com/x/source.jpg",
                image_width: 10,
                image_height: 10,
              },
            },
          ],
        },
      ],
    };
    const parsed = htmlFromBlocks([quoted, draft([{ text: "Reply." }])]);
    expect(parsed.html).toBe(
      "<blockquote><p><strong>Someone</strong></p><p>Look:</p></blockquote>\n<p>Reply.</p>",
    );
    expect(parsed.uploads).toEqual([]);
  });

  it("halts on an atomic block that embeds an entity, and skips an empty one", () => {
    expect(() =>
      htmlFromDraft(
        draft(
          [
            {
              text: " ",
              type: "atomic",
              entityRanges: [{ offset: 0, length: 1, key: 0 }],
            },
          ],
          [{ type: "IMAGE", data: { src: "https://x/y.png" } }],
        ).data,
      ),
    ).toThrow(UnknownBlockError);
    expect(
      htmlFromDraft(
        draft([{ text: "", type: "atomic" }, { text: "after" }]).data,
      ).html,
    ).toBe("<p>after</p>");
  });
});
