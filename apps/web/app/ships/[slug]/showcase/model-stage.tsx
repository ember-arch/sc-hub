"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TextLink } from "ui";

/**
 * The holoviewer model as a dossier figure (ADR-010, ADR-011): CIG's in-game holoviewer model as FleetYards converted it, in Google's
 * model-viewer. Drag to orbit, scroll or pinch to zoom, auto-spin until the reader takes over. The
 * library and the model load only as the section approaches; the Draco decoder is served from
 * /media/draco so nothing is fetched from a third party. The model is clay: no textures exist.
 */

interface PbrMaterial {
  pbrMetallicRoughness: {
    setBaseColorFactor(rgba: [number, number, number, number]): void;
    setMetallicFactor(value: number): void;
    setRoughnessFactor(value: number): void;
  };
  name: string;
}

interface ModelViewerElement extends HTMLElement {
  cameraOrbit: string;
  fieldOfView: string;
  model?: { materials: PbrMaterial[] };
  jumpCameraToGoal(): void;
  resetTurntableRotation(theta?: number): void;
}

/** Three-quarter view from slightly above, close enough that the hull fills the frame. */
const ORBIT = "-35deg 70deg 62%";

/**
 * The models arrive as flat grey clay. A gunmetal finish, darker and more metallic, reads as a
 * studio render on the dark page instead of a white silhouette. Glass stays as it comes.
 */
function finish(el: ModelViewerElement): void {
  for (const material of el.model?.materials ?? []) {
    if (/glass/i.test(material.name)) continue;
    material.pbrMetallicRoughness.setBaseColorFactor([0.46, 0.49, 0.54, 1]);
    material.pbrMetallicRoughness.setMetallicFactor(0.72);
    material.pbrMetallicRoughness.setRoughnessFactor(0.38);
  }
}

export function ModelStage({
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
  /** Metres, for the caption: the model is to scale. */
  readonly length: number | null;
  readonly poster: string | null;
  readonly credit: { readonly text: string; readonly href: string };
  /** Figure number in the dossier, for example "Fig. 4". */
  readonly label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const viewer = useRef<ModelViewerElement | null>(null);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [spin, setSpin] = useState(true);

  useEffect(() => {
    const el = box.current;
    if (el === null) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting !== true) return;
        io.disconnect();
        // model-viewer reads its decoder location from this global when it loads, so it is set first.
        (
          window as unknown as {
            ModelViewerElement?: { dracoDecoderLocation?: string };
          }
        ).ModelViewerElement = { dracoDecoderLocation: "/media/draco/" };
        void import("@google/model-viewer").then(() => setReady(true));
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const attach = useCallback((node: HTMLElement | null) => {
    viewer.current = node as ModelViewerElement | null;
    if (node === null) return;
    const onLoad = () => {
      finish(node as ModelViewerElement);
      setLoaded(true);
    };
    node.addEventListener("load", onLoad);
    node.addEventListener("camera-change", (e) => {
      // A drag by the reader stops the spin; programmatic moves do not.
      if (
        (e as CustomEvent<{ source: string }>).detail.source ===
        "user-interaction"
      ) {
        setSpin(false);
      }
    });
  }, []);

  const reset = () => {
    const el = viewer.current;
    if (el === null) return;
    el.cameraOrbit = ORBIT;
    el.fieldOfView = "auto";
    el.resetTurntableRotation(0);
    el.jumpCameraToGoal();
  };

  const megabytes = (bytes / 1_000_000).toLocaleString("en-US", {
    maximumFractionDigits: 1,
  });

  const button =
    "rounded-control border border-hairline-strong px-3 py-1 text-ui text-primary transition-colors duration-hover hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";

  return (
    <figure className="m-0 flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-caption text-secondary">
          Drag to rotate · scroll or pinch to zoom
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSpin((s) => !s)}
            aria-pressed={spin}
            className={button}
          >
            {spin ? "Stop spin" : "Spin"}
          </button>
          <button type="button" onClick={reset} className={button}>
            Reset view
          </button>
        </div>
      </div>
      <div
        ref={box}
        className="relative h-[60svh] min-h-[360px] w-full overflow-hidden rounded-card border border-hairline bg-inset"
      >
        {ready ? (
          <model-viewer
            ref={attach}
            src={src}
            alt={`3D model of the ${name}`}
            camera-controls=""
            auto-rotate={spin ? "" : undefined}
            auto-rotate-delay="0"
            rotation-per-second="14deg"
            interaction-prompt="none"
            camera-orbit={ORBIT}
            min-camera-orbit="auto auto 20%"
            shadow-intensity="1"
            shadow-softness="0.8"
            exposure="0.95"
            tone-mapping="neutral"
            environment-image="neutral"
            poster={poster ?? undefined}
            loading="eager"
            style={{ width: "100%", height: "100%", background: "transparent" }}
          />
        ) : poster === null ? null : (
          <img
            src={poster}
            alt=""
            className="h-full w-full object-cover opacity-60"
          />
        )}
        {loaded ? null : (
          <p className="absolute bottom-4 left-4 m-0 text-caption text-secondary">
            Loading the model ({megabytes} MB)
          </p>
        )}
      </div>
      <figcaption className="flex flex-wrap justify-between gap-2 text-caption text-secondary">
        <span>
          <span className="font-mono text-primary">{label}</span>{" "}
          {length === null
            ? "Holoviewer model, untextured, to scale"
            : `Holoviewer model, untextured, to scale: ${length.toLocaleString("en-US")} m long`}
        </span>
        <TextLink href={credit.href} external className="text-secondary">
          {credit.text}
        </TextLink>
      </figcaption>
    </figure>
  );
}
