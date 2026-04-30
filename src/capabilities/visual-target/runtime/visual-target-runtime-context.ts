import type { VisualTargetClockPort } from "../ports/visual-target-clock-port.js";
import type { VisualTargetProfilePort } from "../ports/visual-target-profile-port.js";

export type VisualTargetRuntimeContext = {
  clock: VisualTargetClockPort;
  profilePort: VisualTargetProfilePort | null;
};

export type CreateVisualTargetRuntimeContextInput = {
  clock: VisualTargetClockPort;
  profilePort?: VisualTargetProfilePort | null;
};

export function createVisualTargetRuntimeContext(input: CreateVisualTargetRuntimeContextInput): VisualTargetRuntimeContext {
  return {
    clock: input.clock,
    profilePort: input.profilePort ?? null,
  };
}