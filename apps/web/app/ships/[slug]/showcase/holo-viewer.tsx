"use client";

import { useEffect, useRef, useState } from "react";
import { TextLink } from "ui";

/**
 * The holoviewer (ADR-012): CIG's in-game holoviewer model drawn the way RSI's own holoviewer
 * draws it, as a hologram: translucent, bright at the silhouette, horizontal scan bands drifting
 * up the hull, a faint flicker, edge lines and a projector ring underneath. "Solid" shows the same
 * model as a lit gunmetal render. Drag to orbit, scroll or pinch to zoom.
 *
 * CLAUDE.md section 2 rules out glow and scanlines in the interface; the owner chose this look for
 * the model itself on 2026-11-08 because it reproduces CIG's holoviewer. It stays inside this
 * canvas. three.js loads only as the viewer approaches; the Draco decoder comes from /media/draco.
 */

/** Close to the cyan of CIG's holoviewer. Viewer-only, not an interface colour (ADR-012). */
const HOLO = [0.36, 0.83, 1.0] as const;

type Mode = "hologram" | "solid";

interface Api {
  setMode(mode: Mode): void;
  setSpin(spin: boolean): void;
  reset(): void;
  dispose(): void;
}

const HOLO_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vHeight;
  uniform float uMinY;
  uniform float uSpanY;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec4 view = viewMatrix * world;
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-view.xyz);
    vHeight = (world.y - uMinY) / uSpanY;
    gl_Position = projectionMatrix * view;
  }
`;

const HOLO_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uMotion;
  uniform float uGain;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vHeight;
  void main() {
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    float rim = pow(1.0 - facing, 2.2);
    float bands = smoothstep(0.55, 1.0, sin((vHeight * 90.0 - uTime * 1.6 * uMotion) * 3.14159));
    float sweep = smoothstep(0.0, 0.04, 0.04 - abs(fract(vHeight - uTime * 0.12 * uMotion) - 0.5) * 0.08);
    float flicker = 1.0 - 0.06 * uMotion * step(0.97, fract(sin(floor(uTime * 12.0)) * 43758.5453));
    float alpha = (0.018 + rim * 0.42 + bands * 0.035 + sweep * 0.14) * flicker;
    vec3 color = uColor * (0.45 + rim * 0.9 + sweep * 0.5);
    gl_FragColor = vec4(color, alpha * uGain);
  }
`;

