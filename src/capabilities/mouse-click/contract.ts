import type { MouseClickPrimitivePort } from "./primitive-port.js";
import type { MouseClickSafetyPolicy } from "./shared/click-policy.js";
import type { MouseClickCoordinate, MouseClickCoordinateSpace, MouseClickButton, MouseClickCount } from "./shared/coordinate.js";
import type { MouseClickFailureReason } from "./shared/click-failure.js";
import type { MouseClickRuntimeProof, MouseClickRuntimeProofStatus } from "./shared/runtime-proof.js";

export const MOUSE_CLICK_ABILITY_GROUP_ID = "mouse-click";

export type MouseClickAbilityGroupId = typeof MOUSE_CLICK_ABILITY_GROUP_ID;
export type MouseClickChildCapabilityId = "click-browser-coordinate" | "click-desktop-coordinate";
export type MouseClickGuardDecision = "allow";
export type MouseClickStatus = MouseClickRuntimeProofStatus;

export type MouseClickAbilityInput = {
  abilityGroupId: MouseClickAbilityGroupId;
  childCapabilityId: MouseClickChildCapabilityId;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  requestedBy: string;
  purpose: string;
  geometryGuardRef: string;
  guardDecision: MouseClickGuardDecision;
  sourceEvidenceRef: string | null;
  sourceTargetRef: string | null;
  coordinate: MouseClickCoordinate;
  button: MouseClickButton | null;
  clickCount: MouseClickCount | null;
  safetyPolicy: Partial<MouseClickSafetyPolicy>;
};

export type NormalizedMouseClickAbilityInput = Omit<MouseClickAbilityInput, "button" | "clickCount" | "safetyPolicy"> & {
  button: MouseClickButton;
  clickCount: MouseClickCount;
  safetyPolicy: MouseClickSafetyPolicy;
};

export type MouseClickAbilityResult = {
  status: MouseClickStatus;
  abilityGroupId: MouseClickAbilityGroupId;
  childCapabilityId: MouseClickChildCapabilityId;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  actionExecutionRef: string;
  primitiveExecutionRef: string | null;
  geometryGuardRef: string;
  x: number;
  y: number;
  coordinateSpace: MouseClickCoordinateSpace;
  button: MouseClickButton;
  clickCount: MouseClickCount;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  failureReason: MouseClickFailureReason | null;
  statusMessage: string;
  debugLogRef: string | null;
  runtimeProof: MouseClickRuntimeProof;
};

export type MouseClickAbilityContext = {
  primitivePort: MouseClickPrimitivePort;
};

export interface MouseClickChildCapability {
  readonly abilityGroupId: MouseClickAbilityGroupId;
  readonly childCapabilityId: MouseClickChildCapabilityId;

  execute(
    input: NormalizedMouseClickAbilityInput,
    context: MouseClickAbilityContext,
  ): Promise<MouseClickAbilityResult>;
}

export interface MouseClickAbilityGroup {
  listChildCapabilityIds(): MouseClickChildCapabilityId[];
  execute(input: MouseClickAbilityInput): Promise<MouseClickAbilityResult>;
}