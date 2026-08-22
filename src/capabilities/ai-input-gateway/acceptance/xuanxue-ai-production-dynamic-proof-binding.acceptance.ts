import assert from "node:assert/strict";

import {
  assertXuanxueProviderRecordHash,
  hashXuanxueDynamicReceipt,
  validateXuanxueDynamicProofBinding,
  XUANXUE_DYNAMIC_PROOF_MAX_AGE_MS,
} from "../xuanxue-dynamic-proof-contract.js";
import { parseXuanxueSourceCandidateHash } from "../xuanxue-dynamic-proof-contract.js";

const candidateHash =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const foreignCandidateHash =
  "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as const;
const contractManifestHash =
  "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as const;
const foreignContractManifestHash =
  "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" as const;
const providerRecord = '{"executionId":"execution-1","status":"response_captured"}\n';
const providerRecordHash =
  "sha256:b41ccfb8bc19b18a98d27a622cfd02f775d37f2f9cc19d19e8a0ae8154fa1010" as const;
const now = Date.parse("2026-08-22T08:00:00.000Z");
const missingCandidateMessage =
  "GRASSEYE_SOURCE_FINGERPRINT must bind the current source candidate";
const foreignCandidateMessage = "dynamic proof belongs to a foreign source candidate";
const foreignContractMessage = "dynamic proof belongs to a foreign contract manifest";
const staleProofMessage = "dynamic proof is stale";
const providerRecordMismatchMessage =
  "provider record hash does not match the bound real run";
const providerRecordMissingMessage =
  "provider record is absent from the bound real run";
const valid = {
  schema_version: "xuanxue-ai-production-dynamic-proof-binding.v2",
  run_id: "dynamic-proof-run-1",
  candidate_hash: candidateHash,
  contract_manifest_hash: contractManifestHash,
  runtime_receipt_hash:
    "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  cloud_terminal_job_ids: ["aiprod_order_1"],
  provider_record_hashes: { "execution-1": providerRecordHash },
  captured_at: new Date(now).toISOString(),
};

assert.equal(
  validateXuanxueDynamicProofBinding(
    valid,
    candidateHash,
    contractManifestHash,
    now,
  ).run_id,
  valid.run_id,
);
assert.throws(
  () => parseXuanxueSourceCandidateHash(undefined),
  (error) => error instanceof Error && error.message === missingCandidateMessage,
);
assert.throws(
  () => validateXuanxueDynamicProofBinding(
    { ...valid, candidate_hash: foreignCandidateHash },
    candidateHash,
    contractManifestHash,
    now,
  ),
  (error) => error instanceof Error && error.message === foreignCandidateMessage,
);
assert.throws(
  () => validateXuanxueDynamicProofBinding(
    { ...valid, contract_manifest_hash: foreignContractManifestHash },
    candidateHash,
    contractManifestHash,
    now,
  ),
  (error) => error instanceof Error && error.message === foreignContractMessage,
);
assert.throws(
  () => validateXuanxueDynamicProofBinding(
    {
      ...valid,
      captured_at: new Date(now - XUANXUE_DYNAMIC_PROOF_MAX_AGE_MS - 1).toISOString(),
    },
    candidateHash,
    contractManifestHash,
    now,
  ),
  (error) => error instanceof Error && error.message === staleProofMessage,
);
assert.throws(
  () => validateXuanxueDynamicProofBinding(
    { ...valid, run_id: "", extra: true },
    candidateHash,
    contractManifestHash,
    now,
  ),
  /shape is invalid/u,
);
assert.throws(
  () => validateXuanxueDynamicProofBinding(
    { ...valid, cloud_terminal_job_ids: ["aiprod_z", "aiprod_a"] },
    candidateHash,
    contractManifestHash,
    now,
  ),
  /shape is invalid/u,
);
const binding = validateXuanxueDynamicProofBinding(
  valid,
  candidateHash,
  contractManifestHash,
  now,
);
assert.doesNotThrow(() => assertXuanxueProviderRecordHash(
  binding,
  "execution-1",
  providerRecord,
));
assert.throws(
  () => assertXuanxueProviderRecordHash(
    binding,
    "execution-1",
    `${providerRecord.trimEnd()},\"copied\":true}\n`,
  ),
  (error) => error instanceof Error && error.message === providerRecordMismatchMessage,
);
assert.throws(
  () => assertXuanxueProviderRecordHash(binding, "foreign-execution", providerRecord),
  (error) => error instanceof Error && error.message === providerRecordMissingMessage,
);
assert.equal(
  hashXuanxueDynamicReceipt({ b: 2, a: 1 }),
  hashXuanxueDynamicReceipt({ a: 1, b: 2 }),
  "immutable runtime receipt hashing must be canonical",
);
