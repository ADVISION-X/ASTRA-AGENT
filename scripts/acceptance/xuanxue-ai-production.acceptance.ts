import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  createAgentRuntimeReceiptV6,
  XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH,
} from "../../src/plugins/xuanxue-ai-production/index.js";
import { assertXuanxueAiProductionV6DeadlineBudget } from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-worker.js";
import { assertWorkerSessionOpenV6, CloudExecutionGrantV6Schema, XuanxueAiProductionV6ManifestSchema } from "../../src/plugins/xuanxue-ai-production/generated/xuanxue-ai-production-v6.validator.js";
import { XUANXUE_AI_PRODUCTION_SUPPORTED_PRODUCT_CONTRACT_HASHES_V6 } from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-product-contracts.js";
import { runXuanxueAdmissionInspectorAttacks } from "./xuanxue-ai-production-admission-inspector.attacks.js";

const manifest = XuanxueAiProductionV6ManifestSchema.parse(JSON.parse(await readFile(
  path.resolve("src/plugins/xuanxue-ai-production/generated/xuanxue-ai-production-v6.manifest.json"),
  "utf8",
)));
assert.equal(manifest.protocol_version, "xuanxue-ai-production-v6");
assert.equal(manifest.max_business_in_flight, 10);
assert.equal(manifest.max_browser_in_flight, 1);
assert.equal(manifest.session_credential_ttl_seconds, 180);
assert.equal(manifest.session_credential_overlap_seconds, 60);
assert.equal(manifest.runtime_attestation_ttl_seconds, 45);
assert.deepEqual(manifest.claim_outcomes, [
  "LEASE_GRANTED", "NO_ELIGIBLE_JOB", "CAPACITY_ZERO", "CLAIM_BLOCKED", "DRAINING",
]);
assert.equal(new Set(XUANXUE_AI_PRODUCTION_SUPPORTED_PRODUCT_CONTRACT_HASHES_V6).size, 20);
assert.ok(XUANXUE_AI_PRODUCTION_SUPPORTED_PRODUCT_CONTRACT_HASHES_V6.every((value) => /^sha256:[a-f0-9]{64}$/u.test(value)));
const generatedValidator = await readFile(path.resolve(
  "src/plugins/xuanxue-ai-production/generated/xuanxue-ai-production-v6.validator.ts",
), "utf8");
assert.match(generatedValidator, /^\/\/ GENERATED FILE\. DO NOT EDIT\./u);
assert.match(generatedValidator, /Provider: ADVISION-X\/xuanxue-web@[a-f0-9]{40}/u);
assert.doesNotMatch(generatedValidator, /from "zod"|agent_instance_id/u);
const sessionOpen = {
  schema_version: "xuanxue-ai-worker-session-open.v6",
  request_id: "open", environment_id: "isolated-test", origin: "https://agent.example.test",
  device_id: "device", device_epoch: 1, worker_instance_id: "worker",
  agent_build_hash: `sha256:${"a".repeat(64)}`,
  control_manifest_hash: `sha256:${"b".repeat(64)}`,
};
assert.doesNotThrow(() => assertWorkerSessionOpenV6(sessionOpen));
assert.throws(() => assertWorkerSessionOpenV6({
  ...sessionOpen, worker_instance_id: undefined, agent_instance_id: "legacy",
}));

const receipt = createAgentRuntimeReceiptV6({
  environment_id: "isolated-test", device_id: "aipdev_fixture", device_epoch: 2,
  worker_session_id: "aipsess_fixture", worker_session_epoch: 3,
  runtime_attestation_receipt_hash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  browser_authority_state: "present", browser_target_state: "claimed", browser_lane_state: "idle",
  createdAt: "2026-08-23T00:00:00.000Z",
});
assert.equal(receipt.schema_version, "xuanxue-agent-runtime-receipt.v6");

const grant = CloudExecutionGrantV6Schema.parse({
  schema_version: "xuanxue-ai-cloud-execution-grant.v6",
  control_protocol_version: "xuanxue-ai-production-v6",
  claim_batch_id: "batch", job_id: "aiprod_fixture", source_task_id: "task",
  request_hash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  job_contract_version: "xuanxue-ai-job-contract.bazi_chart_interpretation.v6",
  product_contract_hash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  required_capabilities: ["gpt_web_browser"], attempt_id: "attempt",
  device_id: "aipdev_fixture", device_epoch: 1,
  worker_session_id: "aipsess_fixture", worker_session_epoch: 1,
  lease_token: `aipl_v6_${"x".repeat(32)}`, lease_version: 1,
  server_now: "2026-08-23T00:00:00.000Z", accept_by: "2026-08-23T00:00:30.000Z",
  lease_expires_at: "2026-08-23T00:01:30.000Z", renew_after_ms: 20_000,
  control_contract_manifest_hash: XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH,
  execution_fence: {
    schema_version: "xuanxue-ai-execution-fence.v6", environment_id: "isolated-test",
    device_id: "aipdev_fixture", device_epoch: 1,
    worker_session_id: "aipsess_fixture", worker_session_epoch: 1,
    job_id: "aiprod_fixture", attempt_id: "attempt", lease_version: 1,
    lease_token_hash: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    control_contract_manifest_hash: XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH,
    fence_hash: "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
  },
});
assert.doesNotThrow(() => assertXuanxueAiProductionV6DeadlineBudget(grant, 1_000));
assert.throws(() => assertXuanxueAiProductionV6DeadlineBudget(grant, 25_001), /V6_DEADLINE_BUDGET_EXHAUSTED/u);

const source = await readFile(path.resolve("src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-worker.ts"), "utf8");
assert.doesNotMatch(source, /xuanxue-ai-production-v5|compat|fallback|dual.write|shadow/iu);
assert.match(source, /persistClaimIdentity/u);
assert.match(source, /flushXuanxueAiProductionCloudOutbox/u);
assert.match(source, /browserActionInFlight/u);
runXuanxueAdmissionInspectorAttacks();
process.stdout.write("[ACCEPTANCE][XUANXUE-AI-PRODUCTION-V6] PASS\n");
