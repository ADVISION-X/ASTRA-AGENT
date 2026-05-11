/**
 * browser-observation.ts — Raw browser observation helper.
 *
 * Provides a minimal read of raw browser state:
 *   currentUrl, currentTitle, browserLoginState, rawRuntimeSignals.
 *
 * This is NOT a capability group, NOT a MuscleMemory action, NOT an AI input owner.
 * It is optional support evidence only.
 *
 * AI Visual Mission Judge owns all page readiness, blocker, semantic, and
 * business-truth decisions. This helper only provides raw string observations.
 *
 * Forbidden output fields:
 *   feedReady, pageReady, pageCorrect, pageStateType, loginSemantic,
 *   captchaSemantic, safetySemantic, feedSemantic, videoSemantic,
 *   commentSemantic, blockerDecision, actionSemanticSuccess,
 *   semanticDecision, businessTruth.
 */

export type RawBrowserObservation = {
  /** Unique ref for this observation record. */
  observationRef: string;
  /** Current URL from the browser session, if available. */
  currentUrl?: string;
  /** Current page title from the browser session, if available. */
  currentTitle?: string;
  /**
   * Raw login state token from the browser session.
   * Not a semantic decision — AI owns login interpretation.
   */
  browserLoginState?: string;
  /**
   * Any raw runtime signals available from the session.
   * Uninterpreted — AI owns meaning.
   */
  rawRuntimeSignals?: Record<string, unknown>;
  /** Optional ref to a snapshot proof that was active at observation time. */
  snapshotProofRef?: string;
  /** ISO timestamp when this observation was captured. */
  observedAt: string;
  /** Outcome of reading the browser state. */
  status: "success" | "failed" | "review_required";
  /** Populated only when status is not success. */
  failureReason?: string;
};

export type RawBrowserObservationInput = {
  requestId: string;
  missionId?: string;
  runId?: string;
  sessionId?: string;
  roundId?: string;
  browserSessionRef?: string;
  snapshotProofRef?: string;
  timeoutMs?: number;
};

type BrowserSessionSource = {
  currentUrl?: string | null;
  currentTitle?: string | null;
  loginState?: string | null;
};

/**
 * Reads a raw browser observation from the provided browser session source.
 *
 * Does NOT interpret login state, readiness, blockers, or any page semantics.
 * AI Visual Mission Judge owns all semantic decisions.
 */
export function readRawBrowserObservation(
  input: RawBrowserObservationInput,
  source: BrowserSessionSource,
): RawBrowserObservation {
  const observationRef = `raw-browser-obs:${input.requestId}:${Date.now()}`;
  const observedAt = new Date().toISOString();

  try {
    const result: RawBrowserObservation = {
      observationRef,
      observedAt,
      status: "success",
    };

    if (source.currentUrl != null) {
      result.currentUrl = source.currentUrl;
    }
    if (source.currentTitle != null) {
      result.currentTitle = source.currentTitle;
    }
    if (source.loginState != null) {
      result.browserLoginState = source.loginState;
    }
    if (input.snapshotProofRef != null) {
      result.snapshotProofRef = input.snapshotProofRef;
    }

    return result;
  } catch (err) {
    return {
      observationRef,
      observedAt,
      status: "failed",
      failureReason: err instanceof Error ? err.message : "unknown error reading browser state",
    };
  }
}
