/**
 * A Spectrum post's own content as HTML (ADR-037). Spectrum stores a post as `content_blocks`:
 * `text` blocks in Draft.js's raw form (paragraphs, headings, list items and quotes, each with
 * inline style ranges and entity ranges over its text, and an entity map of links, mentions and
 * emoji shortcodes), `image` blocks of uploads, and `quote` blocks. This module turns them into
 * HTML the site can place as is, within an allowlist and nothing else: `p`, `strong`, `em`, `a`
 * (an http(s) `href`, `rel="noopener noreferrer"`), `blockquote`, `ul`, `ol`, `li`, and `img`
 * carrying only Spectrum's upload id (`data-upload`) and the picture's size, never a source: the
 * site resolves the id to a copy it serves itself (ADR-009). Text is escaped; every attribute is
 * written here, none copied. A block or a Draft.js block of a kind this module does not know
 * halts the run with the block in the error (CLAUDE.md section 5), as does a post written in the
 * editor Spectrum is moving to (`lexical_content` without `content_blocks`).
 *
 * Draft.js writes its ranges in Unicode code points, not UTF-16 units (`convertToRaw` measures
 * with `UnicodeUtils.strlen`), so a post with an astral character, an emoji pasted as a character
 * or a supplementary-plane letter, is cut on code points here; cutting on UTF-16 units would shift
 * every range after it by one.
 */
import { SPECTRUM_PICTURE_ID_SOURCE } from "schema";
import { z } from "zod";

const str = z.string();

/** An `img` as the worker writes it: a picture id, the size when known, an empty alt; nothing else. */
const IMG_ATTRS = new RegExp(
  `^data-upload="(?:${SPECTRUM_PICTURE_ID_SOURCE})"( width="\\d+" height="\\d+")? alt=""$`,
);
const key = z.union([z.string(), z.number()]);

const StyleRange = z.object({
  offset: z.number().int().nonnegative(),
  length: z.number().int().nonnegative(),
  style: str,
});
const EntityRange = z.object({
  offset: z.number().int().nonnegative(),
  length: z.number().int().nonnegative(),
  key,
});
const DraftBlock = z
  .object({
    key: str.optional(),
    text: str,
    type: str,
    depth: z.number().int().nonnegative().default(0),
    inlineStyleRanges: z.array(StyleRange).default([]),
    entityRanges: z.array(EntityRange).default([]),
  })
  .loose();
type DraftBlock = z.infer<typeof DraftBlock>;

const Entity = z
  .object({ type: str, mutability: str.optional(), data: z.unknown() })
  .loose();
type Entity = z.infer<typeof Entity>;

/** Draft.js raw content: the entity map is an array when Spectrum serialises it, an object in Draft.js's own form. */
export const TextData = z.object({
  blocks: z.array(DraftBlock),
  entityMap: z
    .union([z.array(Entity), z.record(str, Entity)])
    .default([])
    .optional(),
});

const UPLOAD_HOST = /^https:\/\/[a-z0-9-]+\.robertsspaceindustries\.com\//;

/** One upload in an `image` block: Spectrum's id and the picture at the size it was uploaded. */
const UploadEntry = z
  .object({
    id: str.regex(/^upload:\d+$/),
    type: z.literal("upload"),
    data: z
      .object({
        url: z.url().regex(UPLOAD_HOST),
        image_width: z.number().int().positive().nullable().optional(),
        image_height: z.number().int().positive().nullable().optional(),
      })
      .loose(),
  })
  .loose();

/**
 * An image embedded by address rather than uploaded (seen 2026-11-11 in "Day of the Vara 2956"):
 * Spectrum fetched the address and keeps what it found. A `photo` on RSI's own media host is a
 * picture like an upload, keyed "e-" and its slug; any other embed (a video, a page, a picture on
 * someone else's host) becomes a plain link to its address, so nothing from a third-party host is
 * copied (ADR-009). An embed whose fetch failed carries no address and adds nothing to the post.
 * The id must be "embed:" and the slug; a size is read only for a picture, and anything else
 * (an address that is not http(s), a picture slug of another shape) halts the run.
 */
const EmbedEntry = z
  .object({
    id: str,
    slug: str,
    type: z.literal("embed"),
    data: z
      .object({
        embed_type: str.nullable().optional(),
        url: str.nullable().optional(),
        title: str.nullable().optional(),
        image_width: z.number().nullable().optional(),
        image_height: z.number().nullable().optional(),
      })
      .loose(),
  })
  .loose()
  .refine((e) => e.id === `embed:${e.slug}`, {
    message: 'an embed\'s id must be "embed:" and its slug',
  });

/** A whole positive number, or null: an embed's size, read only for a picture. */
const sizeOf = (n: number | null | undefined): number | null =>
  typeof n === "number" && Number.isInteger(n) && n > 0 ? n : null;
