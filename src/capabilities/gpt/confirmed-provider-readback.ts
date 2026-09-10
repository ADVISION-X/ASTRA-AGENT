import { createHash } from "node:crypto";

import type { BrowserConfirmedProviderReadbackAuthorization } from
  "../../lib/browser/browser-authority-api.js";
import { executionFailure } from "../../lib/execution-failure.js";
import { gptSubmissionLocatorArtifact } from "./artifact-contract.js";
import type {
  GptChildCapabilityId,
  GptChildCapabilityIntent,
} from "./contract.js";
import type {
  ProductGptCallInput,
  ProductGptChildResult,
} from "./product-api.js";
import type { GptExactCallFactsWithBrowserBinding } from "./production-call-facts.js";
import type { ProductionGptBrowserLifecycle } from "./production-browser-lifecycle.js";
import { confirmedSubmitReadbackDocumentHash } from "./evidence-fact.js";
import {
  carryProductSafeConfirmedProviderSubmitReceipt,
} from "./execution-fault.js";

export {
  confirmedProviderSubmitReceiptFromError,
  type ProductSafeConfirmedProviderSubmitReceipt,
} from "./execution-fault.js";

export type ConfirmedProviderSubmitReceipt = Readonly<{
  sourceAttemptId: string;
  sourceExactCallIdentityHash: `sha256:${string}`;
  sourceActionOrdinal: number;
  sourceProductStepId: string;
  sourceCallId: string;
  sourceTargetRef: string;
  sourceDocumentRef: string;
  readbackDocumentRefHash: `sha256:${string}`;
  sourceTerminalAt: string;
  evidenceRef: string;
  evidenceHash: `sha256:${string}`;
  promptHash: `sha256:${string}`;
  turnMarker: string;
}>;

export const carryConfirmedProviderSubmitReceipt = (
  error: unknown,
  receipt: ConfirmedProviderSubmitReceipt,
): unknown => carryProductSafeConfirmedProviderSubmitReceipt(error, {
  exactCallIdentityHash: receipt.sourceExactCallIdentityHash,
  terminalAt: receipt.sourceTerminalAt,
  evidenceRef: receipt.evidenceRef,
  evidenceHash: receipt.evidenceHash,
});

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const CONFIRMED_PROVIDER_READBACK_EVIDENCE_CHILDREN = new Set<GptChildCapabilityId>([
  "reconcile_gpt_turn_submission",
  "wait_for_stable_gpt_text",
  "wait_for_stable_gpt_image",
  "checkpoint_gpt_text_response",
  "checkpoint_gpt_generated_image",
]);

const hashValue = (value: unknown): value is `sha256:${string}` =>
  typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value);

const nonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const receiptShapeValid = (receipt: ConfirmedProviderSubmitReceipt): boolean =>
  nonEmptyString(receipt.sourceAttemptId)
  && nonEmptyString(receipt.sourceProductStepId)
  && nonEmptyString(receipt.sourceCallId)
  && nonEmptyString(receipt.sourceTargetRef)
  && nonEmptyString(receipt.sourceDocumentRef)
  && nonEmptyString(receipt.sourceTerminalAt)
  && !Number.isNaN(Date.parse(receipt.sourceTerminalAt))
  && new Date(receipt.sourceTerminalAt).toISOString() === receipt.sourceTerminalAt
  && nonEmptyString(receipt.evidenceRef)
  && nonEmptyString(receipt.turnMarker)
  && Number.isSafeInteger(receipt.sourceActionOrdinal)
  && receipt.sourceActionOrdinal >= 0
  && hashValue(receipt.sourceExactCallIdentityHash)
  && hashValue(receipt.readbackDocumentRefHash)
  && hashValue(receipt.evidenceHash)
  && hashValue(receipt.promptHash);

export const confirmedProviderReadbackEvidencePending = (
  receipt: ConfirmedProviderSubmitReceipt | null | undefined,
  intent: GptChildCapabilityIntent,
): boolean => Boolean(receipt && receiptShapeValid(receipt)
  && CONFIRMED_PROVIDER_READBACK_EVIDENCE_CHILDREN.has(intent.childCapabilityId)
  && receipt.sourceAttemptId === intent.attemptId
  && receipt.sourceProductStepId === intent.productStepId
  && receipt.sourceActionOrdinal < intent.actionOrdinal
  && Reflect.get(intent.input, "expectedPromptHash") === receipt.promptHash
  && Reflect.get(intent.input, "turnMarker") === receipt.turnMarker);

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
    || mutation.mutationOutcome !== "confirmed"
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
  const readbackDocumentRefHash = confirmedSubmitReadbackDocumentHash(evidence);
  if (!/^sha256:[a-f0-9]{64}$/u.test(promptHash) || !turnMarker) {
    throw executionFailure("failed", "BROWSER_RECONCILIATION_SCOPE_INVALID");
  }
  if (!readbackDocumentRefHash) {
    throw carryProductSafeConfirmedProviderSubmitReceipt(
      executionFailure("failed", "FORENSICS_EXACT_CALL_EVIDENCE_INVALID"),
      {
        exactCallIdentityHash: facts.exactCallIdentityHash,
        terminalAt: mutation.terminalAt,
        evidenceRef: evidence.evidenceRef,
        evidenceHash: evidence.evidenceHash,
      },
    );
  }
  return Object.freeze({
    sourceAttemptId: mutation.sourceAttemptId,
    sourceExactCallIdentityHash: facts.exactCallIdentityHash,
    sourceActionOrdinal: mutation.actionOrdinal,
    sourceProductStepId: mutation.productStepId,
    sourceCallId: mutation.callId,
    sourceTargetRef: mutation.targetRef,
    sourceDocumentRef: mutation.documentRef,
    readbackDocumentRefHash,
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

export const authorizeConfirmedProviderSourceReadback = async (input: Readonly<{
  browsers: ProductionGptBrowserLifecycle;
  receipt: ConfirmedProviderSubmitReceipt;
}>): Promise<void> => input.browsers.authorizeConfirmedProviderSourceReadback(Object.freeze({
  schemaVersion: "browser-confirmed-provider-source-readback.v1",
  ...input.receipt,
  sourceChildCapabilityId: "submit_exact_gpt_turn_once",
}));

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
