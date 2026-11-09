/**
 * Packs an RSI holoviewer mesh (ADR-015) into a compact binary glTF: positions in metres,
 * quantized to 16 bits on one uniform scale (KHR_mesh_quantization), vertices reordered for the
 * GPU's cache, and both streams compressed with meshoptimizer (EXT_meshopt_compression), which
 * three.js decodes without a separate decoder file. Normals are left out; the viewer derives them.
 */
import { MeshoptEncoder } from "meshoptimizer";
import type { CtmMesh } from "./ctm.js";

/** RSI's holoviewer models are in centimetres. */
export const CTM_UNIT_METRES = 0.01;

const align4 = (n: number): number => (n + 3) & ~3;

export interface PackedModel {
  readonly glb: Uint8Array;
  /** The model's size in metres: width (x), height (y), length (z). */
  readonly size: readonly [number, number, number];
  readonly vertices: number;
  readonly triangles: number;
}

export async function packHoloModel(mesh: CtmMesh): Promise<PackedModel> {
  await MeshoptEncoder.ready;
  const indices = new Uint32Array(mesh.indices);
  const [remap, unique] = MeshoptEncoder.reorderMesh(indices, true, true);

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const metres = new Float32Array(unique * 3);
  const vertexCount = mesh.vertices.length / 3;
  for (let i = 0; i < vertexCount; i += 1) {
    const to = remap[i]!;
    if (to === 0xffffffff) continue;
    for (let k = 0; k < 3; k += 1) {
      const v = mesh.vertices[i * 3 + k]! * CTM_UNIT_METRES;
      metres[to * 3 + k] = v;
      if (v < min[k]!) min[k] = v;
      if (v > max[k]!) max[k] = v;
    }
  }
  const extent = Math.max(
    max[0]! - min[0]!,
    max[1]! - min[1]!,
    max[2]! - min[2]!,
  );
  const step = extent / 65535;
  const quantized = new Uint16Array(unique * 4);
  const qmin = [65535, 65535, 65535];
  const qmax = [0, 0, 0];
  for (let i = 0; i < unique; i += 1) {
    for (let k = 0; k < 3; k += 1) {
      const q = Math.round((metres[i * 3 + k]! - min[k]!) / step);
      quantized[i * 4 + k] = q;
      if (q < qmin[k]!) qmin[k] = q;
      if (q > qmax[k]!) qmax[k] = q;
    }
  }

  const wide = unique > 65535;
  const indexSize = wide ? 4 : 2;
  const indexBytes = wide
    ? new Uint8Array(indices.buffer)
    : new Uint8Array(Uint16Array.from(indices).buffer);
  const vertexBytes = new Uint8Array(quantized.buffer);
  const packedVertices = MeshoptEncoder.encodeGltfBuffer(
    vertexBytes,
    unique,
    8,
    "ATTRIBUTES",
  );
  const packedIndices = MeshoptEncoder.encodeGltfBuffer(
    indexBytes,
    indices.length,
    indexSize,
    "TRIANGLES",
  );

  const indexAt = align4(packedVertices.length);
  const binLength = align4(indexAt + packedIndices.length);
  const fallbackIndexAt = align4(vertexBytes.length);
  const json = {
    asset: { version: "2.0", generator: "sc-hub scripts/media (ADR-015)" },
    extensionsUsed: ["EXT_meshopt_compression", "KHR_mesh_quantization"],
    extensionsRequired: ["EXT_meshopt_compression", "KHR_mesh_quantization"],
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [
      {
        mesh: 0,
        translation: min,
        scale: [step, step, step],
      },
    ],
    meshes: [
      { primitives: [{ attributes: { POSITION: 0 }, indices: 1, mode: 4 }] },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5123,
        count: unique,
        type: "VEC3",
        min: qmin,
        max: qmax,
      },
      {
        bufferView: 1,
        componentType: wide ? 5125 : 5123,
        count: indices.length,
        type: "SCALAR",
      },
    ],
    bufferViews: [
      {
        buffer: 1,
        byteOffset: 0,
        byteLength: vertexBytes.length,
        byteStride: 8,
        target: 34962,
        extensions: {
          EXT_meshopt_compression: {
            buffer: 0,
            byteOffset: 0,
            byteLength: packedVertices.length,
            byteStride: 8,
            count: unique,
            mode: "ATTRIBUTES",
          },
        },
      },
      {
        buffer: 1,
        byteOffset: fallbackIndexAt,
        byteLength: indexBytes.length,
        target: 34963,
        extensions: {
          EXT_meshopt_compression: {
            buffer: 0,
            byteOffset: indexAt,
            byteLength: packedIndices.length,
            byteStride: indexSize,
            count: indices.length,
            mode: "TRIANGLES",
          },
        },
      },
    ],
    buffers: [
      { byteLength: binLength },
      {
        byteLength: align4(fallbackIndexAt + indexBytes.length),
        extensions: { EXT_meshopt_compression: { fallback: true } },
      },
    ],
  };

  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = align4(jsonBytes.length);
  const total = 12 + 8 + jsonLength + 8 + binLength;
  const glb = new Uint8Array(total);
  const view = new DataView(glb.buffer);
  view.setUint32(0, 0x46546c67, true); // "glTF"
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true); // "JSON"
  glb.set(jsonBytes, 20);
  glb.fill(0x20, 20 + jsonBytes.length, 20 + jsonLength);
  const binAt = 20 + jsonLength;
  view.setUint32(binAt, binLength, true);
  view.setUint32(binAt + 4, 0x004e4942, true); // "BIN"
  glb.set(packedVertices, binAt + 8);
  glb.set(packedIndices, binAt + 8 + indexAt);
  return {
    glb,
    size: [max[0]! - min[0]!, max[1]! - min[1]!, max[2]! - min[2]!],
    vertices: unique,
    triangles: indices.length / 3,
  };
}