export const ImageData = z.array(z.union([UploadEntry, EmbedEntry]));

export const ContentBlock = z
  .object({ id: key.optional(), type: str, data: z.unknown() })
  .loose();
export type ContentBlock = z.infer<typeof ContentBlock>;

/** A picture a post carries: Spectrum's upload id and where the original is. */
export interface Upload {
  readonly id: string;
  readonly url: string;
  readonly width: number | null;
  readonly height: number | null;
}

export interface ParsedPost {
  /** Sanitized by construction: only the allowlisted tags, every attribute written here. */
  readonly html: string;
  /** The post's first line of text, for the summary; null when it has none. */
  readonly first_paragraph: string | null;
  readonly uploads: readonly Upload[];
}

/** A block of a kind the parser does not know: the run halts with it (CLAUDE.md section 5). */
export class UnknownBlockError extends Error {
  readonly block: unknown;
  constructor(message: string, block: unknown) {
    super(`${message}: ${JSON.stringify(block)?.slice(0, 2000)}`);
    this.name = "UnknownBlockError";
    this.block = block;
  }
}

const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
}

/** Entities by key, whichever form the map takes. */
function entityAt(
  map: z.infer<typeof TextData>["entityMap"],
  k: string | number,
): Entity | undefined {
  if (map === undefined) return undefined;
  return Array.isArray(map) ? map[Number(k)] : map[String(k)];
}

/** The link an entity carries, when it is a link to an http(s) address; otherwise null. */
function hrefOf(entity: Entity | undefined): string | null {
  if (entity === undefined || entity.type !== "LINK") return null;
  const data = entity.data;
  if (data === null || typeof data !== "object") return null;
  const raw =
    (data as { href?: unknown; url?: unknown }).href ??
    (data as { url?: unknown }).url;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return /^https?:\/\/\S+$/i.test(trimmed) ? trimmed : null;
}

interface Run {
  text: string;
  bold: boolean;
  italic: boolean;
  href: string | null;
}

/**
 * The block's text with its inline styles and links applied: the text is split into runs of one
 * formatting each, by Draft.js's ranges in code points; bold is `strong`, italic `em`, a link `a`;
 * underline, strikethrough and code have no tag in the allowlist and keep their text; a mention
 * or an emoji shortcode is its text.
 */
export function inlineHtml(
  block: DraftBlock,
  entityMap: z.infer<typeof TextData>["entityMap"],
): string {
  const chars = [...block.text];
  if (chars.length === 0) return "";
  const bold = new Array<boolean>(chars.length).fill(false);
  const italic = new Array<boolean>(chars.length).fill(false);
  const href = new Array<string | null>(chars.length).fill(null);
  for (const range of block.inlineStyleRanges) {
    const end = Math.min(chars.length, range.offset + range.length);
    for (let i = range.offset; i < end; i += 1) {
      if (range.style === "BOLD") bold[i] = true;
      else if (range.style === "ITALIC") italic[i] = true;
    }
  }
  for (const range of block.entityRanges) {
    const link = hrefOf(entityAt(entityMap, range.key));
    if (link === null) continue;
    const end = Math.min(chars.length, range.offset + range.length);
    for (let i = range.offset; i < end; i += 1) href[i] = link;
  }
  const runs: Run[] = [];
  for (let i = 0; i < chars.length; i += 1) {
    const last = runs[runs.length - 1];
    if (
      last !== undefined &&
      last.bold === bold[i] &&
      last.italic === italic[i] &&
      last.href === href[i]
    ) {
      last.text += chars[i];
    } else {
      runs.push({
        text: chars[i]!,
        bold: bold[i]!,
        italic: italic[i]!,
        href: href[i]!,
      });
    }
  }
  // Runs under one link share the anchor, so a bold word inside a link does not split it.
  let out = "";
  let openHref: string | null = null;
  const closeLink = () => {
    if (openHref !== null) out += "</a>";
    openHref = null;
  };
  for (const run of runs) {
    if (run.href !== openHref) {
      closeLink();
      if (run.href !== null) {
        out += `<a href="${escapeHtml(run.href)}" target="_blank" rel="noopener noreferrer">`;
        openHref = run.href;
      }
    }
    let text = escapeHtml(run.text);
    if (run.italic) text = `<em>${text}</em>`;
    if (run.bold) text = `<strong>${text}</strong>`;
    out += text;
  }
  closeLink();
  return out;
}

type ListKind = "ul" | "ol";

