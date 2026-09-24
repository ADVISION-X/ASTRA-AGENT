import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { createHash } from "node:crypto";
import type { ExtensionTargetAuthority } from "../../src/lib/browser/chrome-extension/extension-target-authority.js";

type ExecuteCommand = (
  command: Parameters<ExtensionTargetAuthority["executeRegisteredCommand"]>[0],
  target: Parameters<ExtensionTargetAuthority["executeRegisteredCommand"]>[1],
  mutationClass: Parameters<ExtensionTargetAuthority["executeRegisteredCommand"]>[2],
) => Promise<unknown>;

/** Checks dialog admission before any Provider input on the exact claimed target. */
export const verifyRateLimitCommandAdmission = async (input: Readonly<{
  executeRegisteredCommand: ExecuteCommand;
  simpleClick: Parameters<ExecuteCommand>[0];
  interactionTarget: Parameters<ExecuteCommand>[1];
  firstTargetRef: string;
  firstDocumentRef: string;
  providerInputMethods: readonly string[];
  rateLimitDetectorStartedAt: readonly number[];
  setRateLimitDetectorState: (state: Readonly<Record<string, unknown>>) => void;
}>): Promise<void> => {
  const { executeRegisteredCommand, simpleClick, interactionTarget, firstTargetRef,
    firstDocumentRef, providerInputMethods, rateLimitDetectorStartedAt,
    setRateLimitDetectorState } = input;
setRateLimitDetectorState({ state: "mismatch" });
const providerInputsBeforeUnknownDialog = providerInputMethods.length;
const unrecognizedDialog = await executeRegisteredCommand(
  simpleClick, interactionTarget, "mutation",
) as Readonly<Record<string, unknown>>;
assert.equal(unrecognizedDialog.failureCode, "BROWSER_GPT_DIALOG_UNRECOGNIZED");
assert.equal(unrecognizedDialog.physicalInputCount, 0);
assert.equal(providerInputMethods.length, providerInputsBeforeUnknownDialog,
  "an unknown or structurally mismatched dialog must fail closed with zero physical input");
const targetRefHash = `sha256:${createHash("sha256").update(firstTargetRef).digest("hex")}` as const;
const documentRefHash = `sha256:${createHash("sha256").update(firstDocumentRef).digest("hex")}` as const;
const mismatchedAcknowledgement = await executeRegisteredCommand({
  kind: "dom-intent",
  intent: {
    kind: "acknowledgeKnownGptRateLimit",
    targetRefHash,
    documentRefHash,
    dispatchNotAfter: null,
  },
}, interactionTarget, "mutation") as Readonly<Record<string, unknown>>;
assert.equal(mismatchedAcknowledgement.failureCode, "BROWSER_GPT_DIALOG_UNRECOGNIZED");
assert.equal(mismatchedAcknowledgement.physicalInputCount, 0,
  "acknowledgement mismatch must return the typed rejection without physical input");
const mismatchedClearance = await executeRegisteredCommand({
  kind: "dom-intent",
  intent: { kind: "readKnownGptRateLimitClearance", targetRefHash, documentRefHash },
}, interactionTarget, "observation") as Readonly<Record<string, unknown>>;
assert.equal(mismatchedClearance.failureCode, "BROWSER_GPT_DIALOG_UNRECOGNIZED");
assert.equal(mismatchedClearance.physicalInputCount, 0,
  "clearance mismatch must return the same typed rejection without physical input");
for (const receipt of [mismatchedAcknowledgement, mismatchedClearance]) {
  const fact = receipt.knownGptRateLimitPreflightFact as Readonly<Record<string, unknown>>;
  assert.equal(fact.state, "mismatch");
  assert.equal(Object.keys(fact).length, 17,
    "each control-intent mismatch must retain the complete mechanical fact");
  assert.equal(fact.dialogEligibleCount, 1);
  assert.equal(fact.dialogActionableCount, 0);
}
assert.equal(providerInputMethods.length, providerInputsBeforeUnknownDialog,
  "neither control-intent mismatch may reach physical input");
setRateLimitDetectorState({ state: "exact_present", observedAt: new Date().toISOString() });
const providerInputsBeforeKnownDialog = providerInputMethods.length;
const knownDialogBlocked = await executeRegisteredCommand(
  simpleClick, interactionTarget, "mutation",
) as Readonly<Record<string, unknown>>;
assert.equal(knownDialogBlocked.failureCode, "BROWSER_KNOWN_GPT_RATE_LIMIT");
assert.equal(knownDialogBlocked.physicalInputCount, 0);
assert.equal(providerInputMethods.length, providerInputsBeforeKnownDialog,
  "the exact known dialog must block the original action with zero physical input");
setRateLimitDetectorState({ state: "absent" });
const firstInteractiveReceipt = await executeRegisteredCommand(
  simpleClick, interactionTarget, "mutation",
) as Readonly<Record<string, unknown>>;
assert.equal(firstInteractiveReceipt.postconditionVerified, true);
assert.equal(rateLimitDetectorStartedAt.slice(-3).length, 3);
};
