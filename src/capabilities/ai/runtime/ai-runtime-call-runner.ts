import type { AiExecutionContext, AiRuntimeExecutionOutput, ParsedAiAbilityInput } from "../contract.js";
import { AiRuntimeExecutionOutputSchema } from "../schema.js";
import { buildAiRuntimeCallIdentity } from "./ai-idempotency.js";
import { resolveAiTimeoutPolicy } from "./ai-timeout-policy-gate.js";

export async function runAiRuntimeCall(input: {
  request: ParsedAiAbilityInput;
  context: AiExecutionContext;
}): Promise<AiRuntimeExecutionOutput> {
  const timeoutPolicy = resolveAiTimeoutPolicy(input.request);
  const identity = buildAiRuntimeCallIdentity(input.request);
  const result = await input.context.runtime.execute(input.request);

  return AiRuntimeExecutionOutputSchema.parse({
    ...result,
    runtimeCallId: result.runtimeCallId ?? identity.runtimeCallId,
    timeoutMs: result.timeoutMs ?? timeoutPolicy.timeoutMs,
  });
}
