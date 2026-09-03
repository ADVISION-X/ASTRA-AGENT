import { createHash } from "node:crypto";

import type { BrowserConfirmedProviderReadbackAuthorization } from
  "../../lib/browser/browser-authority-api.js";
import { executionFailure } from "../../lib/execution-failure.js";
import { gptSubmissionLocatorArtifact } from "./artifact-contract.js";
import type { ProductGptCallInput, ProductGptChildResult } from "./product-api.js";
import type { GptExactCallFactsWithBrowserBinding } from "./production-call-facts.js";
import type { ProductionGptBrowserLifecycle } from "./production-browser-lifecycle.js";

export type ConfirmedProviderSubmitReceipt = Readonly<{
  sourceAttemptId: string;
  sourceExactCallIdentityHash: `sha256:${string}`;
  sourceActionOrdinal: number;
  sourceProductStepId: string;
  sourceCallId: string;
  sourceTargetRef: string;
  sourceDocumentRef: string;
  sourceTerminalAt: string;
  evidenceRef: string;
  evidenceHash: `sha256:${string}`;
  promptHash: `sha256:${string}`;
  turnMarker: string;
}>;

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export const confirmedProviderSubmitReceipt = (
  call: ProductGptCallInput,
  facts: GptExactCallFactsWithBrowserBinding,
): ConfirmedProviderSubmitReceipt | null => {
  if (call.child !== "submit_exact_gpt_turn_once") return null;
  const submitCall = call as ProductGptCallInput<"submit_exact_gpt_turn_once">;
  const mutation = facts.mutation;
  const evidence = facts.evidence;
  if (mutation?.effectScope !== "provider_effect"
    || mutation.outcome !== "CONFIRMED"
    || !mutation.terminalAt
    || evidence?.readbackVerified !== true) return null;
  if (mutation.productStepId !== call.productStepId
    || mutation.callId !== call.callId
    || mutation.childCapabilityId !== call.child
    || mutation.actionOrdinal !== call.actionOrdinal) {
    throw executionFailure("failed", "BROWSER_RECONCILIATION_SCOPE_INVALID");
  }
  const promptHash = submitCall.input.promptHash;
  const turnMarker = submitCall.input.turnMarker;
  if (!/^sha256:[a-f0-9]{64}$/u.test(promptHash) || !turnMarker) {
    throw executionFailure("failed", "BROWSER_RECONCILIATION_SCOPE_INVALID");
  }
  return Object.freeze({
    sourceAttemptId: mutation.sourceAttemptId,
    sourceExactCallIdentityHash: facts.exactCallIdentityHash,
    sourceActionOrdinal: mutation.actionOrdinal,
    sourceProductStepId: mutation.productStepId,
    sourceCallId: mutation.callId,
    sourceTargetRef: mutation.targetRef,
    sourceDocumentRef: mutation.documentRef,
    sourceTerminalAt: mutation.terminalAt,
    evidenceRef: evidence.evidenceRef,
    evidenceHash: evidence.evidenceHash,
    promptHash,
    turnMarker,
  });
};

export const mergeConfirmedProviderSubmitReceipt = (
  current: ConfirmedProviderSubmitReceipt | null,
  next: ConfirmedProviderSubmitReceipt | null,
): ConfirmedProviderSubmitReceipt | null => {
  if (!next) return current;
  if (current && current.sourceProductStepId === next.sourceProductStepId
    && hash(JSON.stringify(current)) !== hash(JSON.stringify(next))) {
    throw executionFailure("failed", "BROWSER_RECONCILIATION_SCOPE_INVALID");
  }
  return next;
};

export const authorizeConfirmedProviderReadback = (input: Readonly<{
  browsers: ProductionGptBrowserLifecycle;
  call: ProductGptCallInput;
  result: ProductGptChildResult;
  receipt: ConfirmedProviderSubmitReceipt | null;
}>): void => {
  if (!input.receipt || input.call.child !== "reconcile_gpt_turn_submission"
    || input.call.productStepId !== input.receipt.sourceProductStepId) return;
  const locatorValue = input.result.value && typeof input.result.value === "object"
    && !Array.isArray(input.result.value)
    ? { ...input.result.value, schemaVersion: "agent-gpt-submission-locator.v1" }
    : input.result.value;
  const locator = gptSubmissionLocatorArtifact(locatorValue, hash);
  if (!locator
    || locator.promptHash !== input.receipt.promptHash
    || locator.turnMarker !== input.receipt.turnMarker) {
    throw executionFailure("failed", "BROWSER_RECONCILIATION_SCOPE_INVALID");
  }
  const authorization: BrowserConfirmedProviderReadbackAuthorization = Object.freeze({
    schemaVersion: "browser-confirmed-provider-readback.v1",
    ...input.receipt,
    sourceChildCapabilityId: "submit_exact_gpt_turn_once",
    canonicalConversationUrl: locator.canonicalConversationUrl,
    conversationIdentityHash: locator.conversationIdentityHash,
  });
  input.browsers.authorizeConfirmedProviderReadback(authorization);
};
