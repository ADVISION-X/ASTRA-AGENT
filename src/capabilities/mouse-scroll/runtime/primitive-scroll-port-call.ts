import type { PrimitivePortResult, RunPrimitiveScrollInput } from "./primitive-scroll-runner-types.js";

type PrimitivePortCallInput = {
  input: RunPrimitiveScrollInput;
  iteration: number;
  abortController: AbortController;
  setTimeoutHandle(handle: ReturnType<typeof setTimeout>): void;
  markTimeoutTriggered(): void;
};

const buildPrimitivePortRequest = (input: PrimitivePortCallInput) => ({
  attemptRef: input.input.attemptRef,
  scrollExecutionRef: input.input.scrollExecutionRef,
  idempotencyKey: input.input.idempotencyKey,
  sessionId: input.input.sessionId,
  roundId: input.input.roundId,
  videoVisitId: input.input.videoVisitId,
  geometryGuardProofRef: input.input.geometryGuardProofRef,
  sourceCoordinateProofRef: input.input.sourceCoordinateProofRef,
  sourceTargetRef: input.input.sourceTargetRef,
  coordinateSpace: input.input.coordinateSpace,
  anchorPoint: input.input.executableAnchor,
  deltaX: input.input.executableDelta.deltaX,
  deltaY: input.input.executableDelta.deltaY,
  repeatIndex: input.iteration,
  repeatTotal: input.input.repeat,
  targetLabel: input.input.targetLabel,
  timeoutMs: input.input.timeoutMs,
  postClickObservation: true,
  operatorApprovalRef: input.input.operatorApprovalRef,
  abortSignal: input.abortController.signal,
});

const createPrimitiveTimeoutCall = (
  input: PrimitivePortCallInput,
  setTimeoutHandle: (handle: ReturnType<typeof setTimeout>) => void,
): Promise<PrimitivePortResult> => new Promise((_, reject) => {
  const handle = setTimeout(() => {
    input.markTimeoutTriggered();
    input.abortController.abort(new Error(`Mouse Scroll primitive timed out after ${input.input.timeoutMs}ms.`));
    reject(new Error(`Mouse Scroll primitive timed out after ${input.input.timeoutMs}ms.`));
  }, input.input.timeoutMs);
  setTimeoutHandle(handle);
  input.setTimeoutHandle(handle);
});

export async function runPrimitivePortCall(input: PrimitivePortCallInput): Promise<PrimitivePortResult> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const primitiveCall = input.input.context.primitivePort.scroll(buildPrimitivePortRequest(input));
  const timeoutCall = createPrimitiveTimeoutCall(input, (handle) => {
    timeoutHandle = handle;
  });

  return Promise.race([primitiveCall, timeoutCall]).finally(() => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  });
}
