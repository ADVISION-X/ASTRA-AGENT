import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  createXuanxueAiProductionOrder,
  createAgentRuntimeReceiptV6,
  executeXuanxueAiProductionOrder,
  XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH,
  XuanxueAiProductionStore,
  type XuanxueAiProductionRuntime,
} from "../../src/plugins/xuanxue-ai-production/index.js";
import { assertXuanxueAiProductionV6DeadlineBudget } from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-worker.js";
import { CloudExecutionGrantV6Schema } from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-runtime-protocol.js";
import { runXuanxueAdmissionInspectorAttacks } from "./xuanxue-ai-production-admission-inspector.attacks.js";
import { FixtureGateway, order } from "./xuanxue-ai-production-fixture.js";
import { acceptXuanxueAiProductionConcurrency } from "./xuanxue-ai-production-concurrency-acceptance.js";
import { acceptXuanxueOrderGraphs } from "./xuanxue-ai-production-order-graph-acceptance.js";
import { acceptXuanxueParentRecovery } from "./xuanxue-ai-production-parent-recovery.js";
import { acceptXuanxueAiProductionRecovery } from "./xuanxue-ai-production-recovery-acceptance.js";
import { acceptStoredOrderContractQuarantine } from "./xuanxue-ai-production-stored-order-quarantine-acceptance.js";
import { acceptXuanxueAiProductionSurface } from "./xuanxue-ai-production-surface-acceptance.js";
import { acceptContinuousRecoveryVersion } from "./xuanxue-ai-production-continuous-reconciliation.js";

