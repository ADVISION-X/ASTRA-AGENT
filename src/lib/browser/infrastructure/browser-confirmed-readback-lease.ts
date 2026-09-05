import type { BrowserTargetLease } from "../exact-target/browser-target-lease.js";
import type { BrowserExecutionBinding } from "./browser-authority-broker.js";

type ReconciliationBinding = Extract<BrowserExecutionBinding, { kind: "production-reconciliation" }>;

const CONFIRMED_READBACK_TARGET_LOCAL_CHILDREN = new Set([
  "focus_exact_gpt_conversation",
  "wait_for_stable_gpt_text",
  "wait_for_stable_gpt_image",
]);

const readOnlyLease = (lease: BrowserTargetLease): BrowserTargetLease => {
  const reject = async (): Promise<never> => {
    throw new Error("BROWSER_RECONCILIATION_SCOPE_INVALID");
  };
  const readKinds = new Set([
    "document", "observe", "readExactAssistantTurn", "inspect", "find", "readText", "readAttribute",
  ]);
  return {
    ...lease,
    runAtomicStep: (identity, action) => identity.replayPolicy === "observation-only"
      ? lease.runAtomicStep(identity, action) : reject(),
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
  if (binding.kind === "production-confirmed-failure-readback") return readOnlyLease(lease);
  return binding.kind === "production-reconciliation" ? confirmedReadbackLease(lease, binding) : lease;
};
