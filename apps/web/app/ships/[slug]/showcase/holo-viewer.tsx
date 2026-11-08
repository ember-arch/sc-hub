"use client";

import { useEffect, useRef, useState } from "react";
import { TextLink } from "ui";
import {
  HOLO,
  holoBackdrop,
  holoColor,
  holoMaterial,
  loadHoloGeometry,
} from "./holo-kit";

/**
 * The holoviewer (ADR-012, ADR-015): the model RSI's own pledge page loads into its holoviewer,
 * drawn the way that holoviewer draws it. The ship materialises out of noise, scan planes sweep it
 * nose to tail, across and up, and it settles as a lit cyan hologram over a floor grid with a
 * person beside it for scale. X-ray shows it translucent, bright at the silhouette; Wireframe
 * shows its edges. Seven view angles turn the camera to the ship's sides, top and bottom, or back
 * to a slow orbit. Drag to turn, scroll or pinch to zoom.
 *
 * CLAUDE.md section 2 rules out glow, scanlines and grids in the interface; the owner chose this
 * look for the model on 2026-11-08 because it reproduces CIG's holoviewer, and it stays inside
 * this canvas. The shaders are this project's own. three.js loads only as the viewer approaches;
 * the models are meshopt-compressed glTF, which three decodes without a separate decoder file.
 */

const VIEWS = [
  { id: "orbit", label: "Orbit" },
  { id: "front", label: "Front" },
  { id: "back", label: "Back" },
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
  { id: "top", label: "Top" },
  { id: "bottom", label: "Bottom" },
] as const;
type View = (typeof VIEWS)[number]["id"];

const RENDERS = [
  { id: "default", label: "Default" },
  { id: "xray", label: "X-ray" },
  { id: "wire", label: "Wireframe" },
] as const;
type Render = (typeof RENDERS)[number]["id"];

interface Api {
  setView(view: View): void;
  setRender(render: Render): void;
  dispose(): void;
}

export function HoloViewer({
  src,
  bytes,
  figure,
  name,
  length,
  poster,
  credit,
  label,
}: {
  readonly src: string;
  readonly bytes: number;
  readonly figure: { readonly src: string; readonly height: number } | null;
  readonly name: string;
  readonly length: number | null;
  readonly poster: string | null;
  readonly credit: { readonly text: string; readonly href: string };
  readonly label: string;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [view, setView] = useState<View>("orbit");
  const [render, setRender] = useState<Render>("default");
  const [full, setFull] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (el === null) return;
    let cancelled = false;
    const near = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting !== true) return;
        near.disconnect();
        setState("loading");
        void start(el, src, figure?.src ?? null, length)
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
  }, [src, figure?.src, length]);

  useEffect(() => api.current?.setView(view), [view, state]);
  useEffect(() => api.current?.setRender(render), [render, state]);
  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const megabytes = (bytes / 1_000_000).toLocaleString("en-US", {
    maximumFractionDigits: 1,
  });
  const option =
    "rounded-control border px-2 py-1 text-caption transition-colors duration-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
  const choice = (on: boolean) =>
    `${option} ${on ? "border-accent bg-accent-bg text-primary" : "border-hairline-strong text-secondary hover:text-primary"}`;

  return (
    <figure className="m-0 flex flex-col gap-2">
      <div
        ref={frame}
        className={`flex flex-col gap-2 ${full ? "bg-page p-4" : ""}`}
      >
        <div
          ref={box}
          className={`relative w-full overflow-hidden rounded-card border border-hairline bg-inset ${full ? "min-h-0 flex-1" : "aspect-[4/3]"}`}
          role="img"
          aria-label={`3D model of the ${name}, from RSI's holoviewer, with a person beside it for scale. Drag to turn, scroll or pinch to zoom.`}
        >
          {state === "ready" || poster === null ? null : (
            <img
              src={poster}
              alt=""
              // The frame is 4:3 and the image fills it; the size only reserves its box.
              width={1280}
              height={960}
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
          <button
            type="button"
            className={`${option} absolute right-2 top-2 border-hairline-strong bg-page text-primary hover:border-accent`}
            onClick={() => {
              const el = frame.current;
              if (el === null) return;
              if (document.fullscreenElement === null)
                void el.requestFullscreen?.().catch(() => undefined);
              else void document.exitFullscreen().catch(() => undefined);
            }}
          >
            {full ? "Exit full screen" : "Full screen"}
          </button>
        </div>
        <div className="flex flex-col gap-2">
          <fieldset className="m-0 flex flex-wrap items-center gap-1 border-0 p-0">
            <legend className="float-left mr-2 p-0 text-caption text-secondary">
              View
            </legend>
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                aria-pressed={view === v.id}
                className={choice(view === v.id)}
                onClick={() => setView(v.id)}
              >
                {v.label}
              </button>
            ))}
          </fieldset>
          <fieldset className="m-0 flex flex-wrap items-center gap-1 border-0 p-0">
            <legend className="float-left mr-2 p-0 text-caption text-secondary">
              Render
            </legend>
            {RENDERS.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={render === r.id}
                className={choice(render === r.id)}
                onClick={() => setRender(r.id)}
              >
                {r.label}
              </button>
            ))}
          </fieldset>
        </div>
      </div>
      <figcaption className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-caption text-secondary">
        <span>
          <span className="font-mono text-primary">{label}</span> Holoviewer
          model
          {length === null
            ? ""
            : `, to scale, ${length.toLocaleString("en-US")} m`}
          {figure === null
            ? ""
            : `, beside a person ${figure.height.toFixed(1)} m tall`}
        </span>
        <TextLink href={credit.href} external className="text-secondary">
          {credit.text}
        </TextLink>
      </figcaption>
    </figure>
  );
}

