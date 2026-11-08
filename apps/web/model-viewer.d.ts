import type { CSSProperties, Ref } from "react";

// Google's <model-viewer> custom element (ADR-010). Its attributes are kebab-case strings; React
// 19 passes them through to the element as written.
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": {
        ref?: Ref<HTMLElement> | ((node: HTMLElement | null) => void);
        src: string;
        alt: string;
        poster?: string | undefined;
        loading?: "auto" | "lazy" | "eager";
        style?: CSSProperties;
        "camera-controls"?: "" | undefined;
        "auto-rotate"?: "" | undefined;
        "auto-rotate-delay"?: string;
        "rotation-per-second"?: string;
        "interaction-prompt"?: "auto" | "none";
        "camera-orbit"?: string;
        "min-camera-orbit"?: string;
        "shadow-intensity"?: string;
        exposure?: string;
        "tone-mapping"?: string;
        "shadow-softness"?: string;
        "environment-image"?: string;
      };
    }
  }
}
