import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildStartupSourceFingerprint } from "../startup/lib/source-fingerprint.mjs";
import { XuanxueDynamicProofBindingContract } from "../../src/capabilities/ai-input-gateway/index.js";
import { createAgentRuntimeReceiptV6, type AgentRuntimeReceiptV6 } from "../../src/plugins/xuanxue-ai-production/index.js";

export type XuanxueRealChromeEvidenceV6 = Readonly<{
  schemaVersion: "xuanxue-ai-production-real-chrome-evidence.v6";
  contractManifestHash: `sha256:${string}`;
  extensionId: string;
  releaseMode: "unpacked-manual-reload";
  workbenchUrl: string;
  realRunRoot: string;
  dynamicProofRunId: string;
  runtimeReceipt: AgentRuntimeReceiptV6;
  evidenceRefs: readonly string[];
}>;

const projectRoot = (): string => path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const currentXuanxueSourceCandidate = (): `sha256:${string}` => buildStartupSourceFingerprint(projectRoot());
export const canonicalXuanxueRealRunRoot = (): string => path.join(projectRoot(), ".grasseye-local");
export const realChromeEvidenceArgument = (): string => {
  const argument = process.argv.indexOf("--evidence");
  assert.ok(argument !== -1 && process.argv[argument + 1], "--evidence is required");
  return path.resolve(process.argv[argument + 1]!);
};
export const readXuanxueRealChromeEvidence = (evidencePath: string): XuanxueRealChromeEvidenceV6 =>
  JSON.parse(readFileSync(evidencePath, "utf8")) as XuanxueRealChromeEvidenceV6;

export const validateBoundRuntimeReceipt = (input: {
  readonly evidence: XuanxueRealChromeEvidenceV6;
  readonly binding: ReturnType<typeof XuanxueDynamicProofBindingContract.validate>;
  readonly runRoot: string;
}): AgentRuntimeReceiptV6 => {
  const receipt = input.evidence.runtimeReceipt;
  assert.equal(path.resolve(input.evidence.realRunRoot), path.resolve(input.runRoot));
  assert.equal(input.evidence.dynamicProofRunId, input.binding.run_id);
  assert.equal(receipt.schema_version, "xuanxue-agent-runtime-receipt.v6");
  assert.equal(receipt.browser_authority_state, "present");
  assert.equal(receipt.browser_target_state, "claimed");
  const revalidated = createAgentRuntimeReceiptV6({
    environment_id: receipt.environment_id, device_id: receipt.device_id,
    device_epoch: receipt.device_epoch, worker_session_id: receipt.worker_session_id,
    worker_session_epoch: receipt.worker_session_epoch,
    runtime_attestation_receipt_hash: receipt.runtime_attestation_receipt_hash,
    browser_authority_state: receipt.browser_authority_state,
    browser_target_state: receipt.browser_target_state,
    browser_lane_state: receipt.browser_lane_state,
    createdAt: receipt.created_at,
  });
  assert.deepEqual(revalidated, receipt);
  assert.equal(XuanxueDynamicProofBindingContract.hashReceipt(receipt), input.binding.runtime_receipt_hash);
  return receipt;
};
