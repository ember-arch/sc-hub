import type { Channel, VehicleStatus } from "schema";
import type { BadgeTone } from "./badge";

/** Ship-matrix status → badge. Copy is sentence case (system.md section 5). */
export function vehicleStatusBadge(status: VehicleStatus): {
  tone: BadgeTone;
  label: string;
} {
  switch (status) {
    case "flight_ready":
      return { tone: "success", label: "Flight ready" };
    case "in_production":
      return { tone: "warning", label: "In production" };
    case "concept":
      return { tone: "neutral", label: "Concept" };
  }
}

/** Channel chips: LIVE is canonical, PTU and EPTU are flagged (CLAUDE.md section 5). */
export function channelBadge(channel: Channel): {
  tone: BadgeTone;
  label: string;
} {
  return channel === "LIVE"
    ? { tone: "neutral", label: "LIVE" }
    : { tone: "warning", label: channel };
}
