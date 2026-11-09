"use client";

import type { BufferGeometry } from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import { THEME_CHANGE_EVENT, TextLink } from "ui";
import {
  inkBody,
  inkEdges,
  inkLights,
  inkLine,
  inkPalette,
  loadHoloGeometry,
} from "./holo-kit";
import { layoutRow } from "./lineup-layout";

/**
 * The Scale section's lineup (ADR-015, drawn in ink per ADR-020): every ship on record, each
 * scaled to its recorded length and standing in profile on one ground line, largest first, with
 * a person beside the smallest. A ship with an RSI holoviewer model is drawn as that model; one
 * without is drawn as its envelope, a box of its recorded length, beam and height, so the row is
 * complete whatever has been built (ADR-022). The page's ship is drawn in full ink; the others
 * dimmer. Labels name each ship and its length; the controls below fly the camera to the ship's
 * neighbours, to the whole row or to any one ship. Drag to turn, scroll or pinch to zoom.
 *
 * The row is laid out from the recorded lengths before anything loads, so the paper, the ground
 * line, every envelope and the camera are up at once. Models load a few at a time for the ships
 * the camera is looking at and large enough to show detail, and replace their envelope as they
 * land; their inked edges follow in an idle moment.
 */

export interface LineupShip {
  readonly slug: string;
  readonly name: string;
  /** Dimensions on record, in metres; the envelope, and the model's scale. */
  readonly length: number;
  readonly beam: number;
  readonly height: number;
  /** The holoviewer model, when one is built; null draws the envelope. */
  readonly src: string | null;
  readonly bytes: number;
  readonly current: boolean;
}

/** "around": the page's ship among the ships near it in size; "all": the row. */
type Focus = "around" | "all" | string;

interface Api {
  focus(focus: Focus): void;
  dispose(): void;
}

interface Progress {
  /** Models wanted so far, and how many of those have landed or given up. */
  readonly wanted: number;
  readonly done: number;
  readonly failed: number;
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
  const [progress, setProgress] = useState<Progress>({
    wanted: 0,
    done: 0,
    failed: 0,
  });
  const [full, setFull] = useState(false);
  const order = useMemo(
    () => [...ships].sort((a, b) => b.length - a.length),
    [ships],
  );
  const current = ships.find((s) => s.current);
  const modelled = ships.filter((s) => s.src !== null).length;
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
        void start(el, tags, ships, figure?.src ?? null, (p) => {
          if (!cancelled) setProgress(p);
        })
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
    "rounded-pill border px-3 py-1 text-caption transition-colors duration-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
  const choice = (on: boolean) =>
    `${option} ${on ? "border-accent bg-accent-bg text-primary" : "border-hairline-strong text-secondary hover:text-primary"}`;
  const loadingModels = progress.done < progress.wanted;
  const picked = focus === "around" || focus === "all" ? "" : focus;

