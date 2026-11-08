import type {
  Box3,
  BufferGeometry,
  Color,
  Mesh,
  ShaderMaterial,
  Texture,
} from "three";
import type * as ThreeModule from "three";
import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * The hologram as the holoviewer and the scale lineup draw it (ADR-012, ADR-015): colours close to
 * CIG's holoviewer, this project's own shaders, the model loader and the backdrop. Viewer-only
 * colours, not interface colours. Everything here runs in the browser after three.js loads.
 */

type Three = typeof ThreeModule;

export const HOLO = {
  background: [0.031, 0.075, 0.106],
  backgroundGlow: [0.07, 0.16, 0.22],
  base: [0.0, 0.07, 0.12],
  light: [0.28, 0.72, 0.92],
  rim: [0.55, 0.9, 1.0],
  scan: [0.45, 1.0, 0.7],
  line: [0.25, 0.81, 0.99],
} as const;

export const VERTEX = /* glsl */ `
  uniform vec3 uMin;
  uniform vec3 uSize;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vUnit;
  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-view.xyz);
    vUnit = (position - uMin) / uSize;
    gl_Position = projectionMatrix * view;
  }
`;

export const FRAGMENT = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uLight;
  uniform vec3 uRim;
  uniform vec3 uScan;
  uniform vec3 uLightDir;
  uniform vec3 uScanAt;
  uniform float uAppear;
  uniform float uXray;
  uniform float uGain;
  uniform float uTime;
  uniform float uDim;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vUnit;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x),
          mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
          mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float band(float at, float coord, float width) {
    if (at < 0.0 || at > 1.0) return 0.0;
    return smoothstep(width, 0.0, abs(coord - at));
  }

  void main() {
    // Materialise: noise over the hull against the appear front, with a bright seam at the edge.
    float n = noise(vUnit * 14.0) * 0.75 + noise(vUnit * 41.0) * 0.25;
    if (n > uAppear) discard;
    float seam = smoothstep(0.06, 0.0, uAppear - n) * step(uAppear, 0.999);

    vec3 normal = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
    float facing = abs(dot(normal, normalize(vView)));
    float rim = pow(1.0 - facing, 2.4);
    float lit = max(dot(normal, normalize(uLightDir)), 0.0);

    // Scan planes: a thin bright line with a softer wake, along each axis in turn.
    float scan =
      band(uScanAt.z, vUnit.z, 0.006) + band(uScanAt.x, vUnit.x, 0.006) + band(uScanAt.y, vUnit.y, 0.006);
    float wake =
      band(uScanAt.z, vUnit.z, 0.05) + band(uScanAt.x, vUnit.x, 0.05) + band(uScanAt.y, vUnit.y, 0.05);

    vec3 solid = (uBase + uLight * (0.12 + 0.88 * lit) + uRim * rim * 0.7) * uDim;
    vec3 ghost = uLight * (0.35 + rim * 1.1) * uDim;
    vec3 color = mix(solid, ghost, uXray) + uScan * (scan * 1.2 + wake * 0.18) + uRim * seam * 1.4;
    float alpha = mix(1.0, (0.025 + rim * 0.5 + scan * 0.6 + wake * 0.08) * uGain, uXray);
    gl_FragColor = vec4(color, alpha);
  }
`;

export const holoColor = (
  THREE: Three,
  c: readonly [number, number, number],
): Color => new THREE.Color(c[0], c[1], c[2]);

/** In view space: the light stays above and to the right of the camera, so the side in view is lit. */
export const HOLO_LIGHT: readonly [number, number, number] = [0.35, 0.8, 0.45];

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

/**
 * The hologram material for one model: `box` bounds its materialising noise and scan planes,
 * `gain` thins X-ray on dense meshes, `appear` starts the materialising (1 is whole), `dim` lights
 * a ship below full (the lineup's other ships).
 */
export function holoMaterial(
  THREE: Three,
  box: Box3,
  options: { gain: number; appear: number; dim?: number },
): ShaderMaterial {
  const extent = box.getSize(new THREE.Vector3());
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uMin: { value: box.min.clone() },
      uSize: {
        value: new THREE.Vector3(
          Math.max(extent.x, 1e-3),
          Math.max(extent.y, 1e-3),
          Math.max(extent.z, 1e-3),
        ),
      },
      uBase: { value: holoColor(THREE, HOLO.base) },
      uLight: { value: holoColor(THREE, HOLO.light) },
      uRim: { value: holoColor(THREE, HOLO.rim) },
      uScan: { value: holoColor(THREE, HOLO.scan) },
      uLightDir: { value: new THREE.Vector3(...HOLO_LIGHT).normalize() },
      uScanAt: { value: new THREE.Vector3(-1, -1, -1) },
      uAppear: { value: options.appear },
      uXray: { value: 0 },
      uGain: { value: options.gain },
      uTime: { value: 0 },
      uDim: { value: options.dim ?? 1 },
    },
    side: THREE.DoubleSide,
  });
}

/** The dark backdrop, lighter at the centre, painted once. */
export function holoBackdrop(THREE: Three): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const paint = canvas.getContext("2d");
  if (paint !== null) {
    const rgb = (c: readonly number[]) =>
      `rgb(${c.map((x) => Math.round(x * 255)).join(",")})`;
    const glow = paint.createRadialGradient(256, 230, 20, 256, 256, 360);
    glow.addColorStop(0, rgb(HOLO.backgroundGlow));
    glow.addColorStop(1, rgb(HOLO.background));
    paint.fillStyle = glow;
    paint.fillRect(0, 0, 512, 512);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
