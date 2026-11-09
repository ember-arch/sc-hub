import type {
  BufferGeometry,
  Color,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Scene,
} from "three";
import type * as ThreeModule from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * The holomodel in ink (ADR-020): RSI's holoviewer models drawn the almanac's way, a flat-shaded
 * body in a mid tone with its edges inked, on the page's own paper. The colours come from the
 * page's tokens at run time (`--bg-inset`, `--text-primary`, `--text-secondary`), so the light and
 * dark almanacs each draw the model in their own ink and no colour lives here. Everything in this
 * file runs in the browser after three.js loads; the model loader is shared with the lineup.
 */

type Three = typeof ThreeModule;

export interface InkPalette {
  /** The paper the model sits on: the page's inset surface. */
  readonly paper: Color;
  /** The body of the page's ship, and of a ship drawn dimmer beside it. */
  readonly body: Color;
  readonly bodyDim: Color;
  /** The ink of the edges, and the dimmer ink for the other ships and the ground line. */
  readonly ink: Color;
  readonly inkDim: Color;
}

/** Reads the palette from the element's computed tokens. */
export function inkPalette(THREE: Three, el: HTMLElement): InkPalette {
  const style = getComputedStyle(el);
  const read = (name: string, fallback: string): Color => {
    const value = style.getPropertyValue(name).trim();
    return new THREE.Color().setStyle(value === "" ? fallback : value);
  };
  const paper = read("--bg-inset", "#ebe4d6");
  const ink = read("--text-primary", "#1c1a16");
  const inkDim = read("--text-secondary", "#57534a");
  return {
    paper,
    ink,
    inkDim,
    body: paper.clone().lerp(ink, 0.42),
    bodyDim: paper.clone().lerp(ink, 0.22),
  };
}

/** The body: flat-shaded, matte, lit by the lights `inkLights` adds. */
export function inkBody(THREE: Three, color: Color): MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.85,
    metalness: 0.05,
    flatShading: true,
  });
}

/** The ink: thin lines along the body's edges. */
export function inkLine(
  THREE: Three,
  color: Color,
  opacity: number,
): LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
  });
}

/** The inked edges of a body, where faces meet at more than `angle` degrees. */
export function inkEdges(
  THREE: Three,
  geometry: BufferGeometry,
  material: LineBasicMaterial,
  angle = 28,
): LineSegments {
  return new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, angle),
    material,
  );
}

/**
 * Soft daylight from above with a key and a fill, so the flat shading reads as a drawing. The
 * lights are white; the ground bounce takes the palette's dim body tone, so no colour lives here.
 */
export function inkLights(
  THREE: Three,
  scene: Scene,
  ground: Color,
): () => void {
  const sky = new THREE.HemisphereLight(0xffffff, ground, 1.6);
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(3, 5, 2);
  const fill = new THREE.DirectionalLight(0xffffff, 0.4);
  fill.position.set(-4, 1, -3);
  scene.add(sky, key, fill);
  return () => {
    scene.remove(sky, key, fill);
    sky.dispose();
    key.dispose();
    fill.dispose();
  };
}

/** A glTF's quantized mesh as plain float geometry in metres, with smooth normals. */
export async function loadHoloGeometry(
  THREE: Three,
  loader: GLTFLoader,
  url: string,
): Promise<BufferGeometry> {
  const gltf = await loader.loadAsync(url);
  gltf.scene.updateMatrixWorld(true);
  let found: Mesh | null = null;
  gltf.scene.traverse((node) => {
    if (found === null && (node as Mesh).isMesh) found = node as Mesh;
  });
  const mesh = found as Mesh | null;
  if (mesh === null) throw new Error("no mesh");
  const source = mesh.geometry.getAttribute("position");
  const out = new Float32Array(source.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < source.count; i += 1) {
    v.fromBufferAttribute(source, i).applyMatrix4(mesh.matrixWorld);
    out[i * 3] = v.x;
    out[i * 3 + 1] = v.y;
    out[i * 3 + 2] = v.z;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(out, 3));
  geometry.setIndex(mesh.geometry.getIndex());
  geometry.computeVertexNormals();
  mesh.geometry.dispose();
  return geometry;
}
