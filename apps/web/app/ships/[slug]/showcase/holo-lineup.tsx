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
 * The Scale section's lineup (ADR-015, drawn in ink per ADR-020): every ship on record that has an
 * RSI holoviewer model, each scaled to its recorded length and standing in profile on one ground
 * line, largest first, with a person beside the smallest. The page's ship is drawn in full ink;
 * the others dimmer. Labels name each ship and its length; the buttons below fly the camera to
 * any one ship or back to the whole line. Drag to turn, scroll or pinch to zoom.
 */

export interface LineupShip {
  readonly slug: string;
  readonly name: string;
  /** Length on record, in metres; the model is scaled to it. */
  readonly length: number;
  readonly src: string;
  readonly bytes: number;
  readonly current: boolean;
}

/** "around": the page's ship with the next larger one and every smaller one; "all": the row. */
type Focus = "around" | "all" | string;

interface Api {
  focus(focus: Focus): void;
  dispose(): void;
}

const n0 = (v: number): string =>
  v.toLocaleString("en-US", { maximumFractionDigits: v < 100 ? 1 : 0 });

export function HoloLineup({
  ships,
  figure,
  label,
  credit,
}: {
  readonly ships: readonly LineupShip[];
  readonly figure: { readonly src: string; readonly height: number } | null;
  readonly label: string;
  readonly credit: { readonly text: string; readonly href: string };
}) {
  const frame = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [full, setFull] = useState(false);
  const order = [...ships].sort((a, b) => b.length - a.length);
  const current = ships.find((s) => s.current);
  const bytes = ships.reduce((n, s) => n + s.bytes, 0);
  // The largest ship's neighbourhood is the whole row.
  const largest = current !== undefined && order[0]?.slug === current.slug;
  const [focus, setFocus] = useState<Focus>(largest ? "all" : "around");

  useEffect(() => {
    const el = box.current;
    const tags = labels.current;
    if (el === null || tags === null) return;
    let cancelled = false;
    const near = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting !== true) return;
        near.disconnect();
        setState("loading");
        void start(el, tags, ships, figure?.src ?? null)
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
  }, [ships, figure?.src]);

  useEffect(() => api.current?.focus(focus), [focus, state]);
  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

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
          className={`relative w-full overflow-hidden border border-hairline-strong bg-inset ${full ? "min-h-0 flex-1" : "aspect-video lg:aspect-[2/1]"}`}
        >
          <div
            ref={box}
            role="img"
            aria-label={`To scale, from RSI's holoviewer models: ${order.map((s) => `${s.name} ${n0(s.length)} m`).join(", ")}${figure === null ? "" : `, and a person ${figure.height.toFixed(1)} m tall`}.`}
            className="absolute inset-0"
          />
          <div
            ref={labels}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10"
          />
          {state === "ready" ? null : (
            <p className="absolute bottom-3 left-3 m-0 text-caption text-secondary">
              {state === "error"
                ? "The models could not be loaded."
                : `Loading ${ships.length} models (${(bytes / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 })} MB)`}
            </p>
          )}
          <button
            type="button"
            className={`${option} absolute right-2 top-2 z-20 border-hairline-strong bg-page text-primary hover:border-accent`}
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
        <fieldset className="m-0 flex flex-wrap items-center gap-1 border-0 p-0">
          <legend className="float-left mr-2 p-0 text-caption text-secondary">
            Look at
          </legend>
          {current === undefined || largest ? null : (
            <button
              type="button"
              aria-pressed={focus === "around"}
              className={choice(focus === "around")}
              onClick={() => setFocus("around")}
            >
              Around the {current.name}
            </button>
          )}
          <button
            type="button"
            aria-pressed={focus === "all"}
            className={choice(focus === "all")}
            onClick={() => setFocus("all")}
          >
            All ships
          </button>
          {order.map((s) => (
            <button
              key={s.slug}
              type="button"
              aria-pressed={focus === s.slug}
              className={choice(focus === s.slug)}
              onClick={() => setFocus(s.slug)}
            >
              <span className={s.current ? "text-accent" : undefined}>
                {s.name}
              </span>{" "}
              <span className="font-mono">{n0(s.length)} m</span>
            </button>
          ))}
        </fieldset>
      </div>
      <figcaption className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-caption text-secondary">
        <span>
          <span className="font-mono text-primary">{label}</span> To scale: the{" "}
          {current?.name ?? "ship"} beside the other ships on record
          {figure === null ? "" : " and a person"}, each RSI holoviewer model
          sized to its recorded length
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

