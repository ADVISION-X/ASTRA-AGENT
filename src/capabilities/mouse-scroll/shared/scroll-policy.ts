import { GLOBAL_MOUSE_SCROLL_MAX_REPEAT } from "./scroll-magnitude.js";

export type MouseScrollSafetyPolicy = {
  requireGeometryGuard: boolean;
  allowOperatorManual: boolean;
  operatorManualApprovalRef: string | null;
  maxRepeat: number;
  maxDeltaAbs: number;
  maxDurationMs: number;
  blockIfOutOfBounds: boolean;
  blockIfNoSourceRef: boolean;
};

export const DEFAULT_MOUSE_SCROLL_SAFETY_POLICY: MouseScrollSafetyPolicy = {
  requireGeometryGuard: true,
  allowOperatorManual: false,
  operatorManualApprovalRef: null,
  maxRepeat: GLOBAL_MOUSE_SCROLL_MAX_REPEAT,
  maxDeltaAbs: 2400,
  maxDurationMs: 3000,
  blockIfOutOfBounds: true,
  blockIfNoSourceRef: true,
};