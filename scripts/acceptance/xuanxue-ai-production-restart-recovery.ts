import assert from "node:assert/strict";
import {
  createXuanxueAiProductionOrder,
  XUANXUE_AI_PRODUCTION_JOB_ID,
  XuanxueAiProductionCoordinator,
  XuanxueAiProductionStore,
  type XuanxueAiProductionOrder,
  type XuanxueAiProductionRuntime,
} from "../../src/plugins/xuanxue-ai-production/index.js";
import {
  FixtureGateway,
  hash,
  order,
  providerResult,
} from "./xuanxue-ai-production-fixture.js";
interface RestartAcceptanceInput {
  readonly dataDir: string;
  readonly gateway: FixtureGateway;
  readonly runtime: XuanxueAiProductionRuntime;
  readonly completedOrderId: string;
  readonly qimenParent: {
    readonly jobId: string;
    readonly rawOutputHash: string;
    readonly executionId: string;
    readonly inputBundleHash: string;
    readonly conversationScopeRef: string;
    readonly frozenSubject: XuanxueAiProductionOrder["frozenSubject"];
  };
}
const seedRecoverableBacklog = (
  runtime: XuanxueAiProductionRuntime,
): XuanxueAiProductionOrder[] => {
  const orders = Array.from({ length: 70 }, (_, index) =>
    order(
      `aiprod_restart_recovery_${index + 1}`,
      "qimen_professional_answer",
      ["analysis"],
    ));
  for (const candidate of orders) {
    createXuanxueAiProductionOrder(runtime, candidate);
  }
  return orders;
};

const seedHashRepair = (
  runtime: XuanxueAiProductionRuntime,
): XuanxueAiProductionOrder => {
  const repairable = order(
    "aiprod_restart_hash_repair",
    "public_knowledge_article_pipeline",
    ["corpus_research", "article_synthesis", "article_image_generation"],
  );
  const record = createXuanxueAiProductionOrder(runtime, repairable);
  const research = record.stages[0]!;
  const synthesis = record.stages[1]!;
  const result = providerResult({
    providerKind: "gpt-web-chat",
    taskIdentity: {
      labelKey: "bazi_analysis",
      sourceProject: "xuanxue-web",
      taskKind: repairable.productId,
      sourceTaskId: `${repairable.orderId}:corpus_research`,
    },
    promptPackageId: research.material.promptPackageId,
    promptContractId: research.material.promptContractId,
    expectedOutputSchemaRef: research.material.expectedOutputSchemaRef,
    expectedOutputKind: research.material.expectedOutputKind,
    textPrompt: research.material.textPrompt,
    inputRefs: [],
    modelName: null,
    timeoutMs: research.material.timeoutMs,
    maxInputChars: research.material.maxInputChars,
    maxFileCount: research.material.maxFileCount,
    requestedBy: "ai-capability",
    missionId: XUANXUE_AI_PRODUCTION_JOB_ID,
    runId: repairable.orderId,
    roundId: "corpus_research",
  }, 1);
  const bareHash = result.rawOutputHash!.replace(/^sha256:/u, "");
  runtime.store.updateStage({
    ...research,
    status: "completed",
    attemptCount: 1,
    aiFeedResult: {
      ...result,
      rawOutputHash: bareHash,
      providerProof: { ...result.providerProof, outputHash: bareHash },
    },
    rawResponseText: result.rawResponseText ?? null,
    rawOutputHash: bareHash,
    progressPhase: "terminal",
    updatedAt: new Date().toISOString(),
  }, "fixture_legacy_stage_completed");
  runtime.store.updateStage({
    ...synthesis,
    status: "running",
    attemptCount: 1,
    progressPhase: "submitting",
    updatedAt: new Date().toISOString(),
  }, "fixture_dependency_started");
  runtime.store.updateOrder({
    orderId: repairable.orderId,
    status: "failed",
    failureReason:
      "XUANXUE_AI_PRODUCTION_DEPENDENCY_HASH_MISMATCH:corpus_research",
    updatedAt: new Date().toISOString(),
    eventType: "fixture_dependency_hash_failed",
  });
  return repairable;
};