async function start(
  el: HTMLDivElement,
  tags: HTMLDivElement,
  ships: readonly LineupShip[],
  figureSrc: string | null,
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

  const order = [...ships].sort((a, b) => b.length - a.length);
  const [geometries, person] = await Promise.all([
    Promise.all(order.map((s) => loadHoloGeometry(THREE, loader, s.src))),
    figureSrc === null
      ? Promise.resolve(null)
      : loadHoloGeometry(THREE, loader, figureSrc).catch(() => null),
  ]);

  // Each ship: scaled to its recorded length, turned so its nose points along +X, keel on the
  // floor. Then in a row, largest first, with gaps that keep the small ships near each other.
  const placed: {
    ship: LineupShip;
    x: number;
    top: number;
    length: number;
  }[] = [];
  let cursor = 0;
  const meshes: InstanceType<typeof THREE.Mesh>[] = [];
  const lines: InstanceType<typeof THREE.LineSegments>[] = [];
  const materials: InstanceType<typeof THREE.Material>[] = [];
  const fullBody = inkBody(THREE, palette.body);
  const dimBody = inkBody(THREE, palette.bodyDim);
  const fullInk = inkLine(THREE, palette.ink, 0.6);
  const dimInk = inkLine(THREE, palette.inkDim, 0.45);
  materials.push(fullBody, dimBody, fullInk, dimInk);
  let tallest = 0;
  let widest = 0;
  order.forEach((ship, i) => {
    const g = geometries[i]!;
    g.computeBoundingBox();
    const b = g.boundingBox!;
    const c = b.getCenter(new THREE.Vector3());
    g.translate(-c.x, -c.y, -c.z);
    const modelLength = b.max.z - b.min.z;
    const k = modelLength > 0 ? ship.length / modelLength : 1;
    g.scale(k, k, k);
    g.rotateY(-Math.PI / 2);
    g.computeBoundingBox();
    const placedBox = g.boundingBox!;
    g.translate(cursor - placedBox.min.x, -placedBox.min.y, 0);
    g.computeBoundingBox();
    const box = g.boundingBox!;
    const size = box.getSize(new THREE.Vector3());
    tallest = Math.max(tallest, size.y);
    widest = Math.max(widest, size.z);
    placed.push({
      ship,
      x: (box.min.x + box.max.x) / 2,
      top: box.max.y,
      length: size.x,
    });
    const next = order[i + 1];
    cursor =
      box.max.x +
      Math.max(2, 0.22 * Math.min(ship.length, next?.length ?? ship.length));
    meshes.push(new THREE.Mesh(g, ship.current ? fullBody : dimBody));
    lines.push(inkEdges(THREE, g, ship.current ? fullInk : dimInk));
  });
  let rowEnd = cursor;
  if (person !== null) {
    person.computeBoundingBox();
    const pb = person.boundingBox!;
    person.translate(cursor - pb.min.x, -pb.min.y, -(pb.min.z + pb.max.z) / 2);
    person.computeBoundingBox();
    meshes.push(new THREE.Mesh(person, dimBody));
    lines.push(inkEdges(THREE, person, dimInk, 40));
    rowEnd = person.boundingBox!.max.x;
  }
  // Centre the row on the origin.
  const shift = -rowEnd / 2;
  for (const mesh of meshes) mesh.position.x = shift;
  for (const line of lines) line.position.x = shift;
  for (const p of placed) p.x += shift;
  const rowLength = rowEnd;

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
  const removeLights = inkLights(THREE, scene, palette.bodyDim);
  for (const mesh of meshes) scene.add(mesh);
  for (const line of lines) scene.add(line);

  // The ground: one line under every keel, the row and a little more.
  const span = Math.max(rowLength * 1.15, widest * 3);
  const ground = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-span / 2, 0, 0),
      new THREE.Vector3(span / 2, 0, 0),
    ]),
    dimInk,
  );
  scene.add(ground);

  const fov = 28;
  const camera = new THREE.PerspectiveCamera(
    fov,
    el.clientWidth / el.clientHeight,
    0.05,
    rowLength * 40,
  );
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxDistance = rowLength * 8;
  controls.minDistance = 0.5;

  /** A side view, a little above, far enough that a span `w` long and `h` tall fills the frame. */
  const view = (x: number, w: number, h: number) => {
    const aspect = el.clientWidth / Math.max(el.clientHeight, 1);
    const t = Math.tan(((fov / 2) * Math.PI) / 180);
    const d = (Math.max(h, w / aspect) / (2 * t)) * 1.12;
    const target = new THREE.Vector3(x, h * 0.42, 0);
    const position = target
      .clone()
      .add(new THREE.Vector3(0, 0.3, 1).normalize().multiplyScalar(d));
    return { position, target };
  };
  const whole = () => view(0, rowLength, tallest * 1.25);
  // The page's ship among its neighbours: the next larger ship, then everything smaller.
  const around = () => {
    const at = placed.findIndex((p) => p.ship.current);
    if (at < 0) return whole();
    const near = placed.slice(Math.max(0, at - 1));
    const from = near[0]!.x - near[0]!.length / 2;
    const to = shift + rowLength;
    const top = Math.max(...near.map((p) => p.top));
    return view((from + to) / 2, (to - from) * 1.04, top * 1.35);
  };
  const start0 = around();
  camera.position.copy(start0.position);
  controls.target.copy(start0.target);

  let tween: {
    from: InstanceType<typeof THREE.Vector3>;
    to: InstanceType<typeof THREE.Vector3>;
    fromTarget: InstanceType<typeof THREE.Vector3>;
    toTarget: InstanceType<typeof THREE.Vector3>;
    began: number;
  } | null = null;
  controls.addEventListener("start", () => {
    tween = null;
  });

  // Labels: one per ship, over its highest point, stepped up where they would collide.
  const tagEls = placed.map((p) => {
    const tag = document.createElement("span");
    tag.textContent = `${p.ship.name} ${n0(p.ship.length)} m`;
    tag.className = `absolute whitespace-nowrap rounded-control bg-page px-1 text-caption ${p.ship.current ? "text-accent" : "text-secondary"}`;
    tag.style.transform = "translate(-50%, -100%)";
    tags.appendChild(tag);
    return tag;
  });
  const anchor = new THREE.Vector3();
  const stern = new THREE.Vector3();
  const placeTags = () => {
    const w = el.clientWidth;
    const h = el.clientHeight;
    const shown = placed
      .map((p, i) => {
        // A ship drawn shorter than a label is too small to name; the buttons still list it.
        stern.set(p.x - p.length / 2, 0, 0).project(camera);
        anchor.set(p.x + p.length / 2, 0, 0).project(camera);
        const drawn = Math.abs(anchor.x - stern.x) * 0.5 * w;
        anchor.set(p.x, p.top + Math.max(p.length * 0.03, 0.5), 0);
        anchor.project(camera);
        return {
          i,
          x: (anchor.x * 0.5 + 0.5) * w,
          y: (-anchor.y * 0.5 + 0.5) * h,
          visible: anchor.z < 1 && (drawn >= 28 || p.ship.current),
        };
      })
      .sort((a, b) => a.x - b.x);
    let lastX = Number.NEGATIVE_INFINITY;
    let level = 0;
    for (const s of shown) {
      const tag = tagEls[s.i]!;
      level = s.x - lastX < 110 ? level + 1 : 0;
      lastX = s.x;
      const inside = s.visible && s.x > -40 && s.x < w + 40 && s.y > 0;
      tag.style.display = inside ? "block" : "none";
      tag.style.left = `${s.x}px`;
      tag.style.top = `${s.y - level * 20}px`;
    }
  };

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
      const k = Math.min(1, (performance.now() - tween.began) / 1000);
      camera.position.lerpVectors(tween.from, tween.to, ease(k));
      controls.target.lerpVectors(tween.fromTarget, tween.toTarget, ease(k));
      if (k >= 1) tween = null;
    }
    controls.update();
    renderer.render(scene, camera);
    placeTags();
  };
  tick();

  return {
    focus(slug: Focus) {
      const p = placed.find((x) => x.ship.slug === slug);
      const to =
        slug === "around"
          ? around()
          : p === undefined
            ? whole()
            : view(p.x, p.length * 1.15, p.top * 1.4);
      if (reduced) {
        camera.position.copy(to.position);
        controls.target.copy(to.target);
        return;
      }
      tween = {
        from: camera.position.clone(),
        to: to.position,
        fromTarget: controls.target.clone(),
        toTarget: to.target,
        began: performance.now(),
      };
    },
    dispose() {
      cancelAnimationFrame(frame);
      onScreen.disconnect();
      resize.disconnect();
      controls.dispose();
      removeLights();
      for (const mesh of meshes) mesh.geometry.dispose();
      for (const line of lines) line.geometry.dispose();
      for (const m of materials) m.dispose();
      ground.geometry.dispose();
      for (const tag of tagEls) tag.remove();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