const receipt = createAgentRuntimeReceiptV6({
  environment_id: "production", device_id: "aipdev_fixture", device_epoch: 2,
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
  product_contract_hash: `sha256:${"e".repeat(64)}`,
  required_capabilities: ["browser"],
  attempt_id: "attempt",
  device_id: "aipdev_fixture", device_epoch: 1,
  worker_session_id: "aipsess_fixture", worker_session_epoch: 1,
  lease_token: `aipl_v6_${"x".repeat(32)}`, lease_version: 1,
  server_now: "2026-08-23T00:00:00.000Z", accept_by: "2026-08-23T00:00:30.000Z",
  lease_expires_at: "2026-08-23T00:01:30.000Z", renew_after_ms: 20_000,
  control_contract_manifest_hash: XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH,
  execution_fence: {
    schema_version: "xuanxue-ai-execution-fence.v6", environment_id: "production",
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
const dataDir = await mkdtemp(path.join(tmpdir(), "xuanxue-ai-production-v6-"));
try {
  await acceptStoredOrderContractQuarantine();
  const generatedDirectory = path.join(
    dataDir,
    "runtime-data",
    "ai-input-gateway",
    "generated-images",
  );
  await mkdir(generatedDirectory, { recursive: true });
  const generatedImagePath = path.join(generatedDirectory, "fixture-generated.png");
  const sharp = (await import("sharp")).default;
  await sharp({
    create: {
      width: 1400,
      height: 800,
      channels: 3,
      background: { r: 200, g: 181, b: 138 },
    },
  }).png().toFile(generatedImagePath);
  const generatedBytes = await readFile(generatedImagePath);
  const generatedHash = `sha256:${createHash("sha256").update(generatedBytes).digest("hex")}` as const;
  const gateway = new FixtureGateway({
    kind: "generated_image",
    artifactRef: "artifact://fixture/generated-image",
    filePath: generatedImagePath,
    mimeType: "image/png",
    sha256: generatedHash,
    originalSha256: generatedHash,
    providerOutputRef: "artifact://fixture/generated-image",
    byteCount: generatedBytes.byteLength,
    width: 1400,
    height: 800,
  });
  const store = new XuanxueAiProductionStore(dataDir);
  const runtime: XuanxueAiProductionRuntime = {
    candidateHash: `sha256:${"a".repeat(64)}`,
    dataDir,
    aiInputGateway: gateway,
    store,
  };
  const unacceptedOrder = order(
    "aiprod_unaccepted_lease_rebind",
    "localization_static_review_candidate",
    ["candidate_a"],
    "candidate_a",
  );
  unacceptedOrder.cloudExecutionIdentity = {
    jobId: unacceptedOrder.orderId,
    attemptId: "attempt-unaccepted-1",
    requiredDeviceId: "aipdev_fixture",
    leaseVersion: 1,
    executionFenceHash: `sha256:${"1".repeat(64)}`,
    contractManifestHash: XUANXUE_AI_PRODUCTION_V6_CONTRACT_MANIFEST_HASH,
    serverNow: "2026-08-26T00:00:00.000Z",
    leaseExpiresAt: "2026-08-26T00:01:30.000Z",
  };
  createXuanxueAiProductionOrder(runtime, unacceptedOrder);
  const reboundOrder = {
    ...unacceptedOrder,
    cloudExecutionIdentity: {
      ...unacceptedOrder.cloudExecutionIdentity,
      attemptId: "attempt-unaccepted-2",
      leaseVersion: 2,
      executionFenceHash: `sha256:${"2".repeat(64)}` as const,
      serverNow: "2026-08-26T00:02:00.000Z",
      leaseExpiresAt: "2026-08-26T00:03:30.000Z",
    },
  };
  const rebound = createXuanxueAiProductionOrder(runtime, reboundOrder);
  assert.equal(rebound.status, "queued");
  assert.equal(rebound.order.cloudExecutionIdentity?.attemptId, "attempt-unaccepted-2");
  assert.equal(rebound.order.cloudExecutionIdentity?.leaseVersion, 2);
  const { hehun, qimenFollowupParent, qimenFollowupParentFinal } =
    await acceptXuanxueOrderGraphs({ runtime, gateway });
  await acceptXuanxueAiProductionSurface({ runtime, gateway });
  await acceptXuanxueAiProductionRecovery({ dataDir, runtime, gateway });
  await acceptXuanxueAiProductionConcurrency({ runtime, gateway });
  await acceptXuanxueParentRecovery({
    runtime,
    gateway,
    qimenParent: qimenFollowupParent,
    qimenParentFinal: qimenFollowupParentFinal,
  });
  const recoveryVersionOrder = createXuanxueAiProductionOrder(
    runtime,
    order("aiprod_continuous_recovery_version", "qimen_professional_answer", ["analysis"]),
  );
  await acceptContinuousRecoveryVersion(recoveryVersionOrder);

  for (const [orderId, productId, stageId, role] of [
    ["aiprod_localization_candidate_a", "localization_static_review_candidate", "candidate_a", "candidate_a"],
    ["aiprod_localization_candidate_b", "localization_static_review_candidate", "candidate_b", "candidate_b"],
    ["aiprod_localization_selector_first", "localization_static_review_selector", "selector_first", "selector_first"],
    ["aiprod_localization_consistency", "localization_static_review_selector", "consistency", "consistency"],
  ] as const) {
    const localOrder = order(orderId, productId, [stageId], role);
    createXuanxueAiProductionOrder(runtime, localOrder);
    assert.equal((await executeXuanxueAiProductionOrder(runtime, orderId)).status, "completed");
  }
  const selectorFirst = store.readOrder("aiprod_localization_selector_first")!;
  const selectorFirstStage = selectorFirst.stages[0]!;
  const selectorSwap = order(
    "aiprod_localization_selector_swap",
    "localization_static_review_selector",
    ["selector_swap"],
    "selector_swap",
  );
  selectorSwap.frozenSubject = selectorFirst.order.frozenSubject;
  selectorSwap.conversationScopeRef = selectorFirst.order.conversationScopeRef;
  selectorSwap.conversationParent = {
    relation: "same_conversation",
    jobId: selectorFirst.order.orderId,
    stageId: "selector_first",
    executionId: selectorFirstStage.executionId,
    rawOutputHash: selectorFirstStage.rawOutputHash!,
    inputBundleHash: selectorFirst.order.inputBundleHash,
    conversationScopeRef: selectorFirst.order.conversationScopeRef,
  };
  createXuanxueAiProductionOrder(runtime, selectorSwap);
  assert.equal(
    (await executeXuanxueAiProductionOrder(runtime, selectorSwap.orderId)).status,
    "completed",
  );
  assert.ok(store.readOrder(hehun.orderId)?.result?.productContractHash);
  store.close();
} finally {
  await rm(dataDir, { recursive: true, force: true });
}

runXuanxueAdmissionInspectorAttacks();
process.stdout.write("[ACCEPTANCE][XUANXUE-AI-PRODUCTION-V6] PASS: authenticated immutable Cloud order, generic local Stage executor, recovery and no parallel topology.\n");