const ease = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

/** Builds the scene in `el` and returns its controls. Everything three.js is loaded here, lazily. */
async function start(
  el: HTMLDivElement,
  src: string,
  figureSrc: string | null,
  length: number | null,
): Promise<Api> {
  const THREE = await import("three");
  const { GLTFLoader } =
    await import("three/examples/jsm/loaders/GLTFLoader.js");
  const { MeshoptDecoder } =
    await import("three/examples/jsm/libs/meshopt_decoder.module.js");
  const { OrbitControls } =
    await import("three/examples/jsm/controls/OrbitControls.js");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

  const load = (url: string) => loadHoloGeometry(THREE, loader, url);

  const ship = await load(src);
  const person =
    figureSrc === null ? null : await load(figureSrc).catch(() => null);

  ship.computeBoundingBox();
  const shipBox = ship.boundingBox!;
  const centre = shipBox.getCenter(new THREE.Vector3());
  ship.translate(-centre.x, -centre.y, -centre.z);
  // RSI's files are not all to scale (its holoviewer fits each to the frame): the Odin's is half
  // size, the Polaris's two fifths. Scale to the length on record so the person beside it is true.
  const modelLength = shipBox.max.z - shipBox.min.z;
  if (length !== null && length > 0 && modelLength > 0) {
    const k = length / modelLength;
    ship.scale(k, k, k);
  }
  ship.computeBoundingBox();
  const bounds = ship.boundingBox!;
  const size = bounds.getSize(new THREE.Vector3());

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(el.clientWidth, el.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.inset = "0";
  renderer.domElement.style.touchAction = "none";
  el.insertBefore(renderer.domElement, el.firstChild);

  const scene = new THREE.Scene();
  const backdropTexture = holoBackdrop(THREE);
  scene.background = backdropTexture;

  const color = (c: readonly [number, number, number]) => holoColor(THREE, c);
  const material = (box: InstanceType<typeof THREE.Box3>, gain: number) =>
    holoMaterial(THREE, box, { gain, appear: reduced ? 1 : 0 });
  // Dense meshes stack more translucent layers in X-ray; scale them so they stay cyan, not white.
  const vertexCount = ship.getAttribute("position").count;
  const shipMaterial = material(
    bounds,
    Math.min(1, Math.sqrt(220_000 / Math.max(vertexCount, 1))),
  );
  const shipMesh = new THREE.Mesh(ship, shipMaterial);
  scene.add(shipMesh);

  // The person stands on the floor beside the ship's flank, a little ahead of midships.
  let personMaterial: InstanceType<typeof THREE.ShaderMaterial> | null = null;
  if (person !== null) {
    person.computeBoundingBox();
    const box = person.boundingBox!;
    person.translate(
      bounds.max.x + Math.max(size.x * 0.06, 1.5) - box.min.x,
      bounds.min.y - box.min.y,
      size.z * 0.12,
    );
    person.computeBoundingBox();
    personMaterial = material(person.boundingBox!, 1);
    scene.add(new THREE.Mesh(person, personMaterial));
  }

  // Floor grid at the keel, in round metres.
  const span = Math.max(size.x, size.z) * 1.35;
  const step = [1, 2, 5, 10, 20, 50, 100].find((s) => span / s <= 40) ?? 200;
  const cells = Math.ceil(span / step);
  const grid = new THREE.GridHelper(
    cells * step,
    cells,
    color(HOLO.line),
    color(HOLO.line),
  );
  const gridMaterial = grid.material as InstanceType<
    typeof THREE.LineBasicMaterial
  >;
  gridMaterial.transparent = true;
  gridMaterial.opacity = 0.08;
  gridMaterial.depthWrite = false;
  grid.position.y = bounds.min.y;
  scene.add(grid);

  // Wireframe edges, built the first time they are asked for.
  let edges: InstanceType<typeof THREE.LineSegments> | null = null;
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: color(HOLO.line),
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const fov = 30;
  const camera = new THREE.PerspectiveCamera(
    fov,
    el.clientWidth / el.clientHeight,
    size.length() / 400,
    size.length() * 30,
  );
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotateSpeed = 0.6;
  controls.minDistance = size.length() * 0.15;
  controls.maxDistance = size.length() * 6;

  /** Far enough that a box `w` wide and `h` tall fits the frame with a margin. */
  const fit = (w: number, h: number): number => {
    const aspect = el.clientWidth / Math.max(el.clientHeight, 1);
    const t = Math.tan(((fov / 2) * Math.PI) / 180);
    return (Math.max(h, w / aspect) / (2 * t)) * 1.18;
  };
  // RSI's models point their nose down -Z; "front" looks at the nose.
  const poses: Record<View, () => InstanceType<typeof THREE.Vector3>> = {
    // Three-quarters from the front and above, far enough that the whole ship stays in frame as
    // it turns: its bounding sphere fits the narrower side of the frame.
    orbit: () =>
      new THREE.Vector3(0.62, 0.42, -0.66)
        .normalize()
        .multiplyScalar(
          ((size.length() / 2 / Math.sin(((fov / 2) * Math.PI) / 180)) * 0.8) /
            Math.min(1, el.clientWidth / Math.max(el.clientHeight, 1)),
        ),
    front: () =>
      new THREE.Vector3(0, 0, -1).multiplyScalar(
        fit(size.x, size.y) + size.z / 2,
      ),
    back: () =>
      new THREE.Vector3(0, 0, 1).multiplyScalar(
        fit(size.x, size.y) + size.z / 2,
      ),
    left: () =>
      new THREE.Vector3(-1, 0, 0).multiplyScalar(
        fit(size.z, size.y) + size.x / 2,
      ),
    right: () =>
      new THREE.Vector3(1, 0, 0).multiplyScalar(
        fit(size.z, size.y) + size.x / 2,
      ),
    top: () =>
      new THREE.Vector3(0, 1, 0.0001).multiplyScalar(
        fit(size.x, size.z) + size.y / 2,
      ),
    bottom: () =>
      new THREE.Vector3(0, -1, 0.0001).multiplyScalar(
        fit(size.x, size.z) + size.y / 2,
      ),
  };
  camera.position.copy(poses.orbit());
  controls.autoRotate = !reduced;

  let tween: {
    from: InstanceType<typeof THREE.Vector3>;
    to: InstanceType<typeof THREE.Vector3>;
    target: InstanceType<typeof THREE.Vector3>;
    began: number;
  } | null = null;
  let current: View = "orbit";
  controls.addEventListener("start", () => {
    controls.autoRotate = false;
    tween = null;
  });

  let xrayTarget = 0;
  const setRender = (render: Render) => {
    xrayTarget = render === "default" ? 0 : 1;
    const wire = render === "wire";
    if (wire && edges === null) {
      edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(ship, 24),
        edgeMaterial,
      );
      scene.add(edges);
    }
    if (edges !== null) edges.visible = wire;
    shipMaterial.uniforms["uGain"]!.value =
      Math.min(1, Math.sqrt(220_000 / Math.max(vertexCount, 1))) *
      (wire ? 0.35 : 1);
    for (const m of [shipMaterial, personMaterial]) {
      if (m === null) continue;
      m.transparent = xrayTarget === 1;
      m.depthWrite = xrayTarget === 0;
      m.blending =
        xrayTarget === 1 ? THREE.AdditiveBlending : THREE.NormalBlending;
      m.needsUpdate = true;
    }
    grid.visible = true;
  };
  setRender("default");

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

  // Materialise over 1.4 s, then sweep a scan plane along the length, the beam and the height.
  const clock = new THREE.Clock();
  const appearFor = 1.4;
  const sweepFor = 1.3;
  let xray = 0;
  let frame = 0;
  const tick = () => {
    frame = requestAnimationFrame(tick);
    if (!visible) return;
    const t = clock.getElapsedTime();
    const mats = [shipMaterial, personMaterial].filter(
      (m): m is InstanceType<typeof THREE.ShaderMaterial> => m !== null,
    );
    if (!reduced) {
      const appear = Math.min(1, t / appearFor);
      const s = (t - appearFor) / sweepFor;
      const scan = new THREE.Vector3(
        s >= 1 && s < 2 ? s - 1 : -1,
        s >= 2 && s < 3 ? s - 2 : -1,
        s >= 0 && s < 1 ? s : -1,
      );
      for (const m of mats) {
        m.uniforms["uAppear"]!.value = 1.02 * (1 - (1 - appear) ** 3);
        m.uniforms["uScanAt"]!.value.copy(scan);
      }
    }
    xray += (xrayTarget - xray) * (reduced ? 1 : 0.15);
    for (const m of mats) {
      m.uniforms["uXray"]!.value = xray;
      m.uniforms["uTime"]!.value = t;
    }
    if (tween !== null) {
      const k = Math.min(1, (performance.now() - tween.began) / 900);
      camera.position.lerpVectors(tween.from, tween.to, ease(k));
      controls.target.copy(tween.target);
      if (k >= 1) {
        tween = null;
        controls.autoRotate = current === "orbit" && !reduced;
      }
    }
    controls.update();
    renderer.render(scene, camera);
  };
  tick();

  return {
    setView(view) {
      current = view;
      const to = poses[view]();
      controls.autoRotate = false;
      if (reduced) {
        camera.position.copy(to);
        controls.target.set(0, 0, 0);
        controls.autoRotate = false;
        return;
      }
      tween = {
        from: camera.position.clone(),
        to,
        target: new THREE.Vector3(0, 0, 0),
        began: performance.now(),
      };
    },
    setRender,
    dispose() {
      cancelAnimationFrame(frame);
      onScreen.disconnect();
      resize.disconnect();
      controls.dispose();
      ship.dispose();
      person?.dispose();
      (
        edges as InstanceType<typeof THREE.LineSegments> | null
      )?.geometry.dispose();
      shipMaterial.dispose();
      personMaterial?.dispose();
      edgeMaterial.dispose();
      gridMaterial.dispose();
      grid.geometry.dispose();
      backdropTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
