import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatNumber,
  formatTime,
  sentence,
  withoutEmoji,
} from "../components/format";

describe("formatNumber", () => {
  it("groups thousands and rounds to the requested digits", () => {
    expect(formatNumber(48552)).toBe("48,552");
    expect(formatNumber(21.049, 2)).toBe("21.05");
    expect(formatNumber(21, 2)).toBe("21");
    expect(formatNumber(0)).toBe("0");
  });
});

describe("formatTime (system.md section 5)", () => {
  const now = new Date("2026-11-12T12:00:00.000Z");

  it("is relative under seven days", () => {
    expect(formatTime("2026-11-12T11:59:40.000Z", now)).toBe("just now");
    expect(formatTime("2026-11-12T11:15:00.000Z", now)).toBe("45 min ago");
    expect(formatTime("2026-11-12T09:00:00.000Z", now)).toBe("3 h ago");
    expect(formatTime("2026-11-06T12:00:00.001Z", now)).toBe("5 d ago");
  });

  it("is absolute from seven days on, and for future or unparseable times", () => {
    expect(formatTime("2026-11-05T12:00:00.000Z", now)).toBe("5 Nov 2026");
    expect(formatTime("2026-11-13T12:00:00.000Z", now)).toBe("13 Nov 2026");
    expect(formatTime("yesterday", now)).toBe("yesterday");
  });
});

describe("formatDate", () => {
  it("renders day, short month and year in UTC", () => {
    expect(formatDate("2026-11-07T23:30:00.000Z")).toBe("7 Nov 2026");
    expect(formatDate("not a date")).toBe("not a date");
  });
});

describe("sentence", () => {
  it("turns enum values into sentence case", () => {
    expect(sentence("flight_ready")).toBe("Flight ready");
    expect(sentence("quantum_drive")).toBe("Quantum drive");
    expect(sentence("comm_link")).toBe("Comm link");
  });
});

describe("withoutEmoji", () => {
  // CLAUDE.md section 2: no emoji in the UI. Built from code points so this file holds none either.
  const e = (...points: number[]): string => String.fromCodePoint(...points);
  it("drops pictographs, their joiners and selectors, and the spaces they leave", () => {
    expect(withoutEmoji(`Cargo Hauling | Star Citizen ${e(0x1f4e6)}`)).toBe(
      "Cargo Hauling | Star Citizen",
    );
    expect(withoutEmoji(`Mining Tips ${e(0x26cf, 0xfe0f)} Laser Heads`)).toBe(
      "Mining Tips Laser Heads",
    );
    expect(withoutEmoji(`Crew ${e(0x1f469, 0x200d, 0x1f680)} night`)).toBe(
      "Crew night",
    );
  });
  it("leaves words, numbers and punctuation as they are", () => {
    expect(withoutEmoji("IAE 2956 - Save The Date | Star Citizen")).toBe(
      "IAE 2956 - Save The Date | Star Citizen",
    );
    expect(withoutEmoji("4.10.3 #1 © ®")).toBe("4.10.3 #1 © ®");
  });
});
