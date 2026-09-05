import { createHash } from "node:crypto";

import type { BrowserConfirmedProviderReadbackAuthorization } from
  "../../lib/browser/browser-authority-api.js";
import { executionFailure } from "../../lib/execution-failure.js";
import { gptSubmissionLocatorArtifact } from "./artifact-contract.js";
import { gptExactCallIdentityHash, type GptChildCapabilityIntent } from "./contract.js";
import { readConfirmedSubmitFailureEvidence } from "./evidence-fact.js";
import type {
  ConfirmedGptSubmitFailureReceipt,
  ProductGptCallInput,
  ProductGptChildResult,
} from "./product-api.js";
import type { GptExactCallFactsWithBrowserBinding } from "./production-call-facts.js";
import type { ProductionGptBrowserLifecycle } from "./production-browser-lifecycle.js";
import type {
  GptEvidenceStorePort,
  GptProductionBrowserAuthority,
} from "./production-ports.js";

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

export const readConfirmedProviderSubmitFailureReceipt = async (input: Readonly<{
  call: ProductGptCallInput<"submit_exact_gpt_turn_once">;
  intent: GptChildCapabilityIntent<"submit_exact_gpt_turn_once">;
  browserAuthority: GptProductionBrowserAuthority;
  evidenceStore: GptEvidenceStorePort;
}>): Promise<Readonly<{
  provider: ConfirmedProviderSubmitReceipt;
  product: ConfirmedGptSubmitFailureReceipt;
}> | null> => {
  const exactCallIdentityHash = gptExactCallIdentityHash(input.intent);
  const evidence = await readConfirmedSubmitFailureEvidence({
    evidenceStore: input.evidenceStore,
    intent: input.intent,
    exactCallIdentityHash,
  });
  if (!evidence) return null;
  const mutation = input.browserAuthority.readExactCallMutationFact({
    jobId: input.intent.jobId,
    attemptId: input.intent.attemptId,
    ownerPluginId: input.intent.pluginId,
    pluginVersion: input.intent.pluginVersion,
    exactCallIdentityHash,
    actionOrdinal: input.intent.actionOrdinal,
  });
  if (!mutation
    || mutation.effectScope !== "provider_effect"
    || mutation.outcome !== "CONFIRMED"
    || mutation.mutationOutcome !== "confirmed"
    || !mutation.terminalAt
    || mutation.productStepId !== input.call.productStepId
    || mutation.callId !== input.call.callId
    || mutation.childCapabilityId !== input.call.child
    || mutation.actionOrdinal !== input.call.actionOrdinal
    || evidence.browserFact.exactCallIdentityHash !== exactCallIdentityHash
    || evidence.browserFact.terminalAt !== mutation.terminalAt
    || evidence.browserFact.evidenceRef !== mutation.authorityRef
    || evidence.browserFact.evidenceHash !== mutation.authorityHash) {
    throw executionFailure("failed", "BROWSER_RECONCILIATION_SCOPE_INVALID");
  }
  const provider = confirmedProviderSubmitReceipt(input.call, Object.freeze({
    exactCallIdentityHash,
    mutation: Object.freeze({
      owner: "browser",
      sourceAttemptId: input.intent.attemptId,
      effectScope: mutation.effectScope,
      outcome: mutation.outcome,
      mutationOutcome: mutation.mutationOutcome,
      failureCode: mutation.failureCode,
      nativeFailureCode: mutation.nativeFailureCode,
      terminalAt: mutation.terminalAt,
      authorityRef: mutation.authorityRef,
      authorityHash: mutation.authorityHash,
      targetRef: mutation.targetRef,
      documentRef: mutation.documentRef,
      productStepId: mutation.productStepId,
      callId: mutation.callId,
      childCapabilityId: mutation.childCapabilityId,
      actionOrdinal: mutation.actionOrdinal,
    }),
    evidence: evidence.evidence,
    continuation: null,
  }));
  if (!provider) throw executionFailure("failed", "BROWSER_RECONCILIATION_SCOPE_INVALID");
  return Object.freeze({
    provider,
    product: Object.freeze({
      sourceAttemptId: provider.sourceAttemptId,
      exactCallIdentityHash: provider.sourceExactCallIdentityHash,
      productStepId: provider.sourceProductStepId,
      callId: provider.sourceCallId,
      actionOrdinal: provider.sourceActionOrdinal,
      terminalAt: provider.sourceTerminalAt,
      failureCode: evidence.failureCode,
      evidenceRef: provider.evidenceRef,
      evidenceHash: provider.evidenceHash,
    }),
  });
};

export const authorizeConfirmedProviderFailureReadback = (input: Readonly<{
  browsers: ProductionGptBrowserLifecycle;
  receipt: ConfirmedProviderSubmitReceipt;
}>): void => input.browsers.authorizeConfirmedProviderFailureReadback(Object.freeze({
  schemaVersion: "browser-confirmed-provider-failure-readback.v1",
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
