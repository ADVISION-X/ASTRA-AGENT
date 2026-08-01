import assert from "node:assert/strict";
import Database from "better-sqlite3";
import path from "node:path";

import {
  createXuanxueAiProductionOrder,
  executeXuanxueAiProductionOrder,
  XuanxueAiProductionCoordinator,
  type XuanxueAiOrderRecord,
  type XuanxueAiProductionOrder,
  type XuanxueAiProductionRuntime,
} from "../../src/plugins/xuanxue-ai-production/index.js";
import {
  XuanxueAiProductionCloudClaimedJobSchema,
} from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-contract.js";
import {
  repairLegacyFollowupWrongChatExecutionStates,
} from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-store-recovery.js";
import {
  FixtureGateway,
  hash,
  order,
} from "./xuanxue-ai-production-fixture.js";

interface ParentAcceptanceInput {
  readonly runtime: XuanxueAiProductionRuntime;
  readonly gateway: FixtureGateway;
  readonly qimenParent: XuanxueAiProductionOrder;
  readonly qimenParentFinal: XuanxueAiOrderRecord["stages"][number];
}

const acceptSameParentFifo = async (
  input: ParentAcceptanceInput,
): Promise<void> => {
  assert.throws(
    () => createXuanxueAiProductionOrder(input.runtime, order(
      "aiprod_followup_without_parent",
      "qimen_report_followup",
      ["followup"],
    )),
    /CONTINUATION_PROFILE_INVALID/u,
    "a paid follow-up without an exact parent must never reach GPT",
  );
  const parentUrl =
    input.qimenParentFinal.aiFeedResult?.providerProof.webChatUrl;
  assert.ok(parentUrl);
  const children = Array.from({ length: 3 }, (_, index) => ({
    ...order(
      `aiprod_same_parent_followup_${index + 1}`,
      "qimen_report_followup",
      ["followup"],
    ),
    continuationParent: {
      jobId: input.qimenParent.orderId,
      stageId: "analysis" as const,
      rawOutputHash: input.qimenParentFinal.rawOutputHash!,
    },
    createdAt: new Date(Date.now() + index).toISOString(),
  }));
  for (const child of children) {
    createXuanxueAiProductionOrder(input.runtime, child);
  }
  const coordinator = new XuanxueAiProductionCoordinator(input.runtime);
  const results = await Promise.all(
    children.map((child) => coordinator.execute(child.orderId)),
  );
  await coordinator.close();
  assert.ok(results.every((record) => record.status === "completed"));
  assert.equal(
    input.gateway.maxActiveByContinuation.get(parentUrl),
    1,
    "orders sharing one parent GPT conversation must be serialized",
  );
  assert.deepEqual(
    input.gateway.requests
      .filter((request) => request.taskIdentity.sourceTaskId.startsWith(
        "aiprod_same_parent_followup_",
      ))
      .map((request) => request.runId),
    children.map((child) => child.orderId),
    "same-parent follow-ups must preserve FIFO order",
  );
};

const acceptLostProviderParent = async (
  input: ParentAcceptanceInput,
): Promise<void> => {
  const parent = order(
    "aiprod_lost_parent_conversation",
    "qimen_professional_answer",
    ["analysis"],
  );
  createXuanxueAiProductionOrder(input.runtime, parent);
  const completed = await executeXuanxueAiProductionOrder(
    input.runtime,
    parent.orderId,
  );
  const stage = completed.stages[0]!;
  assert.ok(stage.rawOutputHash && stage.aiFeedResult);
  input.runtime.store.updateStage({
    ...stage,
    aiFeedResult: {
      ...stage.aiFeedResult,
      providerProof: {
        ...stage.aiFeedResult.providerProof,
        webChatUrl: null,
      },
    },
    updatedAt: new Date().toISOString(),
  }, "fixture_parent_conversation_lost");
  const child: XuanxueAiProductionOrder = {
    ...order(
      "aiprod_followup_after_parent_loss",
      "qimen_report_followup",
      ["followup"],
    ),
    continuationParent: {
      jobId: parent.orderId,
      stageId: "analysis",
      rawOutputHash: stage.rawOutputHash,
    },
  };
  createXuanxueAiProductionOrder(input.runtime, child);
  const before = input.gateway.requests.length;
  const coordinator = new XuanxueAiProductionCoordinator(input.runtime);
  const result = await coordinator.execute(child.orderId);
  await coordinator.close();
  assert.equal(result.status, "completed");
  assert.equal(
    input.gateway.requests.length - before,
    2,
    "a missing parent chat must replay the parent first, then ask the follow-up",
  );
  const rebuilt = input.runtime.store.readParentConversationRebuild({
    parentJobId: parent.orderId,
    parentStageId: "analysis",
    originalRawOutputHash: stage.rawOutputHash,
  });
  assert.ok(rebuilt);
  const request = input.gateway.requests.find(
    (candidate) => candidate.runId === child.orderId,
  );
  assert.equal(
    request?.providerContinuationRef?.providerPageUrl,
    rebuilt.providerPageUrl,
  );
};