  return (
    <figure className="m-0 flex flex-col gap-2">
      <div
        ref={frame}
        className={`flex flex-col gap-2 ${full ? "bg-page p-4" : ""}`}
      >
        <div
          className={`relative w-full overflow-hidden rounded-card bg-inset ${full ? "min-h-0 flex-1" : "aspect-video lg:aspect-[2/1]"}`}
        >
          <div
            ref={box}
            role="img"
            aria-label={`To scale: ${order.map((s) => `${s.name} ${n0(s.length)} m`).join(", ")}${figure === null ? "" : `, and a person ${figure.height.toFixed(1)} m tall`}. ${modelled} drawn from RSI's holoviewer models, the rest as their envelopes.`}
            className="absolute inset-0"
          />
          <div
            ref={labels}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10"
          />
          {state === "error" ? (
            <p className="absolute bottom-3 left-3 m-0 text-caption text-secondary">
              The lineup could not be drawn.
            </p>
          ) : state === "loading" ? (
            <p
              role="status"
              className="absolute bottom-3 left-3 m-0 text-caption text-secondary"
            >
              Drawing the lineup
            </p>
          ) : loadingModels ? (
            <p
              role="status"
              className="absolute bottom-3 left-3 m-0 text-caption text-secondary"
            >
              Loading models, {progress.done} of {progress.wanted}
            </p>
          ) : progress.failed > 0 ? (
            <p className="absolute bottom-3 left-3 m-0 text-caption text-secondary">
              {progress.failed} of {progress.wanted} models could not be loaded;
              those ships keep their envelope
            </p>
          ) : null}
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
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-caption text-secondary">Look at</span>
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
          <label className="flex items-center gap-2 text-caption text-secondary">
            <span>One ship</span>
            <select
              aria-label="One ship"
              value={picked}
              onChange={(event) => {
                const slug = event.target.value;
                setFocus(slug === "" ? (largest ? "all" : "around") : slug);
              }}
              className="rounded-pill border border-hairline-strong bg-surface px-3 py-1 text-caption text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <option value="">Choose a ship</option>
              {order.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}, {n0(s.length)} m
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <figcaption className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-caption text-secondary">
        <span>
          <span className="font-mono text-primary">{label}</span> To scale: the{" "}
          {current?.name ?? "ship"} beside every ship on record
          {figure === null ? "" : " and a person"}, each sized to its recorded
          length; a ship with a holoviewer model is drawn as that model, the
          rest as their envelope of length, beam and height
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

/** Runs `job` when the browser has a moment, within half a second at most. */
function whenIdle(job: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(job, { timeout: 500 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(job, 16);
  return () => window.clearTimeout(id);
}

/** Models download a few at a time; a ship is worth its model once it is this wide on screen. */
const MODELS_IN_FLIGHT = 3;
const DETAIL_PX = 40;

async function start(
  el: HTMLDivElement,
  tags: HTMLDivElement,
  ships: readonly LineupShip[],
  figureSrc: string | null,
  onProgress: (progress: Progress) => void,
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
  let disposed = false;

  // The row from the recorded lengths alone (lineup-layout.ts), centred on the origin.
  const row = layoutRow(ships, figureSrc !== null);
  const { rowLength } = row;
  interface Slot {
    readonly ship: LineupShip;
    readonly from: number;
    x: number;
    top: number;
    readonly length: number;
    /** What stands on the ground now: the envelope until the model lands. */
    mesh: InstanceType<typeof THREE.Mesh> | null;
    lines: InstanceType<typeof THREE.LineSegments> | null;
    model: "none" | "wanted" | "loading" | "drawn" | "failed";
  }
  const slots: Slot[] = row.slots.map((s) => ({
    ship: s.ship,
    from: s.from,
    x: s.x,
    top: s.ship.height,
    length: s.length,
    mesh: null,
    lines: null,
    model: s.ship.src === null ? "none" : "wanted",
  }));
  const tallest = Math.max(1, ...slots.map((s) => s.top));

  const materials: InstanceType<typeof THREE.Material>[] = [];
  const fullBody = inkBody(THREE, palette.body);
  const dimBody = inkBody(THREE, palette.bodyDim);
  const fullInk = inkLine(THREE, palette.ink, 0.6);
  const dimInk = inkLine(THREE, palette.inkDim, 0.45);
  materials.push(fullBody, dimBody, fullInk, dimInk);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(el.clientWidth, el.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(palette.paper, 1);
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.inset = "0";
  renderer.domElement.style.touchAction = "none";
  el.insertBefore(renderer.domElement, el.firstChild);

  // The switch (ADR-021) changes the tokens under the canvas; repaint from them.
  const repaint = (): void => {
    const next = inkPalette(THREE, el);
    renderer.setClearColor(next.paper, 1);
    fullBody.color.copy(next.body);
    dimBody.color.copy(next.bodyDim);
    fullInk.color.copy(next.ink);
    dimInk.color.copy(next.inkDim);
  };
  window.addEventListener(THEME_CHANGE_EVENT, repaint);

  const scene = new THREE.Scene();
  const removeLights = inkLights(THREE, scene, palette.bodyDim);

  // The ground: one line under every keel, the row and a little more.
  const span = rowLength * 1.15;
  const ground = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-span / 2, 0, 0),
      new THREE.Vector3(span / 2, 0, 0),
    ]),
    dimInk,
  );
  scene.add(ground);

  // The ink is drawn in idle moments, one body at a time, so frames run between.
  const inking: (() => void)[] = [];
  let cancelIdle: (() => void) | null = null;
  const drainInk = (): void => {
    cancelIdle = null;
    const job = inking.shift();
    if (job === undefined || disposed) return;
    job();
    if (inking.length > 0) cancelIdle = whenIdle(drainInk);
  };
  const ink = (job: () => void): void => {
    inking.push(job);
    if (cancelIdle === null) cancelIdle = whenIdle(drainInk);
  };

  /** Stands a body on the ground at the slot, replacing what stood there. */
  const stand = (slot: Slot, g: BufferGeometry, angle?: number): void => {
    if (slot.mesh !== null) {
      scene.remove(slot.mesh);
      slot.mesh.geometry.dispose();
    }
    if (slot.lines !== null) {
      scene.remove(slot.lines);
      slot.lines.geometry.dispose();
      slot.lines = null;
    }
    const mesh = new THREE.Mesh(g, slot.ship.current ? fullBody : dimBody);
    slot.mesh = mesh;
    scene.add(mesh);
    ink(() => {
      if (slot.mesh !== mesh) return;
      const line = inkEdges(
        THREE,
        g,
        slot.ship.current ? fullInk : dimInk,
        angle,
      );
      slot.lines = line;
      scene.add(line);
    });
  };

  // Every ship stands as its envelope at once: a box of its length, height and beam.
  for (const slot of slots) {
    const g = new THREE.BoxGeometry(
      slot.length,
      slot.ship.height,
      slot.ship.beam,
    );
    g.translate(slot.x, slot.ship.height / 2, 0);
    stand(slot, g);
  }

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
    return { position, target, width: Math.max(w, h * aspect) };
  };
  const whole = () => view(0, rowLength, tallest * 1.25);
  // The page's ship among its neighbours in size: the four ships above it and the four below,
  // so a fighter is shown beside fighters, not beside every capital ship on record.
  const around = () => {
    const at = slots.findIndex((s) => s.ship.current);
    if (at < 0) return whole();
    const near = slots.slice(
      Math.max(0, at - 4),
      Math.min(slots.length, at + 5),
    );
    const from = near[0]!.x - near[0]!.length / 2;
    const end = near[near.length - 1]!;
    const to = end.x + end.length / 2;
    const top = Math.max(...near.map((s) => s.top));
    return view((from + to) / 2, (to - from) * 1.08, top * 1.35);
  };
  const viewOf = (focus: Focus) => {
    const s = slots.find((x) => x.ship.slug === focus);
    return focus === "around"
      ? around()
      : s === undefined
        ? whole()
        : view(s.x, s.length * 1.15, s.top * 1.4);
  };
  const start0 = around();
  camera.position.copy(start0.position);
  controls.target.copy(start0.target);

