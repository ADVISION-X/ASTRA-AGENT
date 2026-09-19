import type {
  BrowserDomIneligibleCandidate,
  BrowserDomIneligibleReason,
  BrowserDomIntent,
  BrowserDomObservationPacketV2,
} from "../exact-target/browser-dom-intent.js";
import {
  browserPostconditionNativeCause,
  type BrowserPostconditionNativeCause,
} from "../exact-target/browser-interaction-native-cause.js";
import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import { executeCoherentObservation } from "./dom-coherent-observation.js";
import { attribute, describeNode, documentState, queryAll, queryCandidateSet,
  queryVisibleTextMatches } from "./dom-query-runtime.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";
import { requireCanonicalGptConversationUrl } from
  "../exact-target/browser-site-policy-registry.js";
import {
  currentGptPageIdentity,
  readWithTransientDomConfirmation,
  waitForNextChatGptObservation,
} from "./chatgpt-page-access-gate.js";

type ClickIntent = Extract<BrowserDomIntent, { kind: "click" }>;
type HoverIntent = Extract<BrowserDomIntent, { kind: "hover" }>;
type CurrentDocumentAssertion = () => void;

export type MatchReadback = Readonly<{
  verified: boolean;
  rawCount: number;
  eligibleCount: number;
  rejections: readonly BrowserDomIneligibleCandidate[];
  nativeCauseCode: BrowserDomIneligibleReason | "BROWSER_DOM_CANDIDATE_MISSING"
    | "BROWSER_DOM_CANDIDATE_AMBIGUOUS" | null;
}>;

export type ObservationReadback = Readonly<{
  verified: boolean;
  observation: Awaited<ReturnType<typeof executeCoherentObservation>>;
  nativeCauseCode: BrowserDomIneligibleReason | "BROWSER_DOM_CANDIDATE_MISSING"
    | "BROWSER_DOM_CANDIDATE_AMBIGUOUS" | BrowserPostconditionNativeCause | null;
}>;

export const waitForNextBoundedObservation = waitForNextChatGptObservation;

const TRANSIENT_REJECTION_REASONS = new Set([
  "DISCONNECTED", "NO_LAYOUT_BOX", "DISPLAY_HIDDEN", "VISIBILITY_HIDDEN",
  "OPACITY_HIDDEN", "HTML_HIDDEN", "ARIA_HIDDEN", "INERT",
]);

const matchStillTransient = (
  rawCount: number,
  eligibleCount: number,
  expectedMatches: number,
  rejections: readonly BrowserDomIneligibleCandidate[],
): boolean => {
  if (expectedMatches === 0) return eligibleCount === 1 && rawCount === 1;
  if (eligibleCount >= expectedMatches || rawCount > expectedMatches) return false;
  return rawCount === 0 || rejections.every((entry) =>
    entry.reasons.every((reason) => TRANSIENT_REJECTION_REASONS.has(reason)));
};

const exactOutgoingTurnVerified = (
  observation: Awaited<ReturnType<typeof executeCoherentObservation>>,
  expected: NonNullable<ClickIntent["preClickExactOutgoingTurn"]>,
): boolean => {
  const matches = observation.queries[0]?.matches;
  const match = Array.isArray(matches) ? matches[0] : undefined;
  if (!match || typeof match !== "object" || Array.isArray(match)) return false;
  try { return (match as Readonly<Record<string, unknown>>).exactGptUserPromptHash
    === expected.expectedPromptHash
    && requireCanonicalGptConversationUrl(observation.currentUrl) === observation.currentUrl; }
  catch { return false; }
};

export const matchReceiptEvidence = (readback: MatchReadback): Readonly<Record<string, unknown>> => ({
  postconditionRawCount: readback.rawCount,
  postconditionEligibleCount: readback.eligibleCount,
  postconditionRejections: readback.rejections,
  ...(readback.verified || readback.nativeCauseCode === null
    ? {} : { nativeCauseCode: readback.nativeCauseCode }),
});

export const zeroActionMatchReceipt = (
  assertCurrent: CurrentDocumentAssertion,
  readback: MatchReadback,
): Readonly<Record<string, unknown>> => {
  assertCurrent();
  return Object.freeze({ candidateCount: 1, identityRevalidated: true, mutationCount: 0,
    postconditionVerified: true, zeroActionSatisfied: true, ...matchReceiptEvidence(readback) });
};

export const observationReceiptEvidence = (
  readback: ObservationReadback,
): Readonly<Record<string, unknown>> => ({
  postconditionObservation: readback.observation,
  ...(readback.verified || readback.nativeCauseCode === null
    ? {} : { nativeCauseCode: readback.nativeCauseCode }),
});

export const zeroActionObservationReceipt = (
  assertCurrent: CurrentDocumentAssertion,
  readback: ObservationReadback,
): Readonly<Record<string, unknown>> => {
  assertCurrent();
  return Object.freeze({ candidateCount: 1, identityRevalidated: true, mutationCount: 0,
    postconditionVerified: true, zeroActionSatisfied: true, ...observationReceiptEvidence(readback) });
};

export const waitForMatch = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  match: Readonly<{
    selector: string;
    expectedMatches: number;
    readEligibility?: "non-actionable-aria-state";
    textContains?: string;
    textEquals?: string;
    timeoutMs?: number;
  }>,
  timeoutMs?: number,
  allowTransientDomConfirmation = true,
  assertCurrent?: CurrentDocumentAssertion,
): Promise<MatchReadback> => {
  await debuggerRuntime.awaitPageReadPermission();
  const read = async (): Promise<MatchReadback> => {
    const candidates = await queryCandidateSet(
      debuggerRuntime, target.tabId, match.selector, match.expectedMatches + 1, undefined,
      match.textEquals !== undefined ? { value: match.textEquals, exact: true }
        : match.textContains !== undefined ? { value: match.textContains, exact: false } : undefined,
      match.readEligibility,
    );
    const verified = candidates.eligibleCount === match.expectedMatches;
    const firstRejection = candidates.rejections[0]?.reasons[0];
    return Object.freeze({
      verified, rawCount: candidates.rawCount, eligibleCount: candidates.eligibleCount,
      rejections: candidates.rejections,
      nativeCauseCode: verified ? null
        : candidates.eligibleCount > match.expectedMatches
          ? "BROWSER_DOM_CANDIDATE_AMBIGUOUS" as const
          : firstRejection ?? "BROWSER_DOM_CANDIDATE_MISSING" as const,
    });
  };
  if (!allowTransientDomConfirmation) {
    const deadline = Date.now() + (timeoutMs ?? match.timeoutMs ?? 1_500);
    while (true) {
      const readback = await read();
      if (readback.verified || Date.now() >= deadline
        || !await waitForNextBoundedObservation(deadline)) return readback;
    }
  }
  return readWithTransientDomConfirmation({
    read: async () => {
      assertCurrent?.();
      const readback = await read();
      return { value: readback, transient: timeoutMs !== 0 && !readback.verified
        && matchStillTransient(readback.rawCount, readback.eligibleCount,
          match.expectedMatches, readback.rejections) };
    },
    continuity: async () => {
      assertCurrent?.();
      return currentGptPageIdentity(debuggerRuntime, target.tabId);
    },
  });
};

const waitForObservation = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  postcondition: NonNullable<ClickIntent["postClickObservation"]>,
  timeoutMs?: number,
  exactOutgoing?: NonNullable<ClickIntent["preClickExactOutgoingTurn"]>,
  assertCurrent?: CurrentDocumentAssertion,
): Promise<ObservationReadback> => {
  await runtime.awaitPageReadPermission();
  const specs = postcondition.queries.map(({ expectedEligibleCount: _expected, ...query }) => query);
  const read = async (): Promise<Readonly<{
    readback: ObservationReadback;
    transient: boolean;
  }>> => {
    const observation = await executeCoherentObservation(runtime, target, specs);
    const queries = observation.queries as BrowserDomObservationPacketV2["queries"];
    const mismatchIndex = queries.findIndex((query, index) =>
      query.eligibleCount !== postcondition.queries[index]!.expectedEligibleCount);
    const verified = mismatchIndex === -1
      && (exactOutgoing === undefined || exactOutgoingTurnVerified(observation, exactOutgoing));
    const evidenceIndex = mismatchIndex === -1 ? 0 : mismatchIndex;
    const mismatch = verified ? undefined : queries[evidenceIndex];
    const expected = verified ? undefined : postcondition.queries[evidenceIndex]!.expectedEligibleCount;
    const firstRejection = mismatch?.rejections[0]?.reasons[0];
    const nativeCauseCode = verified ? null : exactOutgoing !== undefined
      ? "BROWSER_DOM_CANDIDATE_MISSING" as const
      : browserPostconditionNativeCause(evidenceIndex, mismatch!.eligibleCount > expected!
        ? "BROWSER_DOM_CANDIDATE_AMBIGUOUS" as const
        : firstRejection ?? "BROWSER_DOM_CANDIDATE_MISSING" as const);
    const readback = Object.freeze({ verified, observation, nativeCauseCode });
    const transient = mismatch !== undefined && matchStillTransient(
      mismatch.rawCount, mismatch.eligibleCount, expected!, mismatch.rejections,
    );
    return Object.freeze({ readback, transient });
  };
  if (exactOutgoing !== undefined) {
    const deadline = Date.now() + (timeoutMs ?? postcondition.timeoutMs ?? 1_500);
    while (true) {
      const current = await read();
      if (current.readback.verified || timeoutMs === 0 || Date.now() >= deadline
        || !await waitForNextBoundedObservation(deadline)) return current.readback;
    }
  }
  return readWithTransientDomConfirmation({
    read: async () => {
      assertCurrent?.();
      const current = await read();
      return { value: current.readback, transient: timeoutMs !== 0 && current.transient };
    },
    continuity: async () => {
      assertCurrent?.();
      return currentGptPageIdentity(runtime, target.tabId);
    },
  });
};

