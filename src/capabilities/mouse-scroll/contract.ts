import type { MouseScrollPrimitivePort } from "./primitive-port.js";
import type { MouseScrollBounds, MouseScrollCoordinateSpace, MouseScrollPoint, MouseScrollRegion } from "./shared/coordinate.js";
import type { MouseScrollFailureReason } from "./shared/scroll-failure.js";
import type { MouseScrollDirection, MouseScrollMagnitude } from "./shared/scroll-magnitude.js";
import type { MouseScrollSafetyPolicy } from "./shared/scroll-policy.js";
import type { MouseScrollRuntimeProof, MouseScrollRuntimeProofStatus } from "./shared/runtime-proof.js";

export const MOUSE_SCROLL_ABILITY_GROUP_ID = "mouse-scroll";
export const MOUSE_SCROLL_CHILD_CAPABILITY_IDS = [
  "scroll-browser-viewport",
  "scroll-desktop-screen",
  "scroll-region",
] as const;

export type MouseScrollAbilityGroupId = typeof MOUSE_SCROLL_ABILITY_GROUP_ID;
export type MouseScrollChildCapabilityId = typeof MOUSE_SCROLL_CHILD_CAPABILITY_IDS[number];
export type MouseScrollGuardDecision = "allow";
export type MouseScrollAbilityStatus = MouseScrollRuntimeProofStatus;

export type MouseScrollCustomDelta = {
  deltaX: number;
  deltaY: number;
};

export type MouseScrollAbilityInput = {
  abilityGroupId: MouseScrollAbilityGroupId;
  childCapabilityId: MouseScrollChildCapabilityId;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  requestedBy: string;
  purpose: string;
  geometryGuardRef: string;
  guardDecision: MouseScrollGuardDecision;
  sourceEvidenceRef: string | null;
  sourceTargetRef: string | null;
  coordinateSpace: MouseScrollCoordinateSpace;
  anchorPoint: MouseScrollPoint;
  region: MouseScrollRegion | null;
  regionRef: string | null;
  bounds: MouseScrollBounds;
  direction: MouseScrollDirection;
  magnitude: MouseScrollMagnitude;
  customDelta: MouseScrollCustomDelta | null;
  repeat: number;
  safetyPolicy: Partial<MouseScrollSafetyPolicy>;
};

export type NormalizedMouseScrollAbilityInput = Omit<MouseScrollAbilityInput, "safetyPolicy"> & {
  safetyPolicy: MouseScrollSafetyPolicy;
};

export type MouseScrollAbilityResult = {
  status: MouseScrollAbilityStatus;
  abilityGroupId: MouseScrollAbilityGroupId;
  childCapabilityId: MouseScrollChildCapabilityId;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  scrollExecutionRef: string;
  primitiveExecutionRefs: string[];
  geometryGuardRef: string;
  direction: MouseScrollDirection;
  magnitude: MouseScrollMagnitude;
  deltaX: number;
  deltaY: number;
  repeat: number;
  coordinateSpace: MouseScrollCoordinateSpace;
  anchorPoint: MouseScrollPoint;
  regionRef: string | null;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  statusMessage: string;
  failureReason: MouseScrollFailureReason | null;
  debugLogRef: string | null;
  runtimeProof: MouseScrollRuntimeProof;
};

export type MouseScrollAbilityContext = {
  primitivePort: MouseScrollPrimitivePort;
};

export interface MouseScrollChildCapability {
  readonly abilityGroupId: MouseScrollAbilityGroupId;
  readonly childCapabilityId: MouseScrollChildCapabilityId;

  execute(
    input: NormalizedMouseScrollAbilityInput,
    context: MouseScrollAbilityContext,
  ): Promise<MouseScrollAbilityResult>;
}

export interface MouseScrollAbilityGroup {
  listChildCapabilityIds(): MouseScrollChildCapabilityId[];
  execute(input: MouseScrollAbilityInput): Promise<MouseScrollAbilityResult>;
}