  // Models: wanted for the ships the camera looks at that are wide enough to show detail, a few
  // at a time, replacing their envelope as they land. The page's ship always gets its model.
  const queue: Slot[] = [];
  let inFlight = 0;
  let wanted = 0;
  let done = 0;
  let failed = 0;
  const report = (): void => onProgress({ wanted, done, failed });
  const placeModel = (g: BufferGeometry, slot: Slot): void => {
    // Scaled to its recorded length, turned so its nose points along +X, keel on the floor.
    g.computeBoundingBox();
    const b = g.boundingBox!;
    const c = b.getCenter(new THREE.Vector3());
    g.translate(-c.x, -c.y, -c.z);
    const modelLength = b.max.z - b.min.z;
    const k = modelLength > 0 ? slot.ship.length / modelLength : 1;
    g.scale(k, k, k);
    g.rotateY(-Math.PI / 2);
    g.computeBoundingBox();
    const placedBox = g.boundingBox!;
    g.translate(slot.from - placedBox.min.x, -placedBox.min.y, 0);
    g.computeBoundingBox();
    const box = g.boundingBox!;
    slot.x = (box.min.x + box.max.x) / 2;
    slot.top = box.max.y;
    stand(slot, g);
  };
  const pump = (): void => {
    while (inFlight < MODELS_IN_FLIGHT && queue.length > 0) {
      const slot = queue.shift()!;
      if (slot.model !== "wanted" || slot.ship.src === null) continue;
      slot.model = "loading";
      inFlight += 1;
      wanted += 1;
      report();
      loadHoloGeometry(THREE, loader, slot.ship.src)
        .then((g) => {
          if (disposed) {
            g.dispose();
            return;
          }
          placeModel(g, slot);
          slot.model = "drawn";
        })
        .catch(() => {
          slot.model = "failed";
          failed += 1;
        })
        .finally(() => {
          inFlight -= 1;
          done += 1;
          report();
          pump();
        });
    }
  };
  /** Asks for the models of the ships a view shows wide enough to tell a model from a box. */
  const wantModels = (span: { width: number }, centre: number): void => {
    const px = el.clientWidth / Math.max(span.width, 1);
    const left = centre - span.width / 2;
    const right = centre + span.width / 2;
    for (const slot of slots) {
      if (slot.model !== "wanted") continue;
      const inView =
        slot.x + slot.length / 2 >= left && slot.x - slot.length / 2 <= right;
      if (slot.ship.current || (inView && slot.length * px >= DETAIL_PX)) {
        queue.push(slot);
      }
    }
    pump();
  };

