"use client";

import { site } from "./site";

export type MeterKind = "mood" | "skills";
export type MeterSnapshot = Record<MeterKind, Record<string, number>>;

const liveValues = new Map<string, number>();

export function publishMeter(
  kind: MeterKind,
  label: string,
  percent: number,
): void {
  liveValues.set(`${kind}:${label}`, percent);
}

export function getMeterSnapshot(): MeterSnapshot {
  const snapshot = (kind: MeterKind) =>
    Object.fromEntries(
      site[kind].map((meter) => [
        meter.label,
        liveValues.get(`${kind}:${meter.label}`) ?? Math.round(meter.max * 100),
      ]),
    );
  return { mood: snapshot("mood"), skills: snapshot("skills") };
}
