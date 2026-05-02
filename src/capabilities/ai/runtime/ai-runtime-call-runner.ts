import type { AiExecutionContext, AiRuntimeExecutionOutput, ParsedAiAbilityInput } from "../contract.js";
import { AiRuntimeExecutionOutputSchema } from "../schema.js";
import { buildAiRuntimeCallIdentity } from "./ai-idempotency.js";
import { resolveAiTimeoutPolicy } from "./ai-timeout-policy-gate.js";

function abortRuntimeCall(controller: AbortController, timeoutMs: number) {
  controller.abort(`AI runtime timed out after ${timeoutMs}ms.`);
}

export async function runAiRuntimeCall(input: {
  request: ParsedAiAbilityInput;
  context: AiExecutionContext;
}): Promise<AiRuntimeExecutionOutput> {
  const timeoutPolicy = resolveAiTimeoutPolicy(input.request);
  const identity = buildAiRuntimeCallIdentity(input.request);
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => abortRuntimeCall(controller, timeoutPolicy.timeoutMs), timeoutPolicy.timeoutMs);

  try {
    const result = await input.context.runtime.execute(input.request, { signal: controller.signal });

    return AiRuntimeExecutionOutputSchema.parse({
      ...result,
      runtimeCallId: result.runtimeCallId ?? identity.runtimeCallId,
      timeoutMs: result.timeoutMs ?? timeoutPolicy.timeoutMs,
    });
  } finally {
    clearTimeout(timeoutHandle);
  }
}