const cloudMaterial = (
  candidate: XuanxueAiProductionOrder["materials"][number],
) => ({
  stage_id: candidate.stageId,
  prompt_package_id: candidate.promptPackageId,
  prompt_contract_id: candidate.promptContractId,
  output_schema_ref: candidate.expectedOutputSchemaRef,
  expected_output_kind: candidate.expectedOutputKind,
  text_prompt: candidate.textPrompt,
  timeout_ms: candidate.timeoutMs,
  max_input_chars: candidate.maxInputChars,
  max_file_count: candidate.maxFileCount,
  max_file_bytes: candidate.maxFileBytes,
  inputs: [],
});

const parseCloudReplayClaim = (
  parent: XuanxueAiProductionOrder,
  child: XuanxueAiProductionOrder,
) => XuanxueAiProductionCloudClaimedJobSchema.parse({
  protocol_version: "xuanxue-ai-production-v2",
  job_id: child.orderId,
  idempotency_key: `idem:${child.orderId}`,
  source_task_id: child.sourceTaskId,
  product_id: child.productId,
  service_class: child.serviceClass,
  trigger_kind: child.triggerKind,
  lineage_id: child.lineageId,
  reflection_snapshot_ref: child.reflectionSnapshotRef,
  reflection_plan_id: child.reflectionPlanId,
  input_bundle_ref: child.inputBundleRef,
  input_bundle_hash: child.inputBundleHash,
  request_hash: child.requestHash,
  continuation_parent: {
    job_id: parent.orderId,
    stage_id: "analysis",
    raw_output_hash: child.continuationParent!.rawOutputHash,
  },
  continuation_parent_replay: {
    job_id: parent.orderId,
    source_task_id: parent.sourceTaskId,
    product_id: parent.productId,
    service_class: parent.serviceClass,
    trigger_kind: parent.triggerKind,
    lineage_id: parent.lineageId,
    reflection_snapshot_ref: parent.reflectionSnapshotRef,
    reflection_plan_id: parent.reflectionPlanId,
    input_bundle_ref: parent.inputBundleRef,
    input_bundle_hash: parent.inputBundleHash,
    request_hash: parent.requestHash,
    seeded_stages: [],
    materials: parent.materials.map(cloudMaterial),
    created_at: parent.createdAt,
  },
  seeded_stages: [],
  execution_lane: "supervised_local_gpt_web",
  materials: child.materials.map(cloudMaterial),
  status: "leased",
  lease_owner: "fixture-device",
  lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
  retry_not_before: null,
  result_json: null,
  failure_ledger: [],
  created_at: child.createdAt,
  updated_at: child.createdAt,
  lease_token: "fixture-lease-token",
  lease_version: 1,
});

