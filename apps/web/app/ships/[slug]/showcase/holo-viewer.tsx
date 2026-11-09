"use client";

import { useEffect, useRef, useState } from "react";
import { TextLink } from "ui";
import {
  inkBody,
  inkEdges,
  inkLights,
  inkLine,
  inkPalette,
  loadHoloGeometry,
} from "./holo-kit";

/**
 * The holomodel (ADR-020; models from ADR-015): the model RSI's own pledge page loads into its
 * holoviewer, drawn in ink on the page's paper: a flat-shaded body with its edges inked, slowly
 * turning, with a person beside it for scale. Three renders: Ink (body and lines), Lines (the
 * edges alone, a drawing) and Solid (the body alone). Seven view angles turn the camera to the
 * ship's sides, top and bottom, or back to the slow turn. Drag to turn, scroll or pinch to zoom.
 *
 * This replaces the CIG-holoviewer look of ADR-012 and ADR-015 (glow, scan bands, floor grid,
 * dark backdrop): the almanac draws the model as a figure, in the page's own ink. three.js loads
 * only as the viewer approaches; the models are meshopt-compressed glTF.
 */

const VIEWS = [
  { id: "orbit", label: "Turning" },
  { id: "front", label: "Front" },
  { id: "back", label: "Back" },
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
  { id: "top", label: "Top" },
  { id: "bottom", label: "Bottom" },
] as const;
type View = (typeof VIEWS)[number]["id"];

const RENDERS = [
  { id: "ink", label: "Ink" },
  { id: "lines", label: "Lines" },
  { id: "solid", label: "Solid" },
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
  const [render, setRender] = useState<Render>("ink");
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
    "lab rounded-control border px-2 py-1 transition-colors duration-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
  const choice = (on: boolean) =>
    `${option} ${on ? "border-primary bg-primary text-page" : "border-hairline-strong bg-surface text-secondary hover:text-primary"}`;

  return (
    <figure className="m-0 flex flex-col">
      <div ref={frame} className={`flex flex-col ${full ? "bg-page p-4" : ""}`}>
        <div
          className={`relative w-full overflow-hidden border border-hairline-strong bg-inset ${full ? "min-h-0 flex-1" : "aspect-[4/3]"}`}
        >
          <div
            ref={box}
            role="img"
            aria-label={`3D model of the ${name}, from RSI's holoviewer, drawn in ink, with a person beside it for scale. Drag to turn, scroll or pinch to zoom.`}
            className="absolute inset-0"
          />
          {state === "ready" || poster === null ? null : (
            <img
              src={poster}
              alt=""
              // The frame is 4:3 and the image fills it; the size only reserves its box.
              width={1280}
              height={960}
              className="absolute inset-0 h-full w-full object-contain"
            />
          )}
          {state === "ready" ? null : (
            <p className="lab absolute bottom-3 left-3 m-0 text-secondary">
              {state === "error"
                ? "The model could not be loaded"
                : `Loading the holomodel (${megabytes} MB)`}
            </p>
          )}
          <div className="absolute left-3 top-3 flex flex-wrap gap-1">
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
          </div>
          <button
            type="button"
            className={`${option} absolute right-3 top-3 border-hairline-strong bg-surface text-primary hover:border-accent`}
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
        <fieldset className="m-0 flex flex-wrap items-center gap-1 border-0 border-x border-b border-hairline-strong bg-surface p-2">
          <legend className="sr-only">View</legend>
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
      </div>
      <figcaption className="flex flex-wrap justify-between gap-x-3 gap-y-1 pt-2 text-caption text-secondary">
        <span>
          <span className="lab text-primary">{label}</span> The holoviewer
          model, drawn in ink
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
  const palette = inkPalette(THREE, el);

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
  renderer.setClearColor(palette.paper, 1);
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.inset = "0";
  renderer.domElement.style.touchAction = "none";
  el.insertBefore(renderer.domElement, el.firstChild);

  const scene = new THREE.Scene();
  const removeLights = inkLights(THREE, scene);

  const body = inkBody(THREE, palette.body);
  const ink = inkLine(THREE, palette.ink, 0.6);
  const shipMesh = new THREE.Mesh(ship, body);
  const shipEdges = inkEdges(THREE, ship, ink);
  scene.add(shipMesh, shipEdges);

  // The person stands beside the ship's flank, a little ahead of midships, in dimmer ink.
  const personMaterials: {
    body: ReturnType<typeof inkBody>;
    ink: ReturnType<typeof inkLine>;
  } | null =
    person === null
      ? null
      : {
          body: inkBody(THREE, palette.bodyDim),
          ink: inkLine(THREE, palette.inkDim, 0.6),
        };
  let personEdges: ReturnType<typeof inkEdges> | null = null;
  if (person !== null && personMaterials !== null) {
    person.computeBoundingBox();
    const box = person.boundingBox!;
    person.translate(
      bounds.max.x + Math.max(size.x * 0.06, 1.5) - box.min.x,
      bounds.min.y - box.min.y,
      size.z * 0.12,
    );
    personEdges = inkEdges(THREE, person, personMaterials.ink, 40);
    scene.add(new THREE.Mesh(person, personMaterials.body), personEdges);
  }

  // The ground: one line under the keel, the length of the ship and a little more.
  const groundInk = inkLine(THREE, palette.inkDim, 0.5);
  const ground = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-size.x * 0.9, bounds.min.y, 0),
      new THREE.Vector3(size.x * 0.9, bounds.min.y, 0),
    ]),
    groundInk,
  );
  scene.add(ground);

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
  controls.autoRotateSpeed = 0.5;
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

  const setRender = (render: Render) => {
    shipMesh.visible = render !== "lines";
    shipEdges.visible = render !== "solid";
    if (personEdges !== null) personEdges.visible = render !== "solid";
  };
  setRender("ink");

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

  let frame = 0;
  const tick = () => {
    frame = requestAnimationFrame(tick);
    if (!visible) return;
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
      removeLights();
      ship.dispose();
      person?.dispose();
      shipEdges.geometry.dispose();
      personEdges?.geometry.dispose();
      body.dispose();
      ink.dispose();
      personMaterials?.body.dispose();
      personMaterials?.ink.dispose();
      ground.geometry.dispose();
      groundInk.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