export function HoloViewer({
  src,
  bytes,
  name,
  length,
  poster,
  credit,
  label,
}: {
  readonly src: string;
  readonly bytes: number;
  readonly name: string;
  readonly length: number | null;
  readonly poster: string | null;
  readonly credit: { readonly text: string; readonly href: string };
  readonly label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [mode, setMode] = useState<Mode>("hologram");
  const [spin, setSpin] = useState(true);

  useEffect(() => {
    const el = box.current;
    if (el === null) return;
    let cancelled = false;
    const near = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting !== true) return;
        near.disconnect();
        setState("loading");
        void start(el, src)
          .then((made) => {
            if (cancelled) {
              made.dispose();
              return;
            }
            api.current = made;
            setState("ready");
          })
          .catch(() => setState("error"));
      },
      { rootMargin: "300px 0px" },
    );
    near.observe(el);
    return () => {
      cancelled = true;
      near.disconnect();
      api.current?.dispose();
      api.current = null;
    };
  }, [src]);

  useEffect(() => api.current?.setMode(mode), [mode, state]);
  useEffect(() => api.current?.setSpin(spin), [spin, state]);

  const button =
    "rounded-control border border-hairline-strong px-2 py-1 text-caption text-primary transition-colors duration-hover hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
  const megabytes = (bytes / 1_000_000).toLocaleString("en-US", {
    maximumFractionDigits: 1,
  });

  return (
    <figure className="m-0 flex flex-col gap-2">
      <div
        ref={box}
        className="relative aspect-[4/3] w-full overflow-hidden rounded-card border border-hairline bg-inset"
        role="img"
        aria-label={`3D model of the ${name}${mode === "hologram" ? ", shown as a hologram" : ""}. Drag to rotate, scroll or pinch to zoom.`}
      >
        {state === "ready" || poster === null ? null : (
          <img
            src={poster}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-40"
          />
        )}
        {state === "ready" ? null : (
          <p className="absolute bottom-3 left-3 m-0 text-caption text-secondary">
            {state === "error"
              ? "The model could not be loaded."
              : `Loading the model (${megabytes} MB)`}
          </p>
        )}
        <div className="absolute right-2 top-2 flex gap-1">
          <button
            type="button"
            className={button}
            aria-pressed={mode === "hologram"}
            onClick={() =>
              setMode((m) => (m === "hologram" ? "solid" : "hologram"))
            }
          >
            {mode === "hologram" ? "Solid" : "Hologram"}
          </button>
          <button
            type="button"
            className={button}
            aria-pressed={spin}
            onClick={() => setSpin((s) => !s)}
          >
            {spin ? "Stop" : "Spin"}
          </button>
          <button
            type="button"
            className={button}
            onClick={() => api.current?.reset()}
          >
            Reset
          </button>
        </div>
      </div>
      <figcaption className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-caption text-secondary">
        <span>
          <span className="font-mono text-primary">{label}</span> Holoviewer
          model
          {length === null
            ? ""
            : `, to scale, ${length.toLocaleString("en-US")} m`}
        </span>
        <TextLink href={credit.href} external className="text-secondary">
          {credit.text}
        </TextLink>
      </figcaption>
    </figure>
  );
}