/** The HTML of one Draft.js raw document, one element per block, lists and quotes grouped. */
export function htmlFromDraft(raw: unknown): {
  html: string;
  first_paragraph: string | null;
} {
  const data = TextData.parse(raw);
  const parts: string[] = [];
  let first: string | null = null;
  // Open lists, one per depth; closed when the next block is not an item at that depth or deeper.
  const lists: { kind: ListKind; depth: number }[] = [];
  const closeLists = (toDepth: number) => {
    while (lists.length > 0 && lists[lists.length - 1]!.depth >= toDepth) {
      parts.push(`</li></${lists.pop()!.kind}>`);
    }
  };
  let quoteOpen = false;
  const closeQuote = () => {
    if (quoteOpen) parts.push("</blockquote>");
    quoteOpen = false;
  };
  for (const block of data.blocks) {
    const inline = inlineHtml(block, data.entityMap);
    const plain = block.text.trim();
    const type = block.type;
    const listKind: ListKind | null =
      type === "unordered-list-item"
        ? "ul"
        : type === "ordered-list-item"
          ? "ol"
          : null;
    if (listKind !== null) {
      closeQuote();
      // A blank item is a blank line inside the list on Spectrum; the margin does that here.
      if (plain === "") continue;
      const depth = block.depth;
      const top = lists[lists.length - 1];
      if (top !== undefined && top.depth > depth) closeLists(depth + 1);
      const current = lists[lists.length - 1];
      if (current === undefined || current.depth < depth) {
        parts.push(`<${listKind}><li>`);
        lists.push({ kind: listKind, depth });
      } else if (current.kind !== listKind) {
        parts.push(`</li></${current.kind}><${listKind}><li>`);
        lists[lists.length - 1] = { kind: listKind, depth };
      } else {
        parts.push("</li><li>");
      }
      parts.push(inline);
      if (first === null && plain !== "") first = plain;
      continue;
    }
    closeLists(0);
    if (plain === "" && type !== "atomic") {
      // Spectrum writes an empty block for a blank line; paragraph spacing is the margin's job.
      closeQuote();
      continue;
    }
    switch (type) {
      case "unstyled":
      case "paragraph":
      case "code-block":
        closeQuote();
        // A soft line break within a block (shift and enter, or a line of a code block) is a
        // paragraph here: `br` is outside the allowlist.
        for (const line of splitLines(block, data.entityMap)) {
          if (line.trim() !== "") parts.push(`<p>${line}</p>`);
        }
        break;
      case "header-one":
      case "header-two":
      case "header-three":
      case "header-four":
      case "header-five":
      case "header-six":
        closeQuote();
        // No heading in the allowlist: a heading reads as a bold paragraph.
        parts.push(`<p><strong>${escapeHtml(plain)}</strong></p>`);
        break;
      case "blockquote":
        if (!quoteOpen) parts.push("<blockquote>");
        quoteOpen = true;
        parts.push(`<p>${inline}</p>`);
        break;
      case "atomic":
        // An atomic block holds an embedded entity. Spectrum carries pictures as blocks of their
        // own and has sent no atomic block with an entity; one with an entity is a shape this
        // parser does not know and must not drop in silence (CLAUDE.md section 5).
        if (block.entityRanges.length > 0) {
          throw new UnknownBlockError(
            "an atomic Draft.js block with an entity",
            block,
          );
        }
        break;
      default:
        throw new UnknownBlockError(
          `unknown Draft.js block type "${type}"`,
          block,
        );
    }
    if (first === null && plain !== "") first = plain;
  }
  closeLists(0);
  closeQuote();
  return { html: parts.join(""), first_paragraph: first };
}

/** The block's inline HTML split on its soft line breaks, ranges kept on the right side. */
function splitLines(
  block: DraftBlock,
  entityMap: z.infer<typeof TextData>["entityMap"],
): string[] {
  if (!block.text.includes("\n")) return [inlineHtml(block, entityMap)];
  const lines: string[] = [];
  const chars = [...block.text];
  let start = 0;
  for (let i = 0; i <= chars.length; i += 1) {
    if (i === chars.length || chars[i] === "\n") {
      const shift = (ranges: readonly { offset: number; length: number }[]) =>
        ranges
          .map((r) => {
            const from = Math.max(r.offset, start) - start;
            const to = Math.min(r.offset + r.length, i) - start;
            return { ...r, offset: from, length: to - from };
          })
          .filter((r) => r.length > 0);
      lines.push(
        inlineHtml(
          {
            ...block,
            text: chars.slice(start, i).join(""),
            inlineStyleRanges: shift(block.inlineStyleRanges) as z.infer<
              typeof StyleRange
            >[],
            entityRanges: shift(block.entityRanges) as z.infer<
              typeof EntityRange
            >[],
          },
          entityMap,
        ),
      );
      start = i + 1;
    }
  }
  return lines;
}

/**
 * A quote block as Spectrum sends it (2026-11-10): the quoted post's own content blocks as its
 * `data`, the quoted reply's id, and the quoted member, of whom only the display name is read.
 */
