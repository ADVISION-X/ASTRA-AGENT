import type { BrowserSessionSnapshot, OpenNavigationDecision, OpenTargetProfile } from "../contract.js";
import type { PostOpenStateEvaluationResult } from "./post-open-state-gate-helpers.js";
import { evaluatePostOpenStateSnapshot } from "./post-open-state-gate-helpers.js";

type WebOpenTargetProfile = Extract<OpenTargetProfile, { targetKind: "platform-feed" | "local-workbench" }>;

export function evaluatePostOpenState(input: {
  profile: WebOpenTargetProfile;
  beforeSession: BrowserSessionSnapshot;
  afterSession: BrowserSessionSnapshot;
  navigationDecision: OpenNavigationDecision;
  pageStateHandoffRef: string | null;
}): PostOpenStateEvaluationResult {
  return evaluatePostOpenStateSnapshot(input);
}
