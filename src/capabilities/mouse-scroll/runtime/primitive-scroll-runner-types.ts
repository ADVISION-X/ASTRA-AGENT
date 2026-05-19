import type { MouseScrollAnchor, MouseScrollCoordinateSpace, MouseScrollDelta } from "../contract.js";
import type { MouseScrollExecutionContext } from "./mouse-scroll-runtime-context.js";
import type { PrimitiveIterationProof } from "./primitive-scroll-runner-result.types.js";

export type RunPrimitiveScrollInput = {
  context: MouseScrollExecutionContext;
  attemptRef: string;
  scrollExecutionRef: string;
  idempotencyKey: string;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  geometryGuardProofRef: string;
  sourceCoordinateProofRef: string;
  sourceTargetRef: string;
  operatorApprovalRef: string | null;
  targetLabel: string;
  coordinateSpace: MouseScrollCoordinateSpace;
  executableAnchor: MouseScrollAnchor;
  executableDelta: MouseScrollDelta;
  repeat: number;
  timeoutMs: number;
  maxDurationMs: number;
};

export type PrimitiveClockSnapshot = ReturnType<MouseScrollExecutionContext["clock"]["now"]>;
export type PrimitiveCallFrame = {
  startedSnapshot: PrimitiveClockSnapshot;
  primitiveCallId: string;
  primitiveStartedAt: string;
};

export type PrimitiveExecutionStore = {
  primitiveExecutionRefs: string[];
  perIterationPrimitiveProofs: PrimitiveIterationProof[];
};

export type PrimitivePortResult = Awaited<ReturnType<MouseScrollExecutionContext["primitivePort"]["scroll"]>>;