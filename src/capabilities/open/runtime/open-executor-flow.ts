import type { OpenResult, OpenTargetProfile, ParsedOpenRequest } from "../contract.js";
import type { OpenChildExecutionContext } from "./open-runtime-types.js";
import { completeOpenChildExecution } from "./open-executor-completion.js";
import { resolveOpenChildPreflight } from "./open-executor-preflight.js";

export async function executeOpenChildFlow(input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  context: OpenChildExecutionContext;
}): Promise<OpenResult> {
  const preflight = await resolveOpenChildPreflight(input);
  if ("failureResult" in preflight) {
    return preflight.failureResult;
  }

  return completeOpenChildExecution({
    request: input.request,
    profile: input.profile,
    context: input.context,
    state: preflight,
  });
}