/** Builds the scene in `el` and returns its controls. Everything three.js is loaded here, lazily. */
async function start(el: HTMLDivElement, src: string): Promise<Api> {
  const THREE = await import("three");
  const { GLTFLoader } =
    await import("three/examples/jsm/loaders/GLTFLoader.js");
  const { DRACOLoader } =
    await import("three/examples/jsm/loaders/DRACOLoader.js");
  const { OrbitControls } =
    await import("three/examples/jsm/controls/OrbitControls.js");
  const { RoomEnvironment } =
    await import("three/examples/jsm/environments/RoomEnvironment.js");

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(el.clientWidth, el.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.inset = "0";
  renderer.domElement.style.touchAction = "none";
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const draco = new DRACOLoader().setDecoderPath("/media/draco/");
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const gltf = await loader.loadAsync(src);
  const model = gltf.scene;

  // Centre the ship on the origin, keep metres.
  const bounds = new THREE.Box3().setFromObject(model);
  const centre = bounds.getCenter(new THREE.Vector3());
  model.position.sub(centre);
  bounds.setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const radius = size.length() / 2;

  const holo = new THREE.ShaderMaterial({
    vertexShader: HOLO_VERTEX,
    fragmentShader: HOLO_FRAGMENT,
    uniforms: {
      uColor: { value: new THREE.Color(...HOLO) },
      uTime: { value: 0 },
      uMotion: { value: reduced ? 0 : 1 },
      uMinY: { value: bounds.min.y },
      uSpanY: { value: Math.max(size.y, 1e-3) },
      // Dense meshes stack more translucent layers; scale the glow so they stay cyan, not white.
      uGain: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const solid = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.46, 0.49, 0.54),
    metalness: 0.72,
    roughness: 0.38,
    envMap: environment,
    side: THREE.DoubleSide,
  });
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color(...HOLO),
    transparent: true,
    opacity: 0.1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const meshes: InstanceType<typeof THREE.Mesh>[] = [];
  model.traverse((node) => {
    if ((node as InstanceType<typeof THREE.Mesh>).isMesh)
      meshes.push(node as InstanceType<typeof THREE.Mesh>);
  });
  // Edge lines read as the hologram's structure; skipped on very dense meshes to keep it quick.
  const vertexCount = meshes.reduce(
    (n, m) => n + (m.geometry.getAttribute("position")?.count ?? 0),
    0,
  );
  holo.uniforms["uGain"]!.value = Math.min(
    1,
    Math.sqrt(200_000 / Math.max(vertexCount, 1)),
  );
  const edges: InstanceType<typeof THREE.LineSegments>[] = [];
  if (vertexCount < 700_000) {
    for (const mesh of meshes) {
      const line = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry, 28),
        edgeMaterial,
      );
      mesh.add(line);
      edges.push(line);
    }
  }

  // Projector ring under the ship, like the holoviewer's base.
  const ringRadius = Math.max(size.x, size.z) * 0.62;
  const base = new THREE.Group();
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(...HOLO),
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (const [inner, outer, opacity] of [
    [0.98, 1.0, 0.5],
    [0.7, 0.705, 0.25],
    [0.4, 0.403, 0.18],
  ] as const) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(ringRadius * inner, ringRadius * outer, 128),
      ringMaterial.clone(),
    );
    (ring.material as InstanceType<typeof THREE.MeshBasicMaterial>).opacity =
      opacity;
    ring.rotation.x = -Math.PI / 2;
    base.add(ring);
  }
  base.position.y = bounds.min.y - size.y * 0.25;
  scene.add(base);
  scene.add(model);

  const camera = new THREE.PerspectiveCamera(
    32,
    el.clientWidth / el.clientHeight,
    radius / 100,
    radius * 40,
  );
  // Far enough that the bounding sphere fits the narrower side of the frame, from three-quarters above.
  const fitDistance =
    (radius /
      Math.sin(((32 / 2) * Math.PI) / 180) /
      Math.min(1, el.clientWidth / el.clientHeight)) *
    0.72;
  const home = new THREE.Vector3(-0.55, 0.38, 0.74)
    .normalize()
    .multiplyScalar(fitDistance);
  camera.position.copy(home);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = radius * 0.6;
  controls.maxDistance = fitDistance * 3;
  controls.autoRotateSpeed = 0.7;
  controls.autoRotate = !reduced;
  controls.addEventListener("start", () => {
    controls.autoRotate = false;
  });

  const light = new THREE.DirectionalLight(0xffffff, 1.4);
  light.position.set(radius, radius * 2, radius);
  scene.add(light, new THREE.AmbientLight(0xffffff, 0.25));

  let mode: Mode = "hologram";
  const apply = () => {
    for (const mesh of meshes)
      mesh.material = mode === "hologram" ? holo : solid;
    for (const line of edges) line.visible = mode === "hologram";
    base.visible = mode === "hologram";
    scene.environment = mode === "solid" ? environment : null;
  };
  apply();

  let visible = true;
  const onScreen = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting === true;
  });
  onScreen.observe(el);
  const resize = new ResizeObserver(() => {
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  resize.observe(el);

  const clock = new THREE.Clock();
  let frame = 0;
  const tick = () => {
    frame = requestAnimationFrame(tick);
    if (!visible) return;
    holo.uniforms["uTime"]!.value = clock.getElapsedTime();
    controls.update();
    renderer.render(scene, camera);
  };
  tick();

  return {
    setMode(next) {
      mode = next;
      apply();
    },
    setSpin(spin) {
      controls.autoRotate = spin && !reduced;
    },
    reset() {
      camera.position.copy(home);
      controls.target.set(0, 0, 0);
      controls.update();
    },
    dispose() {
      cancelAnimationFrame(frame);
      onScreen.disconnect();
      resize.disconnect();
      controls.dispose();
      draco.dispose();
      pmrem.dispose();
      model.traverse((node) => {
        const mesh = node as InstanceType<typeof THREE.Mesh>;
        if (
          mesh.isMesh ||
          (node as InstanceType<typeof THREE.LineSegments>).isLineSegments
        ) {
          mesh.geometry.dispose();
        }
      });
      holo.dispose();
      solid.dispose();
      edgeMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
