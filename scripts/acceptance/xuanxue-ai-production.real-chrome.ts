import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { XuanxueDynamicProofBindingContract } from "../../src/capabilities/ai-input-gateway/index.js";
import { GRASSEYE_UNPACKED_EXTENSION_ID } from "../../src/lib/browser/release/unpacked-extension-release-identity.js";
import { XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH } from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-contract.js";
import {
  canonicalXuanxueRealRunRoot, currentXuanxueSourceCandidate,
  readXuanxueRealChromeEvidence, realChromeEvidenceArgument, validateBoundRuntimeReceipt,
} from "./xuanxue-ai-production-real-proof-support.js";

const fail = (reason: string): never => {
  process.stderr.write(`${JSON.stringify({ status: "NOT_PRODUCTION_VERIFIED", reason })}\n`);
  process.exit(1);
};

try {
  const evidence = readXuanxueRealChromeEvidence(realChromeEvidenceArgument());
  assert.equal(evidence.schemaVersion, "xuanxue-ai-production-real-chrome-evidence.v6");
  assert.equal(evidence.contractManifestHash, XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH);
  assert.equal(evidence.extensionId, GRASSEYE_UNPACKED_EXTENSION_ID);
  assert.equal(evidence.releaseMode, "unpacked-manual-reload");
  assert.equal(evidence.workbenchUrl, "http://127.0.0.1:4173/");
  assert.ok(statSync(resolve(evidence.realRunRoot)).isDirectory());
  assert.equal(resolve(evidence.realRunRoot), canonicalXuanxueRealRunRoot());
  const binding = XuanxueDynamicProofBindingContract.validate(
    JSON.parse(readFileSync(join(resolve(evidence.realRunRoot), XuanxueDynamicProofBindingContract.fileName), "utf8")),
    currentXuanxueSourceCandidate(), XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH,
  );
  const receipt = validateBoundRuntimeReceipt({ evidence, binding, runRoot: evidence.realRunRoot });
  assert.ok(evidence.evidenceRefs.length > 0);
  process.stdout.write(`${JSON.stringify({
    marker: "[ACCEPTANCE][XUANXUE-AI-PRODUCTION][REAL-CHROME-V6]",
    status: "CHROME_VERIFIED", contractManifestHash: evidence.contractManifestHash,
    extensionId: evidence.extensionId, workerSessionId: receipt.worker_session_id,
    runtimeAttestationReceiptHash: receipt.runtime_attestation_receipt_hash,
  })}\n`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
