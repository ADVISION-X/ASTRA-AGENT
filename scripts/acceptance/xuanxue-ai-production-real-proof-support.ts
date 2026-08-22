import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildStartupSourceFingerprint } from "../startup/lib/source-fingerprint.mjs";
import {
  XuanxueDynamicProofBindingContract,
} from "../../src/capabilities/ai-input-gateway/index.js";
import {
  createAgentRuntimeReceiptV5,
  type AgentRuntimeReceiptV5,
} from "../../src/plugins/xuanxue-ai-production/index.js";

export type XuanxueRealChromeEvidenceV5 = Readonly<{
  schemaVersion: "xuanxue-ai-production-real-chrome-evidence.v5";
  contractManifestHash: `sha256:${string}`;
  extensionId: string;
  releaseMode: "unpacked-manual-reload";
  workbenchUrl: string;
  realRunRoot: string;
  dynamicProofRunId: string;
  runtimeReceipt: AgentRuntimeReceiptV5;
  evidenceRefs: readonly string[];
}>;

const projectRoot = (): string => {
  const filePath = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(filePath), "../..");
};

export const currentXuanxueSourceCandidate = (): `sha256:${string}` =>
  buildStartupSourceFingerprint(projectRoot());

export const canonicalXuanxueRealRunRoot = (): string =>
  path.join(projectRoot(), ".grasseye-local");

export const realChromeEvidenceArgument = (): string => {
  const argument = process.argv.indexOf("--evidence");
  assert.ok(argument !== -1 && process.argv[argument + 1], "--evidence is required");
  return path.resolve(process.argv[argument + 1]!);
};

export const readXuanxueRealChromeEvidence = (
  evidencePath: string,
): XuanxueRealChromeEvidenceV5 => JSON.parse(
  readFileSync(evidencePath, "utf8"),
) as XuanxueRealChromeEvidenceV5;

export const validateBoundRuntimeReceipt = (input: {
  readonly evidence: XuanxueRealChromeEvidenceV5;
  readonly binding: ReturnType<typeof XuanxueDynamicProofBindingContract.validate>;
  readonly runRoot: string;
}): AgentRuntimeReceiptV5 => {
  const receipt = input.evidence.runtimeReceipt;
  assert.equal(path.resolve(input.evidence.realRunRoot), path.resolve(input.runRoot));
  assert.equal(input.evidence.dynamicProofRunId, input.binding.run_id);
  assert.equal(receipt.schema_version, "xuanxue-agent-runtime-receipt-v5");
  assert.equal(receipt.status, "complete");
  assert.equal(receipt.browser_required, true);
  assert.ok(receipt.browser_proof);
  assert.equal(receipt.candidate_hash, input.binding.candidate_hash);
  assert.equal(receipt.run_id, input.binding.run_id);
  assert.equal(receipt.browser_proof.unresolved_outcome_unknown_count, 0);
  assert.equal(receipt.browser_proof.no_action_during_authority_absence, true);
  assert.ok(receipt.browser_proof.windows.length > 0);
  const revalidated = createAgentRuntimeReceiptV5({
    requestId: receipt.request_id,
    status: receipt.status,
    executionId: receipt.execution_id,
    runId: receipt.run_id,
    conversationId: receipt.conversation_id,
    candidateHash: receipt.candidate_hash,
    browserRequired: receipt.browser_required,
    browserAuthorityProof: receipt.browser_proof,
    evidenceRefs: receipt.evidence_refs,
  });
  assert.deepEqual(revalidated, receipt);
  assert.equal(
    XuanxueDynamicProofBindingContract.hashReceipt(receipt),
    input.binding.runtime_receipt_hash,
    "dynamic proof must bind the immutable runtime receipt",
  );
  assert.deepEqual(input.evidence.evidenceRefs, receipt.evidence_refs);
  return receipt;
};
