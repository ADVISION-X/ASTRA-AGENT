import {
  gptContinuationIdentityHash,
  type GptProviderContinuation,
} from "../../capabilities/gpt/index.js";
import {
  hashCanonical,
  sha256,
  type ProductionHash,
  type WebsiteAgentTask,
} from "../../lib/local-runtime/production/contracts.js";
import {
  productResultValidation,
  type ExactGptContinuationReadback,
} from "../../lib/local-runtime/production/plugin.js";
import { evaluateExactNestedResultContract } from "../../lib/local-runtime/production/route-policy.js";
import {
  localBaziPrivateBaseTurn,
  localBaziPrivateBaseTurnHash,
} from "./private-base-turn-contract.js";
import {
  checkpointRecord,
  fail,
  hashValue,
  integerValue,
  objectValue,
  textValue,
} from "./product-turn.js";

export const basePrompt = (marker: string): string => [
  localBaziPrivateBaseTurn.prompt,
  "本轮唯一附件角色：bazi_private_base_input。",
  `把此不可变标记原样保留在本次用户消息中，不要写入 JSON 结果：${marker}`,
].join("\n");

export const validateBaseOutput = (
  checkpoint: Readonly<{ semanticText: string; semanticTextHash: ProductionHash; artifactRef: string }>,
  baseInput: Record<string, unknown>,
): Readonly<{
  value: Record<string, unknown>;
  receipt: Readonly<{
    schema_version: "exact-semantic-admission-receipt.v1";
    artifact_ref: string;
    artifact_hash: ProductionHash;
    contract_hash: ProductionHash;
    contract_evaluation_hash: ProductionHash;
    outcome: "accepted";
  }>;
  receiptRef: string;
  receiptHash: ProductionHash;
}> => {
  const contract = objectValue(baseInput.base_output_contract, "BAZI_PRIVATE_BASE_CONTRACT_INVALID");
  const expectedFields = contract.exact_top_level_fields;
  if (!Array.isArray(expectedFields) || !expectedFields.every((field) => typeof field === "string")) {
    fail("BAZI_PRIVATE_BASE_CONTRACT_INVALID");
  }
  const value = productResultValidation.parseJsonObject(
    checkpoint.semanticText, "BAZI_PRIVATE_BASE_OUTPUT_INVALID",
  ) as Record<string, unknown>;
  const contractEvaluation = evaluateExactNestedResultContract({
    artifactHash: checkpoint.semanticTextHash,
    value,
    contract,
    topLevelFieldsKey: "exact_top_level_fields",
    nestedArrayFields: {
      citations: "exact_citation_fields",
      uncertainties: "exact_uncertainty_fields",
      index_review_receipts: "exact_index_review_fields",
    },
  });
  if (value.schema_version !== localBaziPrivateBaseTurn.outputSchemaVersion
    || typeof value.interpretation_markdown !== "string" || !value.interpretation_markdown.trim()) {
    fail("BAZI_PRIVATE_BASE_OUTPUT_INVALID");
  }
  const citationFields = contract.exact_citation_fields as unknown;
  const uncertaintyFields = contract.exact_uncertainty_fields as unknown;
  const reviewFields = contract.exact_index_review_fields as unknown;
  if (!Array.isArray(citationFields) || !Array.isArray(uncertaintyFields) || !Array.isArray(reviewFields)
    || !Array.isArray(value.citations) || !Array.isArray(value.uncertainties)
    || !Array.isArray(value.index_review_receipts)) fail("BAZI_PRIVATE_BASE_OUTPUT_INVALID");
  for (const citation of value.citations) {
    const row = objectValue(citation, "BAZI_PRIVATE_BASE_CITATION_INVALID");
    textValue(row.book_id, "BAZI_PRIVATE_BASE_CITATION_INVALID");
    textValue(row.locator, "BAZI_PRIVATE_BASE_CITATION_INVALID");
  }
  for (const uncertainty of value.uncertainties) {
    const row = objectValue(uncertainty, "BAZI_PRIVATE_BASE_UNCERTAINTY_INVALID");
    for (const field of uncertaintyFields as string[]) textValue(row[field], "BAZI_PRIVATE_BASE_UNCERTAINTY_INVALID");
  }
  const readyBooks = baseInput.ready_book_manifest;
  if (!Array.isArray(readyBooks) || value.index_review_receipts.length !== readyBooks.length) {
    fail("BAZI_PRIVATE_BASE_INDEX_REVIEW_INVALID");
  }
  const expectedById = new Map(readyBooks.map((entry) => {
    const row = objectValue(entry, "BAZI_PRIVATE_BASE_READY_BOOK_INVALID");
    return [textValue(row.book_id, "BAZI_PRIVATE_BASE_READY_BOOK_INVALID"), row] as const;
  }));
  const seen = new Set<string>();
  for (const review of value.index_review_receipts) {
    const row = objectValue(review, "BAZI_PRIVATE_BASE_INDEX_REVIEW_INVALID");
    const bookId = textValue(row.book_id, "BAZI_PRIVATE_BASE_INDEX_REVIEW_INVALID");
    const expected = expectedById.get(bookId);
    if (!expected || seen.has(bookId) || row.index_hash !== expected.index_hash
      || row.review_status !== "complete" || !Number.isSafeInteger(row.macro_entry_count)
      || !Number.isSafeInteger(row.navigation_node_count) || !Number.isSafeInteger(row.semantic_entry_count)
      || !textValue(row.applicability_note, "BAZI_PRIVATE_BASE_INDEX_REVIEW_INVALID")) {
      fail("BAZI_PRIVATE_BASE_INDEX_REVIEW_INVALID");
    }
    seen.add(bookId);
  }
  const receipt = Object.freeze({
    schema_version: "exact-semantic-admission-receipt.v1" as const,
    artifact_ref: checkpoint.artifactRef,
    artifact_hash: checkpoint.semanticTextHash,
    contract_hash: contractEvaluation.contract_hash,
    contract_evaluation_hash: contractEvaluation.evaluation_hash,
    outcome: "accepted" as const,
  });
  const receiptHash = hashCanonical(receipt);
  const receiptRef = `semantic-admission:${receiptHash.slice(7)}`;
  return Object.freeze({
    value: Object.freeze(value), receipt, receiptRef, receiptHash,
  });
};

