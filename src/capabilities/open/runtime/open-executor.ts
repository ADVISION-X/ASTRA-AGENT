import type { OpenResult, OpenTargetProfile, ParsedOpenRequest } from "../contract.js";
import type { OpenChildExecutionContext } from "./open-runtime-types.js";
import { executeOpenChildFlow } from "./open-executor-flow.js";

export async function executeOpenChild(input: {
  request: ParsedOpenRequest;
  profile: OpenTargetProfile;
  context: OpenChildExecutionContext;
}): Promise<OpenResult> {
  return executeOpenChildFlow(input);
}