export const QuoteBlock = z
  .object({
    type: z.literal("quote"),
    reply_id: str.optional(),
    data: z.array(ContentBlock).nullable().optional(),
    member: z
      .object({ displayname: str.optional(), nickname: str.optional() })
      .loose()
      .nullable()
      .optional(),
  })
  .loose();

/** The HTML of a `quote` block: the quoted member's name in bold, then the quoted content, as a blockquote. */
function htmlFromQuote(block: unknown): string {
  const quote = QuoteBlock.parse(block);
  // The quoted post is someone else's, often a player's: its pictures are not copied, shown or
  // credited to CIG; the quote carries its words alone.
  const inner = htmlFromBlocks(quote.data ?? [], { pictures: false });
  const name = quote.member?.displayname ?? quote.member?.nickname ?? null;
  const who =
    name === null || name.trim() === ""
      ? ""
      : `<p><strong>${escapeHtml(name.trim())}</strong></p>`;
  return `<blockquote>${who}${inner.html}</blockquote>`;
}

/**
 * A post's `content_blocks` as HTML. `text` blocks are Draft.js raw documents; `image` blocks are
 * uploads, each an `img` with Spectrum's upload id and the picture's size and no source; `quote`
 * blocks are blockquotes of the quoted content. Any other kind halts.
 */
export function htmlFromBlocks(
  blocks: readonly unknown[],
  options: { readonly pictures: boolean } = { pictures: true },
): ParsedPost {
  const parts: string[] = [];
  const uploads: Upload[] = [];
  let first: string | null = null;
  for (const raw of blocks) {
    const block = ContentBlock.parse(raw);
    switch (block.type) {
      case "text": {
        const text = htmlFromDraft(block.data);
        parts.push(text.html);
        if (first === null) first = text.first_paragraph;
        break;
      }
      case "image": {
        const entries = ImageData.parse(block.data);
        if (!options.pictures) break;
        for (const entry of entries) {
          let id: string;
          let url: string;
          let width: number | null;
          let height: number | null;
          if (entry.type === "embed") {
            const address = entry.data.url ?? null;
            // A failed fetch leaves no address: the embed shows nothing on Spectrum either.
            if (address === null || address.trim() === "") continue;
            if (!/^https?:\/\/\S+$/.test(address)) {
              throw new UnknownBlockError(
                "an embed whose address is not http(s)",
                entry,
              );
            }
            const picture =
              entry.data.embed_type === "photo" && UPLOAD_HOST.test(address);
            if (!picture) {
              // Not a picture this site copies: a link to it, in the post's own words or its address.
              const label = entry.data.title?.trim() || address;
              parts.push(
                `<p><a href="${escapeHtml(address)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a></p>`,
              );
              continue;
            }
            if (!/^[a-z0-9]+$/.test(entry.slug)) {
              throw new UnknownBlockError(
                "a picture embed whose slug is not lowercase letters and digits",
                entry,
              );
            }
            id = `e-${entry.slug}`;
            url = address;
            width = sizeOf(entry.data.image_width);
            height = sizeOf(entry.data.image_height);
          } else {
            id = entry.id.slice("upload:".length);
            url = entry.data.url;
            width = entry.data.image_width ?? null;
            height = entry.data.image_height ?? null;
          }
          const size =
            width !== null && height !== null
              ? ` width="${width}" height="${height}"`
              : "";
          parts.push(`<img data-upload="${id}"${size} alt="">`);
          uploads.push({ id, url, width, height });
        }
        break;
      }
      case "quote":
        parts.push(htmlFromQuote(block));
        break;
      default:
        throw new UnknownBlockError(
          `unknown content block type "${block.type}"`,
          block,
        );
    }
  }
  return { html: parts.join("\n"), first_paragraph: first, uploads };
}

/**
 * The tags the HTML written here may contain, for the tests and for anyone checking a pack: the
 * site places `body_html` as is, so nothing outside this list may ever be in it.
 */
export const ALLOWED_TAGS: readonly string[] = [
  "p",
  "strong",
  "em",
  "a",
  "blockquote",
  "ul",
  "ol",
  "li",
  "img",
];

/** True when every tag in the HTML is allowlisted and every attribute is one this module writes. */
export function withinAllowlist(html: string): boolean {
  for (const match of html.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g)) {
    const tag = match[1]!.toLowerCase();
    if (!ALLOWED_TAGS.includes(tag)) return false;
    const attrs = match[2]!.trim();
    if (attrs === "") continue;
    if (tag === "a") {
      if (
        !/^href="https?:\/\/[^"]*" target="_blank" rel="noopener noreferrer"$/.test(
          attrs,
        )
      )
        return false;
    } else if (tag === "img") {
      if (!IMG_ATTRS.test(attrs)) return false;
    } else return false;
  }
  return true;
}