export type BaseFacts = Readonly<{
  continuationRef: string;
  provider: GptProviderContinuation;
  checkpoint: Readonly<{
    sourceAttemptId: string;
    assistantTurnId: string;
    artifactRef: string;
    rawDomHtml: string;
    rawDomHash: ProductionHash;
    semanticText: string;
    semanticTextHash: ProductionHash;
    canonicalConversationUrl: string;
    promptHash: ProductionHash;
    turnMarker: string;
    evidenceRef: string;
    evidenceHash: ProductionHash;
  }>;
  semanticAdmissionReceiptRef: string;
  semanticAdmissionReceiptHash: ProductionHash;
  semanticAdmissionReceipt: ReturnType<typeof validateBaseOutput>["receipt"];
  semanticContractHash: ProductionHash;
  opaqueReadGrantHash: ProductionHash;
}>;

export const reusableIdentity = (task: WebsiteAgentTask, baseInput: Record<string, unknown>): ProductionHash => {
  const digest = hashValue(baseInput.reusable_base_semantic_digest, "BAZI_REUSABLE_BASE_DIGEST_INVALID");
  const {
    reusable_base_semantic_digest: _digest,
    ...providerVisible
  } = baseInput;
  if (hashCanonical(providerVisible) !== digest) fail("BAZI_REUSABLE_BASE_DIGEST_INVALID");
  if (digest !== task.parameters.reusable_base_semantic_digest
    || baseInput.owner_scope_hash !== task.parameters.owner_scope_hash
    || baseInput.privacy_subject_ref !== task.privacy_subject_ref
    || baseInput.stable_base_authorization_ref !== task.parameters.stable_base_authorization_ref) {
    fail("BAZI_REUSABLE_BASE_IDENTITY_INVALID");
  }
  const forbidden = new Set(["user_question", "question", "subject_events", "subject_evidence_snapshot",
    "order", "payment", "entitlement_ref", "product_id", "task_id"]);
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (forbidden.has(key)) fail("BAZI_PRIVATE_BASE_FORBIDDEN_FACT");
      visit(nested);
    }
  };
  visit(baseInput);
  const contract = objectValue(baseInput.base_output_contract, "BAZI_PRIVATE_BASE_CONTRACT_INVALID");
  return hashCanonical({
    kind: "bazi-reusable-private-base.v1",
    owner_scope_hash: task.parameters.owner_scope_hash,
    privacy_subject_ref: task.privacy_subject_ref,
    reusable_base_semantic_digest: digest,
    base_output_contract_version: contract.output_schema_version,
    base_profile_hash: localBaziPrivateBaseTurn.profile.profileHash,
    private_base_turn_contract_hash: localBaziPrivateBaseTurnHash,
  });
};

