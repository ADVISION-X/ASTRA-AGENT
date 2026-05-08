import type { z } from "zod";

import type { MouseScrollAnchorSchema, MouseScrollCoordinateSpaceSchema } from "../schema.js";

export type MouseScrollPrimitiveInput = {
  attemptRef: string;
  scrollExecutionRef: string;
  idempotencyKey: string;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  geometryGuardProofRef: string;
  sourceCoordinateProofRef: string;
  sourceTargetRef: string;
  coordinateSpace: z.output<typeof MouseScrollCoordinateSpaceSchema>;
  anchorPoint: z.output<typeof MouseScrollAnchorSchema>;
  deltaX: number;
  deltaY: number;
  repeatIndex: number;
  repeatTotal: number;
  targetLabel: string;
  timeoutMs: number;
  postClickObservation: true;
  operatorApprovalRef: string | null;
  abortSignal?: AbortSignal;
};

export type MouseScrollPrimitiveResult = {
  ok: boolean;
  primitiveExecutionRef: string;
  message: string;
  startedAt: string;
  endedAt: string;
  portKind: string;
};

export interface MouseScrollPrimitivePort {
  scroll(input: MouseScrollPrimitiveInput): Promise<MouseScrollPrimitiveResult>;
}