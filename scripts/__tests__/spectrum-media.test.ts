import { describe, expect, it } from "vitest";
import {
  type UploadRow,
  uploadIdsIn,
  wantedUploads,
} from "../media/fetch-spectrum.js";
import {
  SPECTRUM_UPLOAD_WIDTHS,
  SpectrumSource,
  spectrumRenditionPath,
} from "../media/sources.js";

// ADR-037: the pictures in developer posts are copied by Spectrum's upload id, only for posts the
// site shows, and served as web copies named by that id. No network here.

const row = (upload_id: string, post_id: string): UploadRow => ({
  upload_id,
  url: `https://theverse.robertsspaceindustries.com/${upload_id}/source.jpg`,
  width: 1680,
  height: 945,
  post_id,
  post_url: `https://robertsspaceindustries.com/spectrum/community/SC/forum/1/thread/t/${post_id}`,
  thread_id: "1",
  seen_at: "2026-11-10T21:00:00.000Z",
});

describe("uploadIdsIn", () => {
  it("reads every upload id on an img, once each, and nothing from other markup", () => {
    expect(
      uploadIdsIn(
        '<p>a</p><img data-upload="3463136" width="1680" height="945" alt=""><img data-upload="3463137" alt=""><img data-upload="3463136" alt=""><p data-upload="9">x</p>',
      ),
    ).toEqual(["3463136", "3463137"]);
    expect(uploadIdsIn("<p>no pictures</p>")).toEqual([]);
  });
});

describe("wantedUploads", () => {
  const pack = [
    {
      source: "spectrum",
      external_id: "1",
      body_html: '<img data-upload="10" alt="">',
      revision: 1,
      takedown: false,
    },
    {
      source: "spectrum",
      external_id: "1",
      body_html: '<img data-upload="11" alt=""><img data-upload="12" alt="">',
      revision: 2,
      takedown: false,
    },
    {
      source: "spectrum",
      external_id: "2",
      body_html: '<img data-upload="13" alt="">',
      revision: 1,
      takedown: true,
    },
    {
      source: "comm_link",
      external_id: "3",
      body_html: '<img data-upload="14" alt="">',
      revision: 1,
      takedown: false,
    },
  ];

  it("wants the uploads of each shown post's latest revision, none under takedown, with the worker's address, and reports an unrecorded id", () => {
    const { wanted, unrecorded } = wantedUploads(pack, [
      row("10", "1"),
      row("11", "1"),
      row("13", "2"),
    ]);
    expect(wanted.map((u) => u.upload_id)).toEqual(["11"]);
    expect(unrecorded).toEqual(["12"]);
  });
});

describe("the web copies", () => {
  it("names a copy by the upload id and width, widest first and never over 1920", () => {
    expect(spectrumRenditionPath("3463136", 1280)).toBe(
      "/media/spectrum/3463136-1280.webp",
    );
    expect(SPECTRUM_UPLOAD_WIDTHS[0]).toBe(1920);
    expect([...SPECTRUM_UPLOAD_WIDTHS].sort((a, b) => b - a)).toEqual(
      SPECTRUM_UPLOAD_WIDTHS,
    );
  });

  it("records a copied picture by the upload id and the post's page", () => {
    const parsed = SpectrumSource.parse({
      upload_id: "3463136",
      file: "3463136.jpg",
      page_url:
        "https://robertsspaceindustries.com/spectrum/community/SC/forum/1/thread/spectrum-redesign-phase-1-now-live",
      image_url:
        "https://theverse.robertsspaceindustries.com/6jyg90p60itm0/source.jpg",
      content_type: "image/jpeg",
      bytes: 123456,
      sha256: "a".repeat(64),
      fetched_at: "2026-11-10T21:00:00.000Z",
    });
    expect(parsed.upload_id).toBe("3463136");
    expect(() =>
      SpectrumSource.parse({ ...parsed, upload_id: "upload:1" }),
    ).toThrow();
  });
});
