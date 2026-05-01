import type { PrimitiveScrollResult } from "./primitive-scroll-runner-result.js";
import { createPrimitiveCallFrame } from "./primitive-scroll-frame.js";
import { buildImmediateRejection } from "./primitive-scroll-failure-builder.js";
import { buildSuccessResult } from "./primitive-scroll-success-builder.js";
import { runScrollIteration } from "./primitive-scroll-single-iteration.js";
import type { PrimitiveExecutionStore, RunPrimitiveScrollInput } from "./primitive-scroll-runner-types.js";
import { markPrimitiveScrollFinished, markPrimitiveScrollStarted } from "./primitive-scroll-runner-state.js";

export async function runPrimitiveScroll(input: RunPrimitiveScrollInput): Promise<PrimitiveScrollResult> {
  const frame = createPrimitiveCallFrame(input);
  const immediateRejection = buildImmediateRejection(frame, input.context);
  if (immediateRejection) {
    return immediateRejection;
  }

  const store: PrimitiveExecutionStore = { primitiveExecutionRefs: [], perIterationPrimitiveProofs: [] };
  markPrimitiveScrollStarted();
  try {
    for (let iteration = 1; iteration <= input.repeat; iteration += 1) {
      const failedResult = await runScrollIteration(input, frame, store, iteration);
      if (failedResult) {
        return failedResult;
      }
    }

    return buildSuccessResult(frame, input.context.clock.now(), store);
  } finally {
    markPrimitiveScrollFinished();
  }
}