import type { GptChildCapabilityId } from "./contract.js";
import type { BrowserConfirmedProviderReadbackAuthorization, BrowserConfirmedProviderSourceReadbackAuthorization } from
  "../../lib/browser/browser-authority-api.js";
import type { BrowserTargetLease } from "../../lib/browser/exact-target/browser-target-lease.js";
import { executionFailure } from "../../lib/execution-failure.js";

const CONFIRMED_READBACK_TARGET_LOCAL_CHILDREN = new Set<GptChildCapabilityId>([
  "focus_exact_gpt_conversation",
  "wait_for_stable_gpt_text",
  "wait_for_stable_gpt_image",
]);

const rejectedReadbackMutation = async (): Promise<never> => {
  throw executionFailure("failed", "BROWSER_RECONCILIATION_SCOPE_INVALID");
};

const readKinds = new Set([
  "document", "observe", "readExactAssistantTurn", "inspect", "find", "readText", "readAttribute",
]);

const confirmedSourceReadbackLease = (
  lease: BrowserTargetLease,
  authorization: BrowserConfirmedProviderSourceReadbackAuthorization,
): BrowserTargetLease => ({
  ...lease,
  runAtomicStep: (identity, action) => {
    const recovery = lease.readAtomicStepRecovery(identity);
    const exactConfirmedSubmit = identity.replayPolicy === "provider-effect-once"
      && identity.childCapabilityId === "submit_exact_gpt_turn_once"
      && identity.productStepId === authorization.sourceProductStepId
      && identity.callId === authorization.sourceCallId
      && identity.actionOrdinal === authorization.sourceActionOrdinal
      && recovery?.state === "confirmed" && recovery.mutationOutcome === "confirmed"
      && recovery.targetRef === authorization.sourceTargetRef
      && recovery.documentRef === authorization.sourceDocumentRef;
    return identity.replayPolicy === "observation-only" || exactConfirmedSubmit
      ? lease.runAtomicStep(identity, action) : rejectedReadbackMutation();
  },
  navigate: rejectedReadbackMutation,
  executeDomIntent: (intent) => readKinds.has(intent.kind)
    ? lease.executeDomIntent(intent) : rejectedReadbackMutation(),
  observeCapability: (input) => lease.observeCapability(input),
  captureScreenshot: rejectedReadbackMutation,
  attachFile: rejectedReadbackMutation,
  downloadAuthenticatedMedia: rejectedReadbackMutation,
  wait: (input) => lease.wait(input),
  park: (input) => lease.park(input),
  close: (input) => lease.close(input),
  resolvePendingMutation: rejectedReadbackMutation,
});

const confirmedReadbackLease = (
  lease: BrowserTargetLease,
  authorization: BrowserConfirmedProviderReadbackAuthorization,
): BrowserTargetLease => ({
  ...lease,
  runAtomicStep: (identity, action) => identity.replayPolicy === "observation-only"
    || (identity.replayPolicy === "target-local-per-generation"
      && CONFIRMED_READBACK_TARGET_LOCAL_CHILDREN.has(identity.childCapabilityId as GptChildCapabilityId))
    ? lease.runAtomicStep(identity, action) : rejectedReadbackMutation(),
  navigate: (input) => input.url === authorization.canonicalConversationUrl
    ? lease.navigate(input) : rejectedReadbackMutation(),
  executeDomIntent: (intent) => readKinds.has(intent.kind)
    ? lease.executeDomIntent(intent) : rejectedReadbackMutation(),
  observeCapability: (input) => lease.observeCapability(input),
  captureScreenshot: rejectedReadbackMutation,
  attachFile: rejectedReadbackMutation,
  downloadAuthenticatedMedia: (input) => lease.downloadAuthenticatedMedia(input),
  wait: (input) => lease.wait(input),
  park: (input) => lease.park(input),
  close: (input) => lease.close(input),
  resolvePendingMutation: rejectedReadbackMutation,
});

const dynamicFacade = (
  current: () => BrowserTargetLease,
): BrowserTargetLease => new Proxy(current(), {
  get: (_target, property) => {
    const governed = current();
    const value = Reflect.get(governed, property, governed) as unknown;
    return typeof value === "function" ? value.bind(governed) : value;
  },
});

export const dynamicConfirmedSourceReadbackFacade = (
  browser: () => BrowserTargetLease,
  authorization: BrowserConfirmedProviderSourceReadbackAuthorization,
): BrowserTargetLease => dynamicFacade(() => confirmedSourceReadbackLease(browser(), authorization));

export const dynamicConfirmedReadbackFacade = (
  browser: () => BrowserTargetLease,
  authorization: BrowserConfirmedProviderReadbackAuthorization,
): BrowserTargetLease => dynamicFacade(() => confirmedReadbackLease(browser(), authorization));