const seedLegacyReview = (
  input: RestartAcceptanceInput,
): XuanxueAiProductionOrder => {
  const legacy: XuanxueAiProductionOrder = {
    ...order(
      "aiprod_restart_legacy_review",
      "qimen_report_followup",
      ["followup"],
    ),
    conversationParent: {
      relation: "same_conversation",
      jobId: input.qimenParent.jobId,
      stageId: "analysis",
      executionId: input.qimenParent.executionId,
      rawOutputHash: input.qimenParent.rawOutputHash,
      inputBundleHash: input.qimenParent.inputBundleHash,
      conversationScopeRef: input.qimenParent.conversationScopeRef,
    },
    frozenSubject: input.qimenParent.frozenSubject,
  };
  const record = createXuanxueAiProductionOrder(input.runtime, legacy);
  input.runtime.store.updateStage({
    ...record.stages[0]!,
    status: "review_required",
    attemptCount: 1,
    progressPhase: "terminal",
    failureReason: "duplicate inputHash in the same round.",
    updatedAt: new Date().toISOString(),
  }, "fixture_legacy_control_plane_review");
  input.runtime.store.updateOrder({
    orderId: legacy.orderId,
    status: "review_required",
    failureReason: "duplicate inputHash in the same round.",
    updatedAt: new Date().toISOString(),
    eventType: "fixture_legacy_control_plane_review",
  });
  return legacy;
};

const seedInvalidCompletedPrefix = (
  runtime: XuanxueAiProductionRuntime,
): XuanxueAiProductionOrder => {
  const invalid = order(
    "aiprod_restart_invalid_completed_prefix",
    "public_knowledge_article_pipeline",
    ["corpus_research", "article_synthesis", "article_image_generation"],
  );
  const record = createXuanxueAiProductionOrder(runtime, invalid);
  const rawResponseText =
    `{"answer":"\uE200filecite\uE202turn0file0\uE201"}`;
  const rawOutputHash = hash(rawResponseText);
  const result = providerResult({
    providerKind: "gpt-web-chat",
    taskIdentity: {
      labelKey: "bazi_analysis",
      sourceProject: "xuanxue-web",
      taskKind: invalid.productId,
      sourceTaskId: `${invalid.orderId}:corpus_research`,
    },
    promptPackageId: record.stages[0]!.material.promptPackageId,
    promptContractId: record.stages[0]!.material.promptContractId,
    expectedOutputSchemaRef:
      record.stages[0]!.material.expectedOutputSchemaRef,
    expectedOutputKind: record.stages[0]!.material.expectedOutputKind,
    textPrompt: record.stages[0]!.material.textPrompt,
    inputRefs: [],
    modelName: null,
    timeoutMs: record.stages[0]!.material.timeoutMs,
    maxInputChars: record.stages[0]!.material.maxInputChars,
    maxFileCount: record.stages[0]!.material.maxFileCount,
    requestedBy: "ai-capability",
    missionId: XUANXUE_AI_PRODUCTION_JOB_ID,
    runId: invalid.orderId,
    roundId: "corpus_research",
  }, 1);
  runtime.store.updateStage({
    ...record.stages[0]!,
    status: "completed",
    attemptCount: 1,
    aiFeedResult: {
      ...result,
      rawResponseText,
      normalizedText: rawResponseText,
      rawOutputHash,
      providerProof: {
        ...result.providerProof,
        outputHash: rawOutputHash,
      },
    },
    rawResponseText,
    rawOutputHash,
    progressPhase: "terminal",
    updatedAt: new Date().toISOString(),
  }, "fixture_invalid_completed_prefix");
  runtime.store.updateStage({
    ...record.stages[1]!,
    status: "running",
    attemptCount: 1,
    progressPhase: "submitting",
    updatedAt: new Date().toISOString(),
  }, "fixture_invalid_prefix_downstream_started");
  runtime.store.updateOrder({
    orderId: invalid.orderId,
    status: "running",
    failureReason: null,
    updatedAt: new Date().toISOString(),
    eventType: "fixture_invalid_prefix_order_running",
  });
  return invalid;
};

const seedForeignLedger = (
  runtime: XuanxueAiProductionRuntime,
): XuanxueAiProductionOrder => {
  const foreign = order(
    "aiprod_restart_foreign_ledger",
    "qimen_professional_answer",
    ["analysis"],
  );
  createXuanxueAiProductionOrder(runtime, foreign);
  const quarantined = runtime.store.quarantineForeignCloudRecoveryOrder(
    foreign.orderId,
    "AI_PRODUCTION_LOCAL_RECOVERY_DEVICE_MISMATCH",
  );
  assert.equal(quarantined.status, "review_required");
  assert.equal(quarantined.stages[0]?.status, "review_required");
  assert.match(
    quarantined.failureReason ?? "",
    /foreign cloud recovery ledger/u,
  );
  return foreign;
};

