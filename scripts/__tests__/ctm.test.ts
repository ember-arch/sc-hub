import { describe, expect, it } from "vitest";
import { readCtm, restoreIndices } from "../media/ctm.js";
import { CTM_UNIT_METRES, packHoloModel } from "../media/holo-glb.js";

// ADR-015: RSI's holoviewer models are OpenCTM; the reader halts on a shape it does not know, and
// the packer writes a glTF in metres. A synthetic RAW file stands in for RSI's (MG2, LZMA-packed).

function rawCtm(
  vertices: number[],
  indices: number[],
  method = "RAW",
): Uint8Array {
  const parts: number[] = [];
  const u32 = (v: number) => {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, v, true);
    parts.push(...b);
  };
  const f32 = (v: number) => {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setFloat32(0, v, true);
    parts.push(...b);
  };
  const tag = (t: string) => parts.push(...[...t].map((c) => c.charCodeAt(0)));
  tag("OCTM");
  u32(5);
  tag(method.padEnd(4, "\0"));
  u32(vertices.length / 3);
  u32(indices.length / 3);
  u32(0);
  u32(0);
  u32(0);
  u32(0); // empty comment
  tag("INDX");
  for (const i of indices) u32(i);
  tag("VERT");
  for (const v of vertices) f32(v);
  return new Uint8Array(parts);
}

// One triangle, 100 cm on a side, in centimetres like RSI's files.
const triangle = rawCtm([0, 0, 0, 100, 0, 0, 0, 0, 100], [0, 1, 2]);

describe("readCtm", () => {
  it("reads a RAW file's vertices and indices", () => {
    const mesh = readCtm(triangle);
    expect(mesh.method).toBe("RAW");
    expect([...mesh.indices]).toEqual([0, 1, 2]);
    expect([...mesh.vertices]).toEqual([0, 0, 0, 100, 0, 0, 0, 0, 100]);
  });

  it("halts on another format, an unknown method or an index beyond the vertices", () => {
    expect(() => readCtm(new Uint8Array([1, 2, 3, 4]))).toThrow(/OCTM/);
    expect(() => readCtm(rawCtm([0, 0, 0], [0, 0, 0], "XYZ"))).toThrow(
      /unknown method/,
    );
    expect(() =>
      readCtm(rawCtm([0, 0, 0, 1, 1, 1, 2, 2, 2], [0, 1, 5])),
    ).toThrow(/beyond/);
  });
});

describe("restoreIndices", () => {
  it("undoes OpenCTM's index deltas", () => {
    // Triangles (0,1,2) and (0,2,3) stored as deltas: the first relative to itself, the second's
    // first index relative to the previous first, its second relative to the previous second.
    const packed = new Uint32Array([0, 1, 2, 0, 1, 3]);
    restoreIndices(packed);
    expect([...packed]).toEqual([0, 1, 2, 0, 2, 3]);
  });
});

describe("packHoloModel", () => {
  it("writes a binary glTF in metres with meshopt and quantization declared", async () => {
    const packed = await packHoloModel(readCtm(triangle));
    const view = new DataView(packed.glb.buffer);
    expect(view.getUint32(0, true)).toBe(0x46546c67); // "glTF"
    expect(view.getUint32(8, true)).toBe(packed.glb.length);
    const jsonLength = view.getUint32(12, true);
    const json = JSON.parse(
      new TextDecoder().decode(packed.glb.subarray(20, 20 + jsonLength)),
    ) as { extensionsRequired: string[] };
    expect(json.extensionsRequired).toEqual([
      "EXT_meshopt_compression",
      "KHR_mesh_quantization",
    ]);
    expect(packed.size[0]).toBeCloseTo(100 * CTM_UNIT_METRES, 6);
    expect(packed.size[2]).toBeCloseTo(100 * CTM_UNIT_METRES, 6);
    expect(packed.triangles).toBe(1);
  });
});