export const reservationValue = (value: unknown) => {
  const row = objectValue(value, "BAZI_CONTINUATION_RESERVATION_INVALID");
  return Object.freeze({
    continuationRef: textValue(row.continuationRef, "BAZI_CONTINUATION_RESERVATION_INVALID"),
    reservationIdentityHash: hashValue(row.reservationIdentityHash, "BAZI_CONTINUATION_RESERVATION_INVALID"),
    laneVersion: integerValue(row.laneVersion, "BAZI_CONTINUATION_RESERVATION_INVALID"),
    reservationFenceHash: hashValue(row.reservationFenceHash, "BAZI_CONTINUATION_RESERVATION_INVALID"),
    complete: row.complete === true,
    opaqueReadGrantHash: row.opaqueReadGrantHash === null
      ? null : hashValue(row.opaqueReadGrantHash, "BAZI_CONTINUATION_RESERVATION_INVALID"),
  });
};

export const completionHashes = (input: {
  identity: ProductionHash;
  continuationRef: string;
  laneVersion: number;
  fenceHash: ProductionHash;
  provider: GptProviderContinuation;
  checkpoint: BaseFacts["checkpoint"];
  semanticReceiptRef: string;
  semanticReceiptHash: ProductionHash;
  ownerRef: string;
  subjectRef: string;
}) => {
  const storedCheckpoint = checkpointRecord(input.checkpoint);
  const opaqueReadGrantHash = hashCanonical({
    kind: "current_artifact_read_grant.v1",
    owner_ref: input.ownerRef,
    subject_ref: input.subjectRef,
    source_artifact_ref: input.checkpoint.artifactRef,
    source_artifact_hash: input.checkpoint.semanticTextHash,
    source_checkpoint_hash: hashCanonical(storedCheckpoint),
    semantic_admission_receipt_ref: input.semanticReceiptRef,
    semantic_admission_receipt_hash: input.semanticReceiptHash,
  });
  const completionReceiptHash = hashCanonical({
    kind: "gpt-continuation-completion.v1",
    reservation_identity_hash: input.identity,
    continuation_ref: input.continuationRef,
    lane_version: input.laneVersion,
    reservation_fence_hash: input.fenceHash,
    conversation_identity_hash: gptContinuationIdentityHash(input.provider),
    checkpoint_hash: hashCanonical(storedCheckpoint),
    artifact_ref: input.checkpoint.artifactRef,
    artifact_hash: input.checkpoint.semanticTextHash,
    semantic_admission_receipt_ref: input.semanticReceiptRef,
    semantic_admission_receipt_hash: input.semanticReceiptHash,
    opaque_read_grant_hash: opaqueReadGrantHash,
  });
  return { storedCheckpoint, opaqueReadGrantHash, completionReceiptHash };
};

export const baseFactsFromReadback = (
  task: WebsiteAgentTask,
  identity: ProductionHash,
  baseInput: Record<string, unknown>,
  readback: ExactGptContinuationReadback,
  expectedGrant: ProductionHash | null,
): BaseFacts => {
  if (readback.lookupKind !== "frontier_ref" || readback.continuationRef !== `gpt-continuation:${identity.slice(7)}`
    || readback.originCheckpoint.checkpointKind !== "text") fail("BAZI_REUSABLE_BASE_READBACK_INVALID");
  const checkpoint = readback.originCheckpoint;
  const expectedPromptHash = sha256(basePrompt(`${localBaziPrivateBaseTurn.markerNamespace}:${identity.slice(7, 31)}`));
  if (checkpoint.promptHash !== expectedPromptHash
    || checkpoint.semanticTextHash !== readback.originProvider.prior_raw_output_hash
    || checkpoint.promptHash !== readback.originProvider.prior_prompt_hash) {
    fail("BAZI_REUSABLE_BASE_PROMPT_DRIFT");
  }
  const admission = validateBaseOutput(checkpoint, baseInput);
  const computed = completionHashes({
    identity,
    continuationRef: readback.continuationRef,
    laneVersion: 1,
    fenceHash: hashCanonical({ kind: "bazi-reusable-base-reservation-fence.v1", identity }),
    provider: readback.originProvider,
    checkpoint,
    semanticReceiptRef: admission.receiptRef,
    semanticReceiptHash: admission.receiptHash,
    ownerRef: task.business_identity.owner_ref,
    subjectRef: task.business_identity.subject_ref,
  });
  if (expectedGrant && computed.opaqueReadGrantHash !== expectedGrant) fail("BAZI_REUSABLE_BASE_GRANT_INVALID");
  return Object.freeze({
    continuationRef: readback.continuationRef,
    provider: readback.originProvider,
    checkpoint,
    semanticAdmissionReceiptRef: admission.receiptRef,
    semanticAdmissionReceiptHash: admission.receiptHash,
    semanticAdmissionReceipt: admission.receipt,
    semanticContractHash: admission.receipt.contract_hash,
    opaqueReadGrantHash: computed.opaqueReadGrantHash,
  });
};