  const extras: (
    InstanceType<typeof THREE.Mesh> | InstanceType<typeof THREE.LineSegments>
  )[] = [];
  if (figureSrc !== null && row.personAt !== null) {
    const personAt = row.personAt;
    loadHoloGeometry(THREE, loader, figureSrc)
      .then((person) => {
        if (disposed) {
          person.dispose();
          return;
        }
        person.computeBoundingBox();
        const pb = person.boundingBox!;
        person.translate(
          personAt - pb.min.x,
          -pb.min.y,
          -(pb.min.z + pb.max.z) / 2,
        );
        const mesh = new THREE.Mesh(person, dimBody);
        extras.push(mesh);
        scene.add(mesh);
        ink(() => {
          const line = inkEdges(THREE, person, dimInk, 40);
          extras.push(line);
          scene.add(line);
        });
      })
      .catch(() => undefined);
  }

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
  const tagEls = slots.map((s) => {
    const tag = document.createElement("span");
    tag.textContent = `${s.ship.name} ${n0(s.ship.length)} m`;
    tag.className = `absolute whitespace-nowrap rounded-control bg-page px-1 text-caption ${s.ship.current ? "text-accent" : "text-secondary"}`;
    tag.style.transform = "translate(-50%, -100%)";
    tag.style.display = "none";
    tags.appendChild(tag);
    return tag;
  });
  const anchor = new THREE.Vector3();
  const stern = new THREE.Vector3();
  const placeTags = () => {
    const w = el.clientWidth;
    const h = el.clientHeight;
    const shown = slots
      .map((s, i) => {
        // A ship drawn shorter than a label is too small to name; the picker still lists it.
        stern.set(s.x - s.length / 2, 0, 0).project(camera);
        anchor.set(s.x + s.length / 2, 0, 0).project(camera);
        const drawn = Math.abs(anchor.x - stern.x) * 0.5 * w;
        anchor.set(s.x, s.top + Math.max(s.length * 0.03, 0.5), 0);
        anchor.project(camera);
        return {
          i,
          x: (anchor.x * 0.5 + 0.5) * w,
          y: (-anchor.y * 0.5 + 0.5) * h,
          visible: anchor.z < 1 && (drawn >= 28 || s.ship.current),
        };
      })
      .sort((a, b) => a.x - b.x);
    let lastX = Number.NEGATIVE_INFINITY;
    let level = 0;
    for (const s of shown) {
      const tag = tagEls[s.i]!;
      // Neighbours step up to three rows, then start again, so a crowd never climbs off the top.
      level = s.x - lastX < 110 ? (level + 1) % 3 : 0;
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
  wantModels(start0, start0.target.x);

  return {
    focus(slug: Focus) {
      const to = viewOf(slug);
      wantModels(to, to.target.x);
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
      disposed = true;
      cancelIdle?.();
      inking.length = 0;
      queue.length = 0;
      window.removeEventListener(THEME_CHANGE_EVENT, repaint);
      cancelAnimationFrame(frame);
      onScreen.disconnect();
      resize.disconnect();
      controls.dispose();
      removeLights();
      for (const slot of slots) {
        slot.mesh?.geometry.dispose();
        slot.lines?.geometry.dispose();
      }
      for (const extra of extras) extra.geometry.dispose();
      for (const m of materials) m.dispose();
      ground.geometry.dispose();
      for (const tag of tagEls) tag.remove();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
