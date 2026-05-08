import type { MouseClickAbilityContext, MouseClickCoordinateSpace, MouseClickButton, MouseClickCount } from "../contract.js";
import type { PrimitiveClickResult } from "./primitive-click-runner-result.js";
import { createPrimitiveCallFrame } from "./primitive-click-runner-frame.js";
import { getImmediateRejection } from "./primitive-click-runner-guard.js";
import {
  releasePrimitiveExecutionSlot,
  reservePrimitiveExecutionSlot,
} from "./primitive-click-runner-state.js";
import {
  resolvePrimitivePortResult,
  resolveThrownPrimitiveFailure,
} from "./primitive-click-runner-outcome.js";

type RunPrimitiveClickInput = {
  context: MouseClickAbilityContext;
  attemptRef: string;
  actionExecutionRef: string;
  idempotencyKey: string;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  geometryGuardProofRef: string;
  sourceCoordinateProofRef: string;
  sourceTargetRef: string;
  operatorApprovalRef: string | null;
  targetLabel: string;
  coordinateSpace: MouseClickCoordinateSpace;
  executableCoordinate: { x: number; y: number };
  button: MouseClickButton;
  clickCount: MouseClickCount;
  timeoutMs: number;
  maxDurationMs: number;
};

type PrimitivePortResult = Awaited<ReturnType<MouseClickAbilityContext["primitivePort"]["click"]>>;

const runPrimitivePortCall = async (
  input: RunPrimitiveClickInput,
  abortController: AbortController,
  setTimeoutHandle: (handle: ReturnType<typeof setTimeout>) => void,
  markTimeoutTriggered: () => void,
): Promise<PrimitivePortResult> => {
  return Promise.race([
    input.context.primitivePort.click({
      attemptRef: input.attemptRef,
      actionExecutionRef: input.actionExecutionRef,
      idempotencyKey: input.idempotencyKey,
      sessionId: input.sessionId,
      roundId: input.roundId,
      videoVisitId: input.videoVisitId,
      geometryGuardProofRef: input.geometryGuardProofRef,
      sourceCoordinateProofRef: input.sourceCoordinateProofRef,
      sourceTargetRef: input.sourceTargetRef,
      coordinateSpace: input.coordinateSpace,
      executableCoordinate: input.executableCoordinate,
      button: input.button,
      clickCount: input.clickCount,
      targetLabel: input.targetLabel,
      timeoutMs: input.timeoutMs,
      postClickObservation: true,
      operatorApprovalRef: input.operatorApprovalRef,
      abortSignal: abortController.signal,
    }),
    new Promise<never>((_, reject) => {
      const timeoutHandle = setTimeout(() => {
        markTimeoutTriggered();
        abortController.abort();
        reject(new Error("Mouse Click primitive timed out before completion."));
      }, input.timeoutMs);
      setTimeoutHandle(timeoutHandle);
    }),
  ]);
};

export async function runPrimitiveClick(input: RunPrimitiveClickInput): Promise<PrimitiveClickResult> {
  const frame = createPrimitiveCallFrame(input.context, input.actionExecutionRef);
  const immediateRejection = getImmediateRejection(frame);
  if (immediateRejection) {
    return immediateRejection;
  }

  reservePrimitiveExecutionSlot();
  const abortController = new AbortController();
  let timeoutTriggered = false;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    const primitiveResult = await runPrimitivePortCall(
      input,
      abortController,
      (handle) => { timeoutHandle = handle; },
      () => { timeoutTriggered = true; },
    );
    return resolvePrimitivePortResult({
      frame,
      primitiveResult,
      endedSnapshot: input.context.clock.now(),
      timeoutTriggered,
      maxDurationMs: input.maxDurationMs,
    });
  } catch (error) {
    return resolveThrownPrimitiveFailure({
      frame,
      endedSnapshot: input.context.clock.now(),
      error,
      timeoutTriggered,
      aborted: abortController.signal.aborted,
    });
  } finally {
    releasePrimitiveExecutionSlot();
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
