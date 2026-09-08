import {
  GPT_CHILD_CAPABILITY_CONTRACTS,
  type GptChildCapabilityId,
  type GptExecutionContext,
} from "./contract.js";

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
