/**
 * Reads the geometry of an OpenCTM file (ADR-015), the format RSI's holoviewer models use: the
 * vertex positions and the triangle indices. Supports the three compression methods (RAW, MG1,
 * MG2), written from the OpenCTM format specification. Normals, UV maps and attributes that follow
 * the indices are not read: the viewer derives smooth normals from the geometry. Pure.
 */
import { lzmaDecode } from "./lzma.js";

export interface CtmMesh {
  readonly vertices: Float32Array;
  readonly indices: Uint32Array;
  readonly comment: string;
  readonly method: "RAW" | "MG1" | "MG2";
}

class Reader {
  private pos = 0;
  private readonly view: DataView;

  constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  private need(n: number): void {
    if (this.pos + n > this.bytes.length)
      throw new Error("ctm: file too short");
  }

  u32(): number {
    this.need(4);
    const v = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return v;
  }

  f32(): number {
    this.need(4);
    const v = this.view.getFloat32(this.pos, true);
    this.pos += 4;
    return v;
  }

  tag(): string {
    this.need(4);
    const t = String.fromCharCode(
      ...this.bytes.subarray(this.pos, this.pos + 4),
    );
    this.pos += 4;
    return t;
  }

  expect(tag: string): void {
    const t = this.tag();
    if (t !== tag)
      throw new Error(`ctm: expected ${tag}, found ${JSON.stringify(t)}`);
  }

  string(): string {
    const n = this.u32();
    this.need(n);
    const s = new TextDecoder().decode(
      this.bytes.subarray(this.pos, this.pos + n),
    );
    this.pos += n;
    return s;
  }

  take(n: number): Uint8Array {
    this.need(n);
    const out = this.bytes.subarray(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }

  /** An LZMA-packed array of `count` elements of `size` 32-bit words, stored byte-plane by byte-plane. */
  packed(count: number, size: number): Uint32Array {
    const packedSize = this.u32();
    const props = this.take(5);
    const data = this.take(packedSize);
    const plane = count * size;
    const raw = lzmaDecode(props, data, plane * 4);
    const out = new Uint32Array(plane);
    for (let i = 0; i < count; i += 1) {
      for (let k = 0; k < size; k += 1) {
        const at = i + k * count;
        out[i * size + k] =
          ((raw[at]! << 24) |
            (raw[at + plane]! << 16) |
            (raw[at + 2 * plane]! << 8) |
            raw[at + 3 * plane]!) >>>
          0;
      }
    }
    return out;
  }
}

/** Undoes OpenCTM's index deltas (MG1 and MG2 store each triangle relative to the one before). */
export function restoreIndices(indices: Uint32Array): void {
  for (let i = 0; i < indices.length / 3; i += 1) {
    const a = i * 3;
    if (i >= 1) indices[a] = (indices[a]! + indices[a - 3]!) >>> 0;
    indices[a + 2] = (indices[a + 2]! + indices[a]!) >>> 0;
    if (i >= 1 && indices[a] === indices[a - 3])
      indices[a + 1] = (indices[a + 1]! + indices[a - 2]!) >>> 0;
    else indices[a + 1] = (indices[a + 1]! + indices[a]!) >>> 0;
  }
}

export function readCtm(bytes: Uint8Array): CtmMesh {
  const r = new Reader(bytes);
  r.expect("OCTM");
  const version = r.u32();
  if (version !== 5)
    throw new Error(`ctm: version ${version} is not supported`);
  const method = r.tag().replace(/\0+$/, "");
  if (method !== "RAW" && method !== "MG1" && method !== "MG2")
    throw new Error(`ctm: unknown method ${JSON.stringify(method)}`);
  const vertexCount = r.u32();
  const triangleCount = r.u32();
  r.u32(); // UV map count
  r.u32(); // attribute map count
  r.u32(); // flags (bit 0: normals follow the indices)
  const comment = r.string();
  if (vertexCount === 0 || triangleCount === 0)
    throw new Error("ctm: empty mesh");

  let vertices: Float32Array;
  let indices: Uint32Array;
  if (method === "RAW") {
    r.expect("INDX");
    indices = new Uint32Array(triangleCount * 3);
    for (let i = 0; i < indices.length; i += 1) indices[i] = r.u32();
    r.expect("VERT");
    vertices = new Float32Array(vertexCount * 3);
    for (let i = 0; i < vertices.length; i += 1) vertices[i] = r.f32();
  } else if (method === "MG1") {
    r.expect("INDX");
    indices = r.packed(triangleCount, 3);
    restoreIndices(indices);
    r.expect("VERT");
    vertices = new Float32Array(r.packed(vertexCount * 3, 1).buffer);
  } else {
    r.expect("MG2H");
    const precision = r.f32();
    r.f32(); // normal precision
    const min = [r.f32(), r.f32(), r.f32()] as const;
    const max = [r.f32(), r.f32(), r.f32()] as const;
    const div = [r.u32(), r.u32(), r.u32()] as const;
    const cell = [0, 1, 2].map((i) => (max[i]! - min[i]!) / div[i]!);
    r.expect("VERT");
    const ints = r.packed(vertexCount, 3);
    r.expect("GIDX");
    const grid = r.packed(vertexCount, 1);
    for (let i = 1; i < vertexCount; i += 1)
      grid[i] = (grid[i]! + grid[i - 1]!) >>> 0;
    vertices = new Float32Array(vertexCount * 3);
    const yDiv = div[0];
    const zDiv = div[0] * div[1];
    let prevGrid = -1;
    let prevDx = 0;
    for (let i = 0; i < vertexCount; i += 1) {
      const g = grid[i]!;
      const gz = Math.floor(g / zDiv);
      const gy = Math.floor((g - gz * zDiv) / yDiv);
      const gx = g - gz * zDiv - gy * yDiv;
      let dx = ints[i * 3]!;
      if (g === prevGrid) dx += prevDx;
      vertices[i * 3] = precision * dx + gx * cell[0]! + min[0];
      vertices[i * 3 + 1] =
        precision * ints[i * 3 + 1]! + gy * cell[1]! + min[1];
      vertices[i * 3 + 2] =
        precision * ints[i * 3 + 2]! + gz * cell[2]! + min[2];
      prevGrid = g;
      prevDx = dx;
    }
    r.expect("INDX");
    indices = r.packed(triangleCount, 3);
    restoreIndices(indices);
  }
  for (const i of indices) {
    if (i >= vertexCount)
      throw new Error(`ctm: index ${i} beyond ${vertexCount} vertices`);
  }
  return { vertices, indices, comment, method };
}
