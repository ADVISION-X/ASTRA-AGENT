/**
 * Mouse Click Primitive Port
 *
 * The only interface between the Mouse Click ability group and the underlying
 * browser/desktop click executor. Button and clickCount are fixed by the child
 * capability — they are NOT passed in from AI or external callers.
 */

export type MouseClickPrimitiveInput = {
  primitiveRef: string;
  idempotencyKey: string;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  geometryGuardProofRef: string;
  coordinateSpace: "browserViewport";
  executableCoordinate: { x: number; y: number };
  /** Fixed by child capability — left | right */
  button: "left" | "right";
  /** Fixed by child capability — 1 | 2 */
  clickCount: 1 | 2;
  timeoutMs: number;
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
