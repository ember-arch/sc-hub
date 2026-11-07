import type { ReactNode } from "react";

/** Status only (system.md section 2, "Semantic colors are for status, never decoration"). */
export type BadgeTone = "success" | "warning" | "danger" | "neutral";

const toneClass: Record<BadgeTone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  neutral: "text-secondary",
};

export interface BadgeProps {
  readonly tone: BadgeTone;
  readonly children: ReactNode;
}

export function Badge({ tone, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-control border border-hairline bg-inset px-2 py-1 text-caption font-medium ${toneClass[tone]}`}
    >
      {children}
    </span>
  );
}
