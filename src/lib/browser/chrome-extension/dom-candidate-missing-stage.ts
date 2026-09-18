import {
  browserDomCandidateMissingStage as stageOf,
  type BrowserDomCandidateMissingStage,
} from "../exact-target/browser-interaction-native-cause.js";

/** Count-only page source shared by both coherent candidate functions. */
export const CANDIDATE_MISSING_STAGE_SOURCE = `const candidateMissing = (scopeRaw, scopeEligible, raw) =>
  "BROWSER_DOM_CANDIDATE_MISSING:" + (scopeRaw === 0 ? "BROWSER_DOM_SCOPE_ABSENT"
    : scopeEligible === 0 ? "BROWSER_DOM_SCOPE_INELIGIBLE"
      : raw === 0 ? "BROWSER_DOM_SELECTOR_ABSENT" : "BROWSER_DOM_CANDIDATE_INELIGIBLE");`;

/** Decodes the page reply into the unchanged primary code carrying the stage as its cause. */
export const candidateMissingFailure = (value: unknown): Error | null => {
  if (typeof value !== "string" || !value.startsWith("BROWSER_DOM_CANDIDATE_MISSING:")) return null;
  const stage = stageOf(value.slice("BROWSER_DOM_CANDIDATE_MISSING:".length));
  if (!stage) throw new Error("BROWSER_DOM_READ_INVALID");
  return new Error("BROWSER_DOM_CANDIDATE_MISSING", { cause: new Error(stage) });
};

export const candidateMissingStage = (error: unknown): BrowserDomCandidateMissingStage | null =>
  error instanceof Error && error.message === "BROWSER_DOM_CANDIDATE_MISSING" && error.cause instanceof Error
    ? stageOf(error.cause.message) : null;
