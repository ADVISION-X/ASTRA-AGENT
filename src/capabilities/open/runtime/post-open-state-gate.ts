import type { BrowserSessionSnapshot, OpenNavigationDecision, OpenTargetProfile } from "../contract.js";
import type { PostOpenStateEvaluationResult } from "./post-open-state-gate-helpers.js";
import { evaluatePostOpenStateSnapshot } from "./post-open-state-gate-helpers.js";

export function evaluatePostOpenState(input: {
  profile: OpenTargetProfile;
  beforeSession: BrowserSessionSnapshot;
  afterSession: BrowserSessionSnapshot;
  navigationDecision: OpenNavigationDecision;
  pageStateHandoffRef: string | null;
}): PostOpenStateEvaluationResult {
  return evaluatePostOpenStateSnapshot(input);
}