import type { AbilityTargetId } from "../nerve-bus/index.js";

export type AbilityStrength = "stub" | "diagnostic" | "runnable" | "verified" | "hardened";

export type AbilityRosterEntry = {
  abilityGroupId: AbilityTargetId;
  displayName: string;
  currentStrength: AbilityStrength;
  purpose: string;
};

export const ABILITY_ROSTER: AbilityRosterEntry[] = [
  { abilityGroupId: "open", displayName: "Open", currentStrength: "runnable", purpose: "Open the governed target page." },
  { abilityGroupId: "screenshot", displayName: "Screenshot", currentStrength: "diagnostic", purpose: "Capture governed evidence images." },
  { abilityGroupId: "local-ai-decision", displayName: "Local AI Decision", currentStrength: "diagnostic", purpose: "Return structured AI judgments only." },
  { abilityGroupId: "visual-target", displayName: "Visual Target", currentStrength: "diagnostic", purpose: "Find visual targets from evidence." },
  { abilityGroupId: "mouse-click", displayName: "Mouse Click", currentStrength: "diagnostic", purpose: "Execute governed click primitives." },
  { abilityGroupId: "mouse-scroll", displayName: "Mouse Scroll", currentStrength: "diagnostic", purpose: "Execute governed scroll primitives." },
  { abilityGroupId: "forensics-persistence", displayName: "Forensics Persistence", currentStrength: "runnable", purpose: "Persist governed evidence and logs." },
];

export function createAbilityRoster(): Map<AbilityTargetId, AbilityRosterEntry> {
  return new Map(ABILITY_ROSTER.map((entry) => [entry.abilityGroupId, entry]));
}