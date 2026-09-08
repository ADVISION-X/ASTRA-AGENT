import {
  GPT_CHILD_CAPABILITY_CONTRACTS,
  type GptChildCapabilityId,
  type GptExecutionContext,
} from "./contract.js";
import { executionFailure } from "../../lib/execution-failure.js";

export type CurrentDocument = Readonly<{
  ref: string | null;
  targetRef: string | null;
  navigationEpoch: number | null;
  url: string | null;
}>;

export type DocumentTransitionBoundary = "ordinary" | "exact-canonical-navigation"
  | "normal-provider-reacquire";

export const currentDocument = (context: GptExecutionContext): CurrentDocument => context.browser
  ? Object.freeze({
    ref: context.browser.document.documentRef,
    targetRef: context.browser.document.targetRef,
    navigationEpoch: context.browser.document.navigationEpoch,
    url: null,
  })
  : Object.freeze({ ref: null, targetRef: null, navigationEpoch: null, url: null });

const hasNoDocument = (document: CurrentDocument): boolean =>
  document.ref === null && document.targetRef === null && document.navigationEpoch === null;

const hasCompleteDocument = (document: CurrentDocument): boolean =>
  document.ref !== null && document.targetRef !== null && document.navigationEpoch !== null;

const isSameDocument = (before: CurrentDocument, after: CurrentDocument): boolean =>
  before.ref === after.ref && before.navigationEpoch === after.navigationEpoch;

const isForwardDocument = (before: CurrentDocument, after: CurrentDocument): boolean =>
  after.navigationEpoch! > before.navigationEpoch! && after.ref !== before.ref;

const isExactNextDocument = (before: CurrentDocument, after: CurrentDocument): boolean =>
  after.navigationEpoch === before.navigationEpoch! + 1 && after.ref !== before.ref;

export const documentTransitionAllowed = (
  childCapabilityId: GptChildCapabilityId,
  before: CurrentDocument,
  after: CurrentDocument,
  boundary: DocumentTransitionBoundary = "ordinary",
): boolean => {
  const policy = GPT_CHILD_CAPABILITY_CONTRACTS[childCapabilityId].allowedDocumentTransition;
  if (policy === "not-applicable") return hasNoDocument(before) && hasNoDocument(after);
  if (!hasCompleteDocument(before) || !hasCompleteDocument(after)) return false;
  if (before.targetRef !== after.targetRef) return false;
  if (policy === "forbidden") return isSameDocument(before, after);
  if (policy === "exact-navigation-or-normal-reacquire") {
    if (boundary === "ordinary") return isSameDocument(before, after);
    return boundary === "normal-provider-reacquire"
      ? isSameDocument(before, after) || isForwardDocument(before, after)
      : isForwardDocument(before, after);
  }
  return isSameDocument(before, after) || isExactNextDocument(before, after);
};

export const documentTransitionObservable = (
  before: CurrentDocument,
  after: CurrentDocument,
): boolean => hasCompleteDocument(before) && hasCompleteDocument(after);

export const documentTransitionContext = (
  childCapabilityId: GptChildCapabilityId,
  context: GptExecutionContext,
  initialBoundary: CurrentDocument,
): Readonly<{ handlerContext: GptExecutionContext; boundary: () => CurrentDocument }> => {
  let documentBoundary = initialBoundary;
  const advance = (before: CurrentDocument, boundary: DocumentTransitionBoundary): void => {
    const after = currentDocument(context);
    if (!documentTransitionAllowed(childCapabilityId, before, after, boundary)) {
      throw executionFailure("failed", `GPT_DOCUMENT_TRANSITION_FORBIDDEN:${childCapabilityId}`);
    }
    documentBoundary = after;
  };
  const trackStableText = childCapabilityId === "wait_for_stable_gpt_text";
  const handlerContext = Object.freeze({
    ...context,
    ...(trackStableText && context.yieldForProviderWait ? {
      yieldForProviderWait: async (durationMs: number): Promise<void> => {
        const before = currentDocument(context);
        await context.yieldForProviderWait!(durationMs);
        advance(before, "normal-provider-reacquire");
      },
    } : {}),
    ...(trackStableText && context.navigateCrossConversationPoll ? {
      navigateCrossConversationPoll: async (
        canonicalConversationUrl: string,
        probeDeadlineAt: number,
      ): Promise<"navigated" | "reobserve" | "deadline"> => {
        const before = currentDocument(context);
        const outcome = await context.navigateCrossConversationPoll!(canonicalConversationUrl, probeDeadlineAt);
        if (outcome === "navigated") advance(before, "exact-canonical-navigation");
        if (outcome === "reobserve") advance(before, "normal-provider-reacquire");
        return outcome;
      },
    } : {}),
  });
  return Object.freeze({ handlerContext, boundary: () => documentBoundary });
};