const acceptCloudRehydratedParent = async (
  input: ParentAcceptanceInput,
): Promise<void> => {
  const parent = order(
    "aiprod_cloud_replay_parent",
    "qimen_professional_answer",
    ["analysis"],
  );
  const originalHash = hash("cloud-original-parent-output");
  const child: XuanxueAiProductionOrder = {
    ...order(
      "aiprod_cloud_replay_child",
      "qimen_report_followup",
      ["followup"],
    ),
    continuationParent: {
      jobId: parent.orderId,
      stageId: "analysis",
      rawOutputHash: originalHash,
    },
  };
  const cloudClaim = parseCloudReplayClaim(parent, child);
  assert.equal(
    cloudClaim.continuation_parent_replay?.job_id,
    parent.orderId,
  );
  createXuanxueAiProductionOrder(input.runtime, parent);
  createXuanxueAiProductionOrder(input.runtime, child);
  const before = input.gateway.requests.length;
  const coordinator = new XuanxueAiProductionCoordinator(input.runtime);
  const result = await coordinator.execute(child.orderId);
  await coordinator.close();
  assert.equal(result.status, "completed");
  assert.equal(
    input.gateway.requests.length - before,
    2,
    "a cloud replay package must reconstruct an absent local parent before the follow-up",
  );
  assert.ok(input.runtime.store.readParentConversationRebuild({
    parentJobId: parent.orderId,
    parentStageId: "analysis",
    originalRawOutputHash: originalHash,
  }));
};

const LEGACY_FOLLOWUP_PREFIX =
  "这是奇门正式报告的一次独立付费追问。你处于一个全新的模型上下文，只允许完成一次正式回答。";
const CURRENT_FOLLOWUP_PREFIX = [
  "这是奇门正式报告的一次独立付费追问。你必须处于父正式解答原有的同一个 provider conversation，只允许完成一次正式回答。",
  "如果当前会话不是父正式解答会话，必须停止；禁止在空白新聊天中凭附件模拟续接。",
].join("\n");

const legacyFollowupOrder = (
  input: ParentAcceptanceInput,
): XuanxueAiProductionOrder => ({
    ...order(
      "aiprod_legacy_parentless_followup",
      "qimen_report_followup",
      ["followup"],
    ),
    continuationParent: {
      jobId: input.qimenParent.orderId,
      stageId: "analysis",
      rawOutputHash: input.qimenParentFinal.rawOutputHash!,
    },
    materials: [{
      ...order(
        "aiprod_legacy_parentless_followup_material",
        "qimen_report_followup",
        ["followup"],
      ).materials[0]!,
      textPrompt: `${CURRENT_FOLLOWUP_PREFIX}\nfixture payload`,
      inputRefs: [
        {
          id: "legacy-followup-manifest",
          kind: "package_manifest_json",
          summary: "父会话续接附件清单",
          filePath: "/current/manifest.json",
          fileName: "00-followup-manifest.json",
          mimeType: "application/json",
          sha256: hash("current-manifest"),
          byteCount: 200,
        },
        {
          id: "legacy-followup-parent-report",
          kind: "verified_parent_report_json",
          summary: "父报告",
          filePath: "/current/parent-report.json",
          fileName: "02-parent-report.json",
          mimeType: "application/json",
          sha256: hash("immutable-parent-report"),
          byteCount: 2_000,
        },
      ],
    }],
  });

const overwriteLegacyFollowupRecord = (
  input: ParentAcceptanceInput,
  child: XuanxueAiProductionOrder,
): string => {
  const original = createXuanxueAiProductionOrder(input.runtime, child);
  const legacyExecutionId = original.stages[0]!.executionId;
  const sqlite = new Database(path.join(
    input.runtime.dataDir,
    "plugin-tasks",
    "xuanxue-ai-production",
    "xuanxue_ai_production.sqlite",
  ));
  const legacyRequestHash = hash("legacy-parentless-request");
  const legacy = {
    ...child,
    requestHash: legacyRequestHash,
    materials: child.materials.map((material) => ({
      ...material,
      textPrompt: material.textPrompt.replace(
        CURRENT_FOLLOWUP_PREFIX,
        LEGACY_FOLLOWUP_PREFIX,
      ),
      inputRefs: material.inputRefs.map((materialRef) =>
        materialRef.kind === "package_manifest_json"
          ? {
              ...materialRef,
              summary: "旧版新上下文附件清单",
              filePath: "/legacy/manifest.json",
              sha256: hash("legacy-manifest"),
              byteCount: 180,
            }
          : {
              ...materialRef,
              filePath: "/legacy/parent-report.json",
            }
      ),
    })),
  };
  delete (legacy as {
    continuationParent?: XuanxueAiProductionOrder["continuationParent"];
  }).continuationParent;
  sqlite.prepare(`
    update production_orders set request_hash=?,status='recovery_pending',
      order_json=?,failure_reason='legacy missing parent',result_json=null
    where order_id=?
  `).run(legacyRequestHash, JSON.stringify(legacy), child.orderId);
  sqlite.close();
  return legacyExecutionId;
};

