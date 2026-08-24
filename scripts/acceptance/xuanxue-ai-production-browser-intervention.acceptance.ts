import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createXuanxueAiProductionOrder,
  XuanxueAiProductionCoordinator,
  XuanxueAiProductionStore,
  type XuanxueAiProductionRuntime,
} from "../../src/plugins/xuanxue-ai-production/index.js";
import { FixtureGateway, hash, order } from "./xuanxue-ai-production-fixture.js";

const waitFor = async (predicate: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("XUANXUE_INTERVENTION_ACCEPTANCE_TIMEOUT");
};

const dataDir = await mkdtemp(
  path.join(tmpdir(), "xuanxue-intervention-acceptance-"),
);
try {
  const gateway = new FixtureGateway();
  const store = new XuanxueAiProductionStore(dataDir);
  const runtime: XuanxueAiProductionRuntime = {
    candidateHash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    dataDir,
    aiInputGateway: gateway,
    store,
  };
  const coordinator = new XuanxueAiProductionCoordinator(runtime);

  const pausedOrder = order(
    "xuanxue_intervention_pause_before_feed",
    "qimen_professional_answer",
    ["analysis"],
  );
  createXuanxueAiProductionOrder(runtime, pausedOrder);
  const pauseRequested = store.requestIntervention("pause", {
    orderId: pausedOrder.orderId,
    expectedRevision: 0,
    reason: "operator needs the computer",
    requestId: "pause-1",
  });
  assert.equal(pauseRequested.state, "pause_requested");
  await coordinator.execute(pausedOrder.orderId);
  assert.equal(store.readIntervention(pausedOrder.orderId).state, "paused");
  assert.equal(gateway.requests.length, 0, "pause before feed must issue no AI command");
  assert.throws(
    () => store.requestIntervention("cancel", {
      orderId: pausedOrder.orderId,
      expectedRevision: 0,
      reason: "stale operator view",
      requestId: "stale-1",
    }),
    /STALE_REVISION/u,
  );
  assert.equal(store.readIntervention(pausedOrder.orderId).revision, 1);

  const resumed = store.resumeIntervention({
    orderId: pausedOrder.orderId,
    expectedRevision: 1,
    reason: "operator released the order",
    requestId: "resume-1",
  });
  assert.equal(resumed.state, "running");
  assert.equal((await coordinator.execute(pausedOrder.orderId)).status, "completed");
  assert.equal(gateway.requests.length, 1);

  const cancelledOrder = order(
    "xuanxue_intervention_cancel_before_feed",
    "qimen_professional_answer",
    ["analysis"],
  );
  createXuanxueAiProductionOrder(runtime, cancelledOrder);
  store.requestIntervention("cancel", {
    orderId: cancelledOrder.orderId,
    expectedRevision: 0,
    reason: "caller withdrew the whole order",
    requestId: "cancel-1",
  });
  const cancelled = await coordinator.execute(cancelledOrder.orderId);
  assert.equal(cancelled.status, "cancelled");
  assert.equal(store.readIntervention(cancelledOrder.orderId).state, "cancelled");
  assert.equal(gateway.requests.length, 1, "cancel before feed must issue no new AI command");

  const takeoverOrder = order(
    "xuanxue_intervention_takeover_after_checkpoint",
    "qimen_professional_answer",
    ["analysis"],
  );
  createXuanxueAiProductionOrder(runtime, takeoverOrder);
  gateway.holdRequest("qimen_professional_answer", "analysis");
  const executing = coordinator.execute(takeoverOrder.orderId);
  await waitFor(() => gateway.started.some(
    (sourceTaskId) => sourceTaskId.startsWith(`${takeoverOrder.orderId}:`),
  ));
  store.requestIntervention("takeover", {
    orderId: takeoverOrder.orderId,
    expectedRevision: 0,
    reason: "operator will inspect the provider checkpoint",
    requestId: "takeover-1",
  });
  gateway.releaseRequest();
  const stopped = await executing;
  assert.equal(stopped.status, "recovery_pending");
  assert.equal(store.readIntervention(takeoverOrder.orderId).state, "taken_over");
  assert.equal(
    store.readIntervention(takeoverOrder.orderId).lastSafeCheckpoint,
    "after-response-checkpoint:analysis",
  );
  const requestCountAfterCheckpoint = gateway.requests.length;
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  store.resumeIntervention({
    orderId: takeoverOrder.orderId,
    expectedRevision: 1,
    reason: "continue from the persisted response",
    requestId: "resume-2",
  });
  assert.equal((await coordinator.execute(takeoverOrder.orderId)).status, "completed");
  assert.equal(
    gateway.requests.length,
    requestCountAfterCheckpoint,
    "resume after raw checkpoint must not submit the completed stage again",
  );

  const cloudCancelledOrder = order(
    "xuanxue_cloud_cancel_preserves_completed_stage",
    "qimen_professional_answer",
    ["analysis"],
  );
  createXuanxueAiProductionOrder(runtime, cloudCancelledOrder);
  const cloudCompleted = await coordinator.execute(cloudCancelledOrder.orderId);
  assert.equal(cloudCompleted.status, "completed");
  const completedStage = cloudCompleted.stages[0]!;
  store.updateOrder({
    orderId: cloudCancelledOrder.orderId,
    status: "recovery_pending",
    result: null,
    failureReason: "fixture recovery pending",
    updatedAt: new Date().toISOString(),
    eventType: "fixture_cloud_recovery_pending",
  });
  const cloudCancelled = store.cancelCloudRecoveryOrder(
    cloudCancelledOrder.orderId,
    "website cancellation",
  );
  assert.equal(cloudCancelled.status, "cancelled");
  assert.deepEqual(
    cloudCancelled.stages[0],
    completedStage,
    "a cloud-cancelled order must preserve completed evidence and leave restart reconciliation",
  );

  const seoOrder = order(
    "xuanxue_intervention_seo_after_stage_one",
    "public_knowledge_article_pipeline",
    ["corpus_research", "article_synthesis", "article_image_generation"],
  );
  seoOrder.materials[0]!.inputRefs = [{
    id: "seo-recovery-corpus", kind: "public_knowledge_ready_corpus",
    summary: "governed SEO recovery corpus", filePath: "/fixture/seo-recovery.md",
    fileName: "00-本领域READY古籍全集.md", mimeType: "text/markdown; charset=utf-8",
    sha256: hash("seo-recovery-corpus"), byteCount: 27,
  }];
  createXuanxueAiProductionOrder(runtime, seoOrder);
  gateway.holdRequest("public_knowledge_article_pipeline", "corpus_research");
  const seoExecuting = coordinator.execute(seoOrder.orderId);
  await waitFor(() => gateway.started.some(
    (sourceTaskId) => sourceTaskId.startsWith(`${seoOrder.orderId}:corpus_research`),
  ));
  store.requestIntervention("takeover", {
    orderId: seoOrder.orderId, expectedRevision: 0,
    reason: "simulate website process crash after SEO stage one response",
    requestId: "seo-takeover-1",
  });
  gateway.releaseRequest();
  const seoStopped = await seoExecuting;
  assert.equal(seoStopped.status, "recovery_pending");
  assert.equal(seoStopped.stages[0]?.stageId, "corpus_research");
  assert.ok(seoStopped.stages[0]?.rawOutputHash);
  const corpusSubmissionsBeforeResume = gateway.requests.filter(
    (request) => request.taskIdentity.sourceTaskId.startsWith(`${seoOrder.orderId}:corpus_research`),
  ).length;
  store.resumeIntervention({
    orderId: seoOrder.orderId, expectedRevision: 1,
    reason: "resume from durable SEO stage one response checkpoint",
    requestId: "seo-resume-1",
  });
  gateway.holdRequest("public_knowledge_article_pipeline", "article_synthesis");
  const seoRecoveryExecution = coordinator.execute(seoOrder.orderId);
  await waitFor(() => gateway.started.some(
    (sourceTaskId) => sourceTaskId.startsWith(`${seoOrder.orderId}:article_synthesis`),
  ));
  store.requestIntervention("takeover", {
    orderId: seoOrder.orderId, expectedRevision: 2,
    reason: "stop after proving durable stage one recovery identity",
    requestId: "seo-takeover-2",
  });
  gateway.releaseRequest();
  const seoRecovered = await seoRecoveryExecution;
  assert.equal(seoRecovered.status, "recovery_pending");
  assert.equal(seoRecovered.stages[0]?.status, "completed");
  assert.equal(seoRecovered.stages[1]?.status, "completed");
  const corpusSubmissionsAfterResume = gateway.requests.filter(
    (request) => request.taskIdentity.sourceTaskId.startsWith(`${seoOrder.orderId}:corpus_research`),
  ).length;
  assert.equal(corpusSubmissionsBeforeResume, 1);
  assert.equal(corpusSubmissionsAfterResume, corpusSubmissionsBeforeResume);

  const nonSeoSubmissionsAfterResume = gateway.requests.filter(
    (request) => !request.taskIdentity.sourceTaskId.startsWith(`${seoOrder.orderId}:`),
  ).length;
  const faultReceipt = {
    schema_version: "product-execution-agent-fault-receipt.v1",
    F04: {
      completed_stage_id: "corpus_research",
      submissions_before_resume: corpusSubmissionsBeforeResume,
      submissions_after_resume: corpusSubmissionsAfterResume,
      duplicate_submit_count: corpusSubmissionsAfterResume - corpusSubmissionsBeforeResume,
      recovery_status: seoRecovered.status,
    },
    F05: {
      checkpoint: "after-response-checkpoint:analysis",
      submissions_before_resume: requestCountAfterCheckpoint,
      submissions_after_resume: nonSeoSubmissionsAfterResume,
      duplicate_submit_count: nonSeoSubmissionsAfterResume - requestCountAfterCheckpoint,
      terminal_status: "completed",
    },
  };

  await coordinator.close();
  store.close();
  const reopened = new XuanxueAiProductionStore(dataDir);
  assert.equal(reopened.readOrder(cloudCancelledOrder.orderId)?.status, "cancelled");
  assert.equal(
    reopened.listCloudRecoveryOrders().some((record) =>
      record.order.orderId === cloudCancelledOrder.orderId),
    false,
  );
  reopened.close();
  console.log(`PRODUCT_EXECUTION_AGENT_FAULT_RECEIPT=${JSON.stringify(faultReceipt)}`);
  console.log("XUANXUE_AI_PRODUCTION_BROWSER_INTERVENTION_ACCEPTANCE_PASS");
} finally {
  await rm(dataDir, { recursive: true, force: true });
}
