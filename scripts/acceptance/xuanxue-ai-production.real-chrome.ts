import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { GRASSEYE_UNPACKED_EXTENSION_ID } from "../../src/lib/browser/release/unpacked-extension-release-identity.js";
import {
  createAgentRuntimeReceiptV5,
  type AgentRuntimeReceiptV5,
} from "../../src/plugins/xuanxue-ai-production/index.js";
import {
  XUANXUE_AI_PRODUCTION_V5_CONTRACT_MANIFEST_HASH,
} from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-contract.js";

type XuanxueRealChromeEvidenceV5 = Readonly<{
  schemaVersion: "xuanxue-ai-production-real-chrome-evidence.v5";
  contractManifestHash: `sha256:${string}`;
  extensionId: string;
  releaseMode: "unpacked-manual-reload";
  workbenchUrl: string;
  realRunRoot: string;
  runtimeReceipt: AgentRuntimeReceiptV5;
  evidenceRefs: readonly string[];
}>;

const sha256Pattern = /^sha256:[a-f0-9]{64}$/u;
const evidenceArgument = process.argv.indexOf("--evidence");

const fail = (reason: string): never => {
  process.stderr.write(`${JSON.stringify({
    status: "NOT_PRODUCTION_VERIFIED",
    reason,
  })}\n`);
  process.exit(1);
};

const assertSha256 = (value: string, field: string): void => {
  assert.match(value, sha256Pattern, field);
};

if (evidenceArgument === -1 || !process.argv[evidenceArgument + 1]) {
  fail(
    "The unique Cloud Worker -> Mediator -> Plugin -> Browser Authority journey must emit a real Chrome evidence envelope; pass it with --evidence.",
  );
}

try {
  const evidencePath = resolve(process.argv[evidenceArgument + 1]!);
  const evidence = JSON.parse(
    readFileSync(evidencePath, "utf8"),
  ) as XuanxueRealChromeEvidenceV5;
  assert.equal(
    evidence.schemaVersion,
    "xuanxue-ai-production-real-chrome-evidence.v5",
  );
  assert.equal(
    evidence.contractManifestHash,
    XUANXUE_AI_PRODUCTION_V5_CONTRACT_MANIFEST_HASH,
  );
  assert.equal(evidence.extensionId, GRASSEYE_UNPACKED_EXTENSION_ID);
  assert.equal(evidence.releaseMode, "unpacked-manual-reload");
  assert.equal(evidence.workbenchUrl, "http://127.0.0.1:4173/");
  assert.ok(statSync(resolve(evidence.realRunRoot)).isDirectory());
  assert.ok(
    Array.isArray(evidence.evidenceRefs)
      && evidence.evidenceRefs.length > 0
      && evidence.evidenceRefs.every((ref) => ref.trim().length > 0),
  );

  const receipt = evidence.runtimeReceipt;
  assert.equal(receipt.schema_version, "xuanxue-agent-runtime-receipt-v5");
  assert.equal(receipt.status, "complete");
  assert.equal(receipt.browser_required, true);
  assert.ok(receipt.browser_proof);
  assertSha256(receipt.candidate_hash, "candidate_hash");
  assert.equal(receipt.browser_proof.unresolved_outcome_unknown_count, 0);
  assert.equal(receipt.browser_proof.no_action_during_authority_absence, true);
  assert.ok(receipt.browser_proof.windows.length > 0);
  for (const window of receipt.browser_proof.windows) {
    for (const [field, value] of Object.entries(window)) {
      if (field.endsWith("_hash")) assertSha256(String(value), field);
    }
  }
  for (const field of [
    "elected_worker_chain_hash",
    "handover_receipt_chain_hash",
    "browser_action_receipt_root_hash",
  ] as const) {
    assertSha256(receipt.browser_proof[field], field);
  }

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
  assert.deepEqual(evidence.evidenceRefs, receipt.evidence_refs);

  process.stdout.write(`${JSON.stringify({
    marker: "[ACCEPTANCE][XUANXUE-AI-PRODUCTION][REAL-CHROME-V5]",
    status: "CHROME_VERIFIED",
    contractManifestHash: evidence.contractManifestHash,
    extensionId: evidence.extensionId,
    requestId: receipt.request_id,
    executionId: receipt.execution_id,
    windowCount: receipt.browser_proof.windows.length,
  })}\n`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