const regressAndMigrateFollowupStage = (
  input: ParentAcceptanceInput,
  child: XuanxueAiProductionOrder,
  repaired: ReturnType<typeof createXuanxueAiProductionOrder>,
): void => {
  const migrationDatabase = new Database(path.join(
    input.runtime.dataDir,
    "plugin-tasks",
    "xuanxue-ai-production",
    "xuanxue_ai_production.sqlite",
  ));
  const regressedStage = {
    ...repaired.stages[0]!,
    executionId:
      `xuanxue-ai-production:${child.orderId}:followup`,
    status: "recovery_pending" as const,
    progressPhase: "recovery_pending" as const,
  };
  migrationDatabase.prepare(`
    update production_stages set status='recovery_pending',stage_json=?
    where order_id=? and stage_id='followup'
  `).run(JSON.stringify(regressedStage), child.orderId);
  repairLegacyFollowupWrongChatExecutionStates(migrationDatabase);
  migrationDatabase.close();
  const migrated = input.runtime.store.readOrder(child.orderId)!;
  assert.notEqual(
    migrated.stages[0]!.executionId,
    regressedStage.executionId,
    "an already repaired follow-up must retire its legacy wrong-chat execution",
  );
  assert.equal(migrated.stages[0]!.status, "queued");
};

const assertRepairedFollowup = (
  child: XuanxueAiProductionOrder,
  repaired: ReturnType<typeof createXuanxueAiProductionOrder>,
  legacyExecutionId: string,
): void => {
  assert.equal(repaired.status, "recovery_pending");
  assert.deepEqual(repaired.order.continuationParent, child.continuationParent);
  assert.equal(repaired.order.requestHash, child.requestHash);
  assert.notEqual(
    repaired.stages[0]!.executionId,
    legacyExecutionId,
    "legacy wrong-chat attachment proof must be retired with a fresh execution id",
  );
  assert.match(
    repaired.stages[0]!.executionId,
    /followup-parent-binding-recovery/u,
  );
  assert.equal(repaired.stages[0]!.aiFeedResult, null);
  assert.equal(
    repaired.order.materials[0]?.textPrompt,
    child.materials[0]?.textPrompt,
    "JSON field ordering and governance transport upgrades must not block exact legacy parent repair",
  );
};

const acceptLegacyFollowupParentRepair = async (
  input: ParentAcceptanceInput,
): Promise<void> => {
  const child = legacyFollowupOrder(input);
  const legacyExecutionId = overwriteLegacyFollowupRecord(input, child);
  const repaired = createXuanxueAiProductionOrder(input.runtime, child);
  assertRepairedFollowup(child, repaired, legacyExecutionId);
  regressAndMigrateFollowupStage(input, child, repaired);
  const before = input.gateway.requests.length;
  const completed = await executeXuanxueAiProductionOrder(
    input.runtime,
    child.orderId,
  );
  assert.equal(completed.status, "completed");
  assert.equal(input.gateway.requests.length - before, 1);
  assert.equal(
    input.gateway.requests.at(-1)?.providerContinuationRef?.providerPageUrl,
    input.qimenParentFinal.aiFeedResult?.providerProof.webChatUrl,
    "a repaired legacy follow-up must continue in its exact parent chat",
  );
  assert.equal(
    input.gateway.requests.at(-1)?.maxFileCount,
    child.materials[0]!.maxFileCount + 1,
    "one verified parent attachment must expand the frozen material file limit exactly once",
  );
};

export const acceptXuanxueParentRecovery = async (
  input: ParentAcceptanceInput,
): Promise<void> => {
  await acceptSameParentFifo(input);
  await acceptLostProviderParent(input);
  await acceptCloudRehydratedParent(input);
  await acceptLegacyFollowupParentRepair(input);
};
