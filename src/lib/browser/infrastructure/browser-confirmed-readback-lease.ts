import type { BrowserTargetLease } from "../exact-target/browser-target-lease.js";
import type { BrowserExecutionBinding } from "./browser-authority-broker.js";
import { confirmedSourceReadbackDocumentMatches } from "./browser-confirmed-readback-source.js";

type ReconciliationBinding = Extract<BrowserExecutionBinding, { kind: "production-reconciliation" }>;
type SourceBinding = Extract<BrowserExecutionBinding, { kind: "production-confirmed-source-readback" }>;

const CONFIRMED_READBACK_TARGET_LOCAL_CHILDREN = new Set([
  "focus_exact_gpt_conversation",
  "wait_for_stable_gpt_text",
  "wait_for_stable_gpt_image",
]);

const readOnlyLease = (lease: BrowserTargetLease, binding: SourceBinding): BrowserTargetLease => {
  const reject = async (): Promise<never> => {
    throw new Error("BROWSER_RECONCILIATION_SCOPE_INVALID");
  };
  const readKinds = new Set([
    "document", "observe", "readExactAssistantTurn", "inspect", "find", "readText", "readAttribute",
  ]);
  return {
    ...lease,
    runAtomicStep: (identity, action) => {
      const recovery = lease.readAtomicStepRecovery(identity);
      const exactConfirmedSubmit = identity.replayPolicy === "provider-effect-once"
        && identity.childCapabilityId === "submit_exact_gpt_turn_once"
        && identity.productStepId === binding.confirmedProviderSourceReadback.sourceProductStepId
        && identity.callId === binding.confirmedProviderSourceReadback.sourceCallId
        && identity.actionOrdinal === binding.confirmedProviderSourceReadback.sourceActionOrdinal
        && recovery?.state === "confirmed" && recovery.mutationOutcome === "confirmed"
        && recovery.targetRef === binding.confirmedProviderSourceReadback.sourceTargetRef
        && recovery.documentRef === binding.confirmedProviderSourceReadback.sourceDocumentRef
        && confirmedSourceReadbackDocumentMatches(
          binding.confirmedProviderSourceReadback,
          lease,
        );
      return identity.replayPolicy === "observation-only" || exactConfirmedSubmit
        ? lease.runAtomicStep(identity, action) : reject();
    },
    navigate: reject,
    executeDomIntent: (intent) => readKinds.has(intent.kind)
      ? lease.executeDomIntent(intent) : reject(),
    observeCapability: (input) => lease.observeCapability(input),
    captureScreenshot: reject,
    attachFile: reject,
    downloadAuthenticatedMedia: reject,
    wait: (input) => lease.wait(input),
    park: (input) => lease.park(input),
    close: (input) => lease.close(input),
    resolvePendingMutation: reject,
  };
};

const confirmedReadbackLease = (
  lease: BrowserTargetLease,
  binding: ReconciliationBinding,
): BrowserTargetLease => {
  const reject = async (): Promise<never> => {
    throw new Error("BROWSER_RECONCILIATION_SCOPE_INVALID");
  };
  const readKinds = new Set([
    "document", "observe", "readExactAssistantTurn", "inspect", "find", "readText", "readAttribute",
  ]);
  return {
    ...lease,
    runAtomicStep: (identity, action) => identity.replayPolicy === "observation-only"
      || (identity.replayPolicy === "target-local-per-generation"
        && CONFIRMED_READBACK_TARGET_LOCAL_CHILDREN.has(identity.childCapabilityId))
      ? lease.runAtomicStep(identity, action) : reject(),
    navigate: (input) => input.url === binding.confirmedProviderReadback.canonicalConversationUrl
      ? lease.navigate(input) : reject(),
    executeDomIntent: (intent) => readKinds.has(intent.kind)
      ? lease.executeDomIntent(intent) : reject(),
    observeCapability: (input) => lease.observeCapability(input),
    captureScreenshot: reject,
    attachFile: reject,
    downloadAuthenticatedMedia: (input) => lease.downloadAuthenticatedMedia(input),
    wait: (input) => lease.wait(input),
    park: (input) => lease.park(input),
    close: (input) => lease.close(input),
    resolvePendingMutation: reject,
  };
};

export const admittedReadbackLease = (
  binding: BrowserExecutionBinding,
  lease: BrowserTargetLease,
): BrowserTargetLease => {
  if (binding.kind === "production-confirmed-source-readback") return readOnlyLease(lease, binding);
  return binding.kind === "production-reconciliation" ? confirmedReadbackLease(lease, binding) : lease;
};
