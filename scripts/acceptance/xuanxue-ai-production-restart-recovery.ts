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
}

const markSameJobCloudRecoveryPending = (
  runtime: XuanxueAiProductionRuntime,
  initial: ReturnType<typeof createXuanxueAiProductionOrder>,
): void => {
  runtime.store.updateStage({
    ...initial.stages[0]!,
    status: "recovery_pending",
    attemptCount: 1,
    failureReason: "fixture recoverable transport interruption",
    progressPhase: "recovery_pending",
    updatedAt: "2026-08-21T20:00:30.000Z",
  }, "fixture_same_job_recovery_pending");
  runtime.store.updateOrder({
    orderId: initial.order.orderId,
    status: "recovery_pending",
    failureReason: "fixture recoverable transport interruption",
    updatedAt: "2026-08-21T20:00:30.000Z",
    eventType: "fixture_same_job_recovery_pending",
  });
};

const acceptSameJobCloudRecoveryRebind = (
  runtime: XuanxueAiProductionRuntime,
): void => {
  const candidate = order(
    "aiprod_same_job_cloud_recovery_rebind",
    "qimen_professional_answer",
    ["analysis"],
  );
  const firstIdentity = {
    jobId: candidate.orderId,
    attemptId: "attempt-1",
    requiredDeviceId: "fixture-device",
    leaseVersion: 1,
    executionFenceHash: hash("execution-fence-1"),
    contractManifestHash: hash("cloud-contract-manifest"),
    serverNow: "2026-08-21T20:00:00.000Z",
    leaseExpiresAt: "2026-08-21T20:01:30.000Z",
  };
  const firstOrder = { ...candidate, cloudExecutionIdentity: firstIdentity };
  const initial = createXuanxueAiProductionOrder(runtime, firstOrder);
  markSameJobCloudRecoveryPending(runtime, initial);
  const reboundOrder = {
    ...candidate,
    cloudExecutionIdentity: {
      ...firstIdentity,
      attemptId: "attempt-2",
      leaseVersion: 2,
      executionFenceHash: hash("execution-fence-2"),
      serverNow: "2026-08-21T20:02:00.000Z",
      leaseExpiresAt: "2026-08-21T20:03:30.000Z",
    },
  };
  const rebound = createXuanxueAiProductionOrder(runtime, reboundOrder);
  assert.equal(rebound.order.cloudExecutionIdentity?.attemptId, "attempt-2");
  assert.equal(rebound.order.cloudExecutionIdentity?.leaseVersion, 2);
  assert.equal(rebound.status, "recovery_pending");
  assert.equal(rebound.stages[0]?.attemptCount, 1);
  assert.equal(rebound.stages[0]?.status, "recovery_pending");
  assert.throws(
    () => createXuanxueAiProductionOrder(runtime, firstOrder),
    /XUANXUE_AI_PRODUCTION_ORDER_IDENTITY_CONFLICT/u,
    "a superseded cloud attempt and fence must fail closed",
  );
  assert.throws(
    () => createXuanxueAiProductionOrder(runtime, {
      ...reboundOrder,
      requestHash: hash("mutated-business-request"),
      cloudExecutionIdentity: {
        ...reboundOrder.cloudExecutionIdentity,
        attemptId: "attempt-3",
        leaseVersion: 3,
        executionFenceHash: hash("execution-fence-3"),
      },
    }),
    /XUANXUE_AI_PRODUCTION_ORDER_IDENTITY_CONFLICT/u,
    "a new lease must not authorize any business-order drift",
  );
  runtime.store.cancelCloudRecoveryOrder(
    candidate.orderId,
    "fixture recovery rebind acceptance settled",
  );
};
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
    fixtures.recoverable.length + 1,
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
  const repairedInvalid = reopened.readOrder(
    fixtures.invalidPrefix.orderId,
  );
  assert.equal(repairedInvalid?.status, "review_required");
  assert.deepEqual(
    repairedInvalid?.stages.map((stage) => stage.status),
    ["review_required", "running", "queued"],
    "restart must preserve the invalid prefix and stop the order for review",
  );
  assert.match(
    repairedInvalid?.stages[0]?.rawResponseText ?? "",
    /filecite/u,
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
    reopened.readOrder(fixtures.invalidPrefix.orderId)?.status,
    "review_required",
  );
  assert.equal(
    reopened.readOrder(fixtures.submittedContinuation.order.orderId)
      ?.status,
    "completed",
  );
  assert.match(
    reopened.readOrder(fixtures.invalidPrefix.orderId)
      ?.stages[0]?.rawResponseText ?? "",
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
  acceptSameJobCloudRecoveryRebind(input.runtime);
  const fixtures = {
    recoverable: seedRecoverableBacklog(input.runtime),
    invalidPrefix: seedInvalidCompletedPrefix(input.runtime),
    foreign: seedForeignLedger(input.runtime), cancelled: seedCloudCancelled(input),
    submittedContinuation: seedSubmittedContinuation(input),
  };
  input.runtime.store.close();
  const reopened = new XuanxueAiProductionStore(input.dataDir);
  await acceptReopenedLedger(input, reopened, fixtures); reopened.close();
};
