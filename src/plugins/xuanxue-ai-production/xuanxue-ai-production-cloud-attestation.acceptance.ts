import assert from "node:assert/strict";

import {
  XUANXUE_AI_PRODUCTION_V5_CONTRACT_MANIFEST_HASH,
} from "./xuanxue-ai-production-cloud-contract.js";
import {
  validateXuanxueAiProductionCloudRunAttestation,
} from "./xuanxue-ai-production-cloud-attestation.js";
import {
  XUANXUE_LOCALIZATION_SUPPORTED_PRODUCT_CONTRACTS,
} from "./xuanxue-ai-production-localization-contract.js";

const candidateHash =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const now = Date.parse("2026-08-22T12:00:00.000Z");
const valid = {
  credentialDeviceId: "aipdev_production",
  candidateHash,
  terminalJobIds: ["aiprod_first", "aiprod_second"],
  device: {
    device_id: "aipdev_production",
    max_in_flight: 10,
    status: "active" as const,
    last_heartbeat_at: new Date(now).toISOString(),
    contract_manifest_hash: XUANXUE_AI_PRODUCTION_V5_CONTRACT_MANIFEST_HASH,
    supported_product_contracts: XUANXUE_LOCALIZATION_SUPPORTED_PRODUCT_CONTRACTS,
    agent_build_fingerprint: candidateHash,
  },
  statuses: [
    { job_id: "aiprod_first", status: "completed" },
    { job_id: "aiprod_second", status: "completed" },
  ],
  nowMs: now,
};

assert.deepEqual(
  validateXuanxueAiProductionCloudRunAttestation(valid).terminalJobIds,
  valid.terminalJobIds,
);
assert.throws(
  () => validateXuanxueAiProductionCloudRunAttestation({
    ...valid,
    device: { ...valid.device, agent_build_fingerprint: null },
  }),
  /XUANXUE_AI_PRODUCTION_CLOUD_DEVICE_ATTESTATION_INVALID/u,
);
assert.throws(
  () => validateXuanxueAiProductionCloudRunAttestation({
    ...valid,
    statuses: [{ job_id: "aiprod_first", status: "completed" }],
  }),
  /XUANXUE_AI_PRODUCTION_CLOUD_TERMINAL_ATTESTATION_INVALID/u,
);
