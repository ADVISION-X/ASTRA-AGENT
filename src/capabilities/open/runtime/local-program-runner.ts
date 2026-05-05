import type { OpenResult, OpenTargetProfile, ParsedOpenRequest } from "../contract.js";
import { completeLocalProgramOpen } from "./local-program-completion.js";
import { buildTargetPolicyFailureResult } from "./open-execution-builders.js";
import { evaluateOpenTargetPolicy } from "./target-policy-gate.js";
import type { OpenChildExecutionContext } from "./open-runtime-types.js";

type LocalProgramProfile = Extract<OpenTargetProfile, { targetKind: "local-program" }>;

export async function executeOpenLocalProgramChildFlow(input: {
  request: ParsedOpenRequest;
  profile: LocalProgramProfile;
  context: OpenChildExecutionContext;
}): Promise<OpenResult> {
  const started = input.context.clock.now();
  const targetPolicy = evaluateOpenTargetPolicy({
    request: input.request,
    profile: input.profile,
    profileOverride: null,
  });
  if (!targetPolicy.ok) {
    return buildTargetPolicyFailureResult({
      request: input.request,
      profile: input.profile,
      startedAt: started,
      endedAt: input.context.clock.now(),
      targetPolicyDecision: targetPolicy.decision,
      reason: targetPolicy.reason,
    });
  }

  return completeLocalProgramOpen({
    request: input.request,
    profile: input.profile,
    context: input.context,
    targetPolicyDecision: targetPolicy.decision,
    started,
  });
}
