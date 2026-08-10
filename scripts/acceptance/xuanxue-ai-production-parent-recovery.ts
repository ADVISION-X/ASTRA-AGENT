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
  repairLegacyFollowupWrongChatExecutionStates,
} from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-store-recovery.js";
import {
  FixtureGateway,
  hash,
  order,
} from "./xuanxue-ai-production-fixture.js";
import {
  acceptXuanxueParentRebuilds,
} from "./xuanxue-ai-production-parent-rebuild-acceptance.js";

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
    conversationParent: {
      relation: "same_conversation" as const,
      jobId: input.qimenParent.orderId,
      stageId: "analysis" as const,
      executionId: input.qimenParentFinal.executionId,
      rawOutputHash: input.qimenParentFinal.rawOutputHash!,
      inputBundleHash: input.qimenParent.inputBundleHash,
      conversationScopeRef: input.qimenParent.conversationScopeRef,
    },
    frozenSubject: input.qimenParent.frozenSubject,
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
  conversationParent: {
    relation: "same_conversation",
    jobId: input.qimenParent.orderId,
    stageId: "analysis",
    executionId: input.qimenParentFinal.executionId,
    rawOutputHash: input.qimenParentFinal.rawOutputHash!,
    inputBundleHash: input.qimenParent.inputBundleHash,
    conversationScopeRef: input.qimenParent.conversationScopeRef,
  },
  frozenSubject: input.qimenParent.frozenSubject,
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
    conversationParent: null,
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
          : { ...materialRef, filePath: "/legacy/parent-report.json" }),
    })),
  };
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
    executionId: `xuanxue-ai-production:${child.orderId}:followup`,
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
  assert.deepEqual(repaired.order.conversationParent, child.conversationParent);
  assert.equal(repaired.order.requestHash, child.requestHash);
  assert.notEqual(
    repaired.stages[0]!.executionId,
    legacyExecutionId,
    "legacy wrong-chat attachment proof must be retired with a fresh execution id",
  );
  assert.match(repaired.stages[0]!.executionId, /followup-parent-binding-recovery/u);
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
    child.materials[0]!.maxFileCount,
  );
};

export const acceptXuanxueParentRecovery = async (
  input: ParentAcceptanceInput,
): Promise<void> => {
  await acceptSameParentFifo(input);
  await acceptXuanxueParentRebuilds(input);
  await acceptLegacyFollowupParentRepair(input);
};
