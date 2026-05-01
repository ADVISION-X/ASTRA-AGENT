import { completePostActionVerification } from "./verification-success-result.js";
import { runPostActionVerificationGateSequence } from "./verification-gate-sequence.js";
import type { ParsedPostActionVerificationAbilityInput, PostActionVerificationAbilityResult } from "../contract.js";
import type { PostActionVerificationChildCapability, PostActionVerificationRuntimeContext } from "./post-action-verification-runtime-context.js";

export async function executePostActionVerification(input: {
  request: ParsedPostActionVerificationAbilityInput;
  context: PostActionVerificationRuntimeContext;
  capability: PostActionVerificationChildCapability;
}): Promise<PostActionVerificationAbilityResult> {
  const gateSequence = await runPostActionVerificationGateSequence({
    request: input.request,
    context: input.context,
  });

  if (!gateSequence.ok) {
    return gateSequence.result;
  }

  const assessment = await input.capability.execute(input.request, input.context);
  const ended = input.context.clock.now();

  return completePostActionVerification({
    request: input.request,
    context: input.context,
    assessment,
    gateSnapshot: gateSequence.gateSnapshot,
    ended,
  });
}