const seedCloudCancelled = (
  input: RestartAcceptanceInput,
): XuanxueAiProductionOrder => {
  const cancelled = order(
    "aiprod_restart_cloud_cancelled",
    "public_knowledge_article_pipeline",
    ["corpus_research", "article_synthesis", "article_image_generation"],
  );
  const record = createXuanxueAiProductionOrder(
    input.runtime,
    cancelled,
  );
  const completedSource = input.runtime.store
    .readOrder(input.completedOrderId)
    ?.stages[0];
  assert.equal(completedSource?.status, "completed");
  input.runtime.store.updateStage({
    ...record.stages[0]!,
    status: "completed",
    aiFeedResult: completedSource!.aiFeedResult,
    rawResponseText: completedSource!.rawResponseText,
    rawOutputHash: completedSource!.rawOutputHash,
    progressPhase: "terminal",
    updatedAt: new Date().toISOString(),
  }, "fixture_cloud_cancelled_completed_prefix");
  input.runtime.store.updateStage({
    ...record.stages[1]!,
    status: "recovery_pending",
    progressPhase: "waiting_provider",
    failureReason: "waiting before cloud cancellation",
    updatedAt: new Date().toISOString(),
  }, "fixture_cloud_cancelled_pending_stage");
  input.runtime.store.updateOrder({
    orderId: cancelled.orderId,
    status: "recovery_pending",
    failureReason: "waiting before cloud cancellation",
    updatedAt: new Date().toISOString(),
    eventType: "fixture_cloud_cancelled_recovery_pending",
  });
  const settled = input.runtime.store.cancelCloudRecoveryOrder(
    cancelled.orderId,
    "cloud job is terminal cancelled",
  );
  assert.equal(settled.status, "cancelled");
  assert.deepEqual(
    settled.stages.map((stage) => stage.status),
    ["completed", "cancelled", "cancelled"],
    "a cloud-cancelled order must preserve completed evidence and leave restart reconciliation",
  );
  return cancelled;
};

const seedSubmittedContinuation = (
  input: RestartAcceptanceInput,
): {
  readonly order: XuanxueAiProductionOrder;
  readonly executionId: string;
} => {
  const candidate = order(
    "aiprod_restart_submitted_continuation",
    "public_knowledge_article_pipeline",
    ["corpus_research", "article_synthesis", "article_image_generation"],
  );
  const record = createXuanxueAiProductionOrder(
    input.runtime,
    candidate,
  );
  const completedSource = input.runtime.store
    .readOrder(input.completedOrderId)
    ?.stages[0];
  assert.equal(completedSource?.status, "completed");
  assert.ok(completedSource?.aiFeedResult?.providerProof.webChatUrl);
  input.runtime.store.updateStage({
    ...record.stages[0]!,
    status: "completed",
    attemptCount: completedSource!.attemptCount,
    aiFeedResult: completedSource!.aiFeedResult,
    rawResponseText: completedSource!.rawResponseText,
    rawOutputHash: completedSource!.rawOutputHash,
    progressPhase: "terminal",
    updatedAt: new Date().toISOString(),
  }, "fixture_submitted_continuation_parent_completed");
  const executionId =
    `${candidate.orderId}:article_synthesis:restart:7`;
  input.runtime.store.updateStage({
    ...record.stages[1]!,
    executionId,
    status: "waiting_provider",
    attemptCount: 7,
    progressPhase: "waiting_provider",
    updatedAt: new Date().toISOString(),
  }, "fixture_submitted_continuation_waiting_provider");
  input.runtime.store.updateOrder({
    orderId: candidate.orderId,
    status: "running",
    failureReason: null,
    updatedAt: new Date().toISOString(),
    eventType: "fixture_submitted_continuation_running",
  });
  return { order: candidate, executionId };
};

interface RestartFixtures {
  readonly recoverable: XuanxueAiProductionOrder[];
  readonly repairable: XuanxueAiProductionOrder;
  readonly legacy: XuanxueAiProductionOrder;
  readonly invalidPrefix: XuanxueAiProductionOrder;
  readonly foreign: XuanxueAiProductionOrder;
  readonly cancelled: XuanxueAiProductionOrder;
  readonly submittedContinuation: {
    readonly order: XuanxueAiProductionOrder;
    readonly executionId: string;
  };
}

const assertReopenedLedgerIdentity = (
  input: RestartAcceptanceInput,
  reopened: XuanxueAiProductionStore,
  fixtures: RestartFixtures,
): void => {
  assert.equal(
    reopened.readOrder(input.completedOrderId)?.status,
    "completed",
  );
  for (const excluded of [fixtures.foreign, fixtures.cancelled]) {
    assert.equal(
      reopened.listCloudRecoveryOrders().some(
        (record) => record.order.orderId === excluded.orderId,
      ),
      false,
      "foreign-device and cloud-cancelled ledgers must not be polled",
    );
  }
  assert.equal(
    reopened.readOrder(fixtures.cancelled.orderId)?.status,
    "cancelled",
  );
  assert.equal(
    reopened.listRecoverableOrders().length,
    fixtures.recoverable.length + 4,
    "restart discovery must never truncate an offline backlog",
  );
};

const assertReopenedRepairState = (
  reopened: XuanxueAiProductionStore,
  fixtures: RestartFixtures,
): void => {
  const submittedContinuation = reopened.readOrder(
    fixtures.submittedContinuation.order.orderId,
  );
  assert.equal(
    submittedContinuation?.stages[1]?.executionId,
    fixtures.submittedContinuation.executionId,
    "startup repair must preserve an unfinished submitted continuation execution id",
  );
  assert.equal(
    submittedContinuation?.stages[1]?.status,
    "waiting_provider",
    "startup repair must not infer detachment from a missing aggregate result",
  );
  const repaired = reopened.readOrder(fixtures.repairable.orderId);
  assert.equal(repaired?.status, "recovery_pending");
  assert.equal(repaired?.stages[0]?.status, "completed");
  assert.match(repaired?.stages[0]?.rawOutputHash ?? "", /^sha256:/u);
  assert.equal(repaired?.stages[1]?.status, "queued");
  assert.equal(
    reopened.readOrder(fixtures.legacy.orderId)?.status,
    "recovery_pending",
  );
  const repairedInvalid = reopened.readOrder(
    fixtures.invalidPrefix.orderId,
  );
  assert.equal(repairedInvalid?.status, "recovery_pending");
  assert.deepEqual(
    repairedInvalid?.stages.map((stage) => stage.status),
    ["queued", "queued", "queued"],
    "restart must retire an invalid completed prefix and every downstream node",
  );
  assert.match(
    repairedInvalid?.stages[0]?.executionId ?? "",
    /output-integrity-recovery/u,
  );
};

const resumeReopenedLedger = async (
  input: RestartAcceptanceInput,
  reopened: XuanxueAiProductionStore,
  fixtures: RestartFixtures,
): Promise<void> => {
  const resumedRuntime = { ...input.runtime, store: reopened };
  const coordinator = new XuanxueAiProductionCoordinator(resumedRuntime);
  const cloudOrders = reopened.listCloudRecoveryOrders();
  assert.ok(
    fixtures.recoverable.every((candidate) =>
      cloudOrders.some((record) =>
        record.order.orderId === candidate.orderId)),
    "every durable non-terminal order must be discoverable for cloud lease reconciliation",
  );
  const executions = reopened.listRecoverableOrders().map(
    (record) => coordinator.execute(record.order.orderId),
  );
  await Promise.all(executions);
  await coordinator.close();
  assert.ok(fixtures.recoverable.every(
    (candidate) =>
      reopened.readOrder(candidate.orderId)?.status === "completed",
  ), "all persisted offline orders must resume without a 64-order ceiling");
  assert.equal(
    reopened.readOrder(fixtures.repairable.orderId)?.status,
    "completed",
    "a byte-verified legacy hash prefix defect must resume without resubmitting the completed stage",
  );
  assert.equal(
    reopened.readOrder(fixtures.invalidPrefix.orderId)?.status,
    "completed",
  );
  assert.equal(
    reopened.readOrder(fixtures.submittedContinuation.order.orderId)
      ?.status,
    "completed",
  );
  assert.doesNotMatch(
    reopened.readOrder(fixtures.invalidPrefix.orderId)
      ?.result?.stages[0]?.rawResponseText ?? "",
    /filecite/u,
  );
  assert.equal(reopened.listRecoverableOrders().length, 0);
};

const acceptReopenedLedger = async (
  input: RestartAcceptanceInput,
  reopened: XuanxueAiProductionStore,
  fixtures: RestartFixtures,
): Promise<void> => {
  assertReopenedLedgerIdentity(input, reopened, fixtures);
  assertReopenedRepairState(reopened, fixtures);
  await resumeReopenedLedger(input, reopened, fixtures);
};

export const acceptXuanxueRestartRecovery = async (input: RestartAcceptanceInput): Promise<void> => {
  const fixtures = {
    recoverable: seedRecoverableBacklog(input.runtime), repairable: seedHashRepair(input.runtime),
    legacy: seedLegacyReview(input), invalidPrefix: seedInvalidCompletedPrefix(input.runtime),
    foreign: seedForeignLedger(input.runtime), cancelled: seedCloudCancelled(input),
    submittedContinuation: seedSubmittedContinuation(input),
  };
  input.runtime.store.close();
  const reopened = new XuanxueAiProductionStore(input.dataDir);
  await acceptReopenedLedger(input, reopened, fixtures); reopened.close();
};
