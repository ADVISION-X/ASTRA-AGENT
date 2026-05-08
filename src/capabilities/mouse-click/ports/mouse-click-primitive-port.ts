import { MOUSE_CLICK_BUTTONS, MOUSE_CLICK_COORDINATE_SPACES, MOUSE_CLICK_COUNTS } from "../shared/mouse-click-types.js";

export type MouseClickCoordinateSpace = (typeof MOUSE_CLICK_COORDINATE_SPACES)[number];
export type MouseClickButton = (typeof MOUSE_CLICK_BUTTONS)[number];
export type MouseClickCount = (typeof MOUSE_CLICK_COUNTS)[number];

export type MouseClickPrimitiveInput = {
  attemptRef: string;
  actionExecutionRef: string;
  idempotencyKey: string;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  geometryGuardProofRef: string;
  sourceCoordinateProofRef: string;
  sourceTargetRef: string;
  coordinateSpace: MouseClickCoordinateSpace;
  executableCoordinate: { x: number; y: number };
  button: MouseClickButton;
  clickCount: MouseClickCount;
  targetLabel: string;
  timeoutMs: number;
  postClickObservation: true;
  operatorApprovalRef: string | null;
  abortSignal?: AbortSignal;
};

export type MouseClickPrimitiveResult = {
  ok: boolean;
  primitiveExecutionRef: string | null;
  message: string;
  startedAt: string | null;
  endedAt: string | null;
  portKind: string;
};

export interface MouseClickPrimitivePort {
  click(input: MouseClickPrimitiveInput): Promise<MouseClickPrimitiveResult>;
}