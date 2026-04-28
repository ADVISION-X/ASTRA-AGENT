import type { MouseClickButton, MouseClickCoordinateSpace, MouseClickCount } from "./coordinate.js";

export type MouseClickRuntimeProofStatus = "success" | "failed" | "review_required";

export type MouseClickRuntimeProof = {
  abilityGroupId: "mouse-click";
  childCapabilityId: "click-browser-coordinate" | "click-desktop-coordinate";
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  actionExecutionRef: string;
  primitiveExecutionRef: string | null;
  requestedBy: string;
  purpose: string;
  geometryGuardRef: string;
  coordinateSpace: MouseClickCoordinateSpace;
  x: number;
  y: number;
  button: MouseClickButton;
  clickCount: MouseClickCount;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  status: MouseClickRuntimeProofStatus;
  failureReason: string | null;
};