import type {
  BrowserDomIneligibleCandidate,
  BrowserDomIneligibleReason,
  BrowserDomIntent,
  BrowserDomObservationPacketV2,
} from "../exact-target/browser-dom-intent.js";
import type { ExtensionDebuggerRuntime } from "./debugger-runtime.js";
import { executeCoherentObservation } from "./dom-coherent-observation.js";
import { attribute, describeNode, documentState, queryAll, queryCandidateSet,
  queryVisibleTextMatches } from "./dom-query-runtime.js";
import type { ExtensionExactTarget } from "./exact-target-runtime.js";

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
    | "BROWSER_DOM_CANDIDATE_AMBIGUOUS" | null;
}>;

const waitForNextBoundedObservation = async (deadline: number): Promise<void> => {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return;
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, Math.min(50, remaining)));
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
): Promise<MatchReadback> => {
  const timeout = timeoutMs ?? match.timeoutMs ?? 1;
  await debuggerRuntime.awaitPageReadPermission();
  const deadline = Date.now() + timeout;
  while (true) {
    const candidates = await queryCandidateSet(
      debuggerRuntime, target.tabId, match.selector, match.expectedMatches + 1, undefined,
      match.textEquals !== undefined ? { value: match.textEquals, exact: true }
        : match.textContains !== undefined ? { value: match.textContains, exact: false } : undefined,
      match.readEligibility,
    );
    const verified = candidates.eligibleCount === match.expectedMatches;
    const firstRejection = candidates.rejections[0]?.reasons[0];
    const nativeCauseCode = verified ? null
      : candidates.eligibleCount > match.expectedMatches ? "BROWSER_DOM_CANDIDATE_AMBIGUOUS" as const
        : firstRejection ?? "BROWSER_DOM_CANDIDATE_MISSING";
    const readback = Object.freeze({
      verified, rawCount: candidates.rawCount, eligibleCount: candidates.eligibleCount,
      rejections: candidates.rejections, nativeCauseCode,
    });
    if (verified || Date.now() >= deadline) return readback;
    await waitForNextBoundedObservation(deadline);
  }
};

const waitForObservation = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  postcondition: NonNullable<ClickIntent["postClickObservation"]>,
  timeoutMs?: number,
): Promise<ObservationReadback> => {
  const timeout = timeoutMs ?? postcondition.timeoutMs ?? 1;
  await runtime.awaitPageReadPermission();
  const deadline = Date.now() + timeout;
  const specs = postcondition.queries.map(({ expectedEligibleCount: _expected, ...query }) => query);
  while (true) {
    const observation = await executeCoherentObservation(runtime, target, specs);
    const queries = observation.queries as BrowserDomObservationPacketV2["queries"];
    const mismatchIndex = queries.findIndex((query, index) =>
      query.eligibleCount !== postcondition.queries[index]!.expectedEligibleCount);
    const verified = mismatchIndex === -1;
    const mismatch = verified ? undefined : queries[mismatchIndex];
    const expected = verified ? undefined : postcondition.queries[mismatchIndex]!.expectedEligibleCount;
    const firstRejection = mismatch?.rejections[0]?.reasons[0];
    const nativeCauseCode = verified ? null
      : mismatch!.eligibleCount > expected! ? "BROWSER_DOM_CANDIDATE_AMBIGUOUS" as const
        : firstRejection ?? "BROWSER_DOM_CANDIDATE_MISSING";
    const readback = Object.freeze({ verified, observation, nativeCauseCode });
    if (verified || Date.now() >= deadline) return readback;
    await waitForNextBoundedObservation(deadline);
  }
};

const waitForUrl = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  postcondition: Readonly<{ equals?: string; notEquals?: string; timeoutMs?: number }>,
  timeoutMs?: number,
): Promise<boolean> => {
  const timeout = timeoutMs ?? postcondition.timeoutMs ?? 1;
  await debuggerRuntime.awaitPageReadPermission();
  const deadline = Date.now() + timeout;
  do {
    const document = await documentState(debuggerRuntime, target.tabId) as { url?: unknown };
    if (postcondition.equals !== undefined && document.url === postcondition.equals) return true;
    if (postcondition.notEquals !== undefined && document.url !== postcondition.notEquals) return true;
    if (Date.now() >= deadline) return false;
    await waitForNextBoundedObservation(deadline);
  } while (Date.now() <= deadline);
  return false;
};

export const waitForInteractionAttribute = async (
  debuggerRuntime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ClickIntent | HoverIntent,
  expectedMatches: number,
  postAttribute: NonNullable<ClickIntent["postClickAttribute"]> | HoverIntent["postHoverAttribute"],
  timeoutMs?: number,
): Promise<boolean> => {
  const timeout = timeoutMs ?? postAttribute.timeoutMs ?? 1;
  await debuggerRuntime.awaitPageReadPermission();
  const deadline = Date.now() + timeout;
  do {
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
          === postAttribute.equals) return true;
    }
    if (Date.now() >= deadline) return false;
    await waitForNextBoundedObservation(deadline);
  } while (Date.now() <= deadline);
  return false;
};

export const verifyClickPostcondition = async (
  runtime: ExtensionDebuggerRuntime,
  target: ExtensionExactTarget,
  intent: ClickIntent,
  timeoutMs?: number,
): Promise<Readonly<{
  verified: boolean;
  match?: MatchReadback;
  observation?: ObservationReadback;
}>> => intent.postClickAttribute !== undefined
  ? { verified: await waitForInteractionAttribute(
    runtime, target, intent, 1, intent.postClickAttribute, timeoutMs,
  ) }
  : intent.postClickMatch !== undefined
    ? waitForMatch(runtime, target, intent.postClickMatch, timeoutMs).then((match) => ({
      verified: match.verified, match,
    }))
    : intent.postClickObservation !== undefined
      ? waitForObservation(runtime, target, intent.postClickObservation, timeoutMs).then((observation) => ({
        verified: observation.verified, observation,
      }))
      : { verified: await waitForUrl(runtime, target, intent.postClickUrl!, timeoutMs) };