const waitForUrl = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  postcondition: Readonly<{ equals?: string; notEquals?: string; timeoutMs?: number }>,
  _timeoutMs?: number,
): Promise<boolean> => {
  await debuggerRuntime.awaitPageReadPermission();
  const document = await documentState(debuggerRuntime, target.tabId) as { url?: unknown };
  if (postcondition.equals !== undefined && document.url === postcondition.equals) return true;
  return postcondition.notEquals !== undefined && document.url !== postcondition.notEquals;
};

export const waitForInteractionAttribute = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ClickIntent | HoverIntent,
  expectedMatches: number,
  postAttribute: NonNullable<ClickIntent["postClickAttribute"]> | HoverIntent["postHoverAttribute"],
  timeoutMs?: number,
  assertCurrent?: CurrentDocumentAssertion,
): Promise<boolean> => {
  await debuggerRuntime.awaitPageReadPermission();
  return readWithTransientDomConfirmation({
    read: async () => {
      assertCurrent?.();
      const nodes = intent.expectedTextEquals !== undefined
      ? await queryVisibleTextMatches({ runtime: debuggerRuntime, tabId: target.tabId,
        selector: intent.selector, expectedText: intent.expectedTextEquals,
        exact: true, limit: expectedMatches + 1, ...(intent.scope ? { scope: intent.scope } : {}) })
      : intent.expectedText !== undefined
        ? await queryVisibleTextMatches({ runtime: debuggerRuntime, tabId: target.tabId,
          selector: intent.selector, expectedText: intent.expectedText,
          exact: false, limit: expectedMatches + 1, ...(intent.scope ? { scope: intent.scope } : {}) })
        : await queryAll(debuggerRuntime, target.tabId, intent.selector, expectedMatches + 1, intent.scope);
      if (nodes.length === expectedMatches) {
        const currentNodeId = nodes[0];
        if (currentNodeId !== undefined
          && attribute(await describeNode(debuggerRuntime, target.tabId, currentNodeId), postAttribute.name)
            === postAttribute.equals) return { value: true, transient: false };
        return { value: false, transient: false };
      }
      return { value: false, transient: timeoutMs !== 0 && nodes.length < expectedMatches };
    },
    continuity: async () => {
      assertCurrent?.();
      return currentGptPageIdentity(debuggerRuntime, target.tabId);
    },
  });
};

export const verifyClickPostcondition = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ClickIntent,
  timeoutMs?: number,
  allowTransientDomConfirmation = true,
  assertCurrent?: CurrentDocumentAssertion,
): Promise<Readonly<{
  verified: boolean;
  match?: MatchReadback;
  observation?: ObservationReadback;
}>> => intent.postClickAttribute !== undefined
  ? { verified: await waitForInteractionAttribute(
    runtime, target, intent, 1, intent.postClickAttribute, timeoutMs, assertCurrent,
  ) }
  : intent.postClickMatch !== undefined
    ? waitForMatch(
      runtime, target, intent.postClickMatch, timeoutMs, allowTransientDomConfirmation, assertCurrent,
    ).then((match) => ({
      verified: match.verified, match,
    }))
    : intent.postClickObservation !== undefined
      ? waitForObservation(runtime, target, intent.postClickObservation, timeoutMs,
        intent.preClickExactOutgoingTurn, assertCurrent).then((observation) => ({
        verified: observation.verified, observation,
      }))
      : { verified: await waitForUrl(runtime, target, intent.postClickUrl!, timeoutMs) };
