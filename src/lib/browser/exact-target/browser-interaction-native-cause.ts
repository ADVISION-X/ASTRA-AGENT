const INTERACTION_NATIVE_CAUSES = new Set([
  "BROWSER_TARGET_INVALID",
  "BROWSER_DOCUMENT_INVALID",
  "BROWSER_ORIGIN_REJECTED",
]);

/** Returns only the Browser-owned, non-sensitive cause close set. */
export const browserInteractionNativeCauseCode = (value: unknown): string | null => {
  let candidate = value;
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof candidate === "string") {
      return INTERACTION_NATIVE_CAUSES.has(candidate) ? candidate : null;
    }
    if (!(candidate instanceof Error)) return null;
    if (INTERACTION_NATIVE_CAUSES.has(candidate.message)) return candidate.message;
    candidate = candidate.cause;
  }
  return null;
};

export const BROWSER_DOM_CANDIDATE_MISSING_STAGES = Object.freeze([
  "BROWSER_DOM_SCOPE_ABSENT",
  "BROWSER_DOM_SCOPE_INELIGIBLE",
  "BROWSER_DOM_SELECTOR_ABSENT",
  "BROWSER_DOM_CANDIDATE_INELIGIBLE",
] as const);

export type BrowserDomCandidateMissingStage = typeof BROWSER_DOM_CANDIDATE_MISSING_STAGES[number];

/** Returns the Browser-owned candidate-set missing stage, or null for any other value. */
export const browserDomCandidateMissingStage = (value: unknown): BrowserDomCandidateMissingStage | null =>
  typeof value === "string" && (BROWSER_DOM_CANDIDATE_MISSING_STAGES as readonly string[]).includes(value)
    ? value as BrowserDomCandidateMissingStage : null;
