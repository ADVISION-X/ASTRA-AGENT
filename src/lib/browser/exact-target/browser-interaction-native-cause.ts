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

/**
 * Closed 20x11 set for observational postcondition native causes: `BROWSER_POSTCONDITION_Q<i>__<C>`
 * where `i` is the first mismatched query index (0..19, the `assertObservationQueries` cap) and `C`
 * is that query's own cause (candidate-set ambiguous/missing, or one of the 9 ineligibility reasons).
 */
export const BROWSER_POSTCONDITION_QUERY_INDEX_MAX = 19;

const BROWSER_POSTCONDITION_BASE_CAUSES = Object.freeze([
  "BROWSER_DOM_CANDIDATE_AMBIGUOUS",
  "BROWSER_DOM_CANDIDATE_MISSING",
  "DISCONNECTED",
  "NO_LAYOUT_BOX",
  "DISPLAY_HIDDEN",
  "VISIBILITY_HIDDEN",
  "OPACITY_HIDDEN",
  "HTML_HIDDEN",
  "ARIA_HIDDEN",
  "INERT",
  "TEXT_MISMATCH",
] as const);

export type BrowserPostconditionBaseCause = typeof BROWSER_POSTCONDITION_BASE_CAUSES[number];

export type BrowserPostconditionNativeCause =
  `BROWSER_POSTCONDITION_Q${number}__${BrowserPostconditionBaseCause}`;

const BROWSER_POSTCONDITION_NATIVE_CAUSES: ReadonlySet<string> = new Set(
  Array.from({ length: BROWSER_POSTCONDITION_QUERY_INDEX_MAX + 1 }, (_, index) => index)
    .flatMap((index) => BROWSER_POSTCONDITION_BASE_CAUSES.map((cause) =>
      `BROWSER_POSTCONDITION_Q${index}__${cause}`)),
);

/** Composes the one closed-set code for a mismatch at `queryIndex` with base cause `cause`. */
export const browserPostconditionNativeCause = (
  queryIndex: number,
  cause: BrowserPostconditionBaseCause,
): BrowserPostconditionNativeCause => `BROWSER_POSTCONDITION_Q${queryIndex}__${cause}` as
  BrowserPostconditionNativeCause;

/** Returns true only for a code in the closed 220-member P1 set. */
export const browserPostconditionNativeCauseValid = (value: unknown): value is BrowserPostconditionNativeCause =>
  typeof value === "string" && BROWSER_POSTCONDITION_NATIVE_CAUSES.has(value);
