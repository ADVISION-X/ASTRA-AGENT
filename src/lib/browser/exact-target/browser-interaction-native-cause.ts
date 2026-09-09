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
