import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  createXuanxueAiProductionOrder,
  executeXuanxueAiProductionOrder,
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
} from "./xuanxue-ai-production-fixture.js";
import {
  acceptXuanxueParentRecovery,
} from "./xuanxue-ai-production-parent-recovery.js";
import {
  acceptXuanxueRestartRecovery,
} from "./xuanxue-ai-production-restart-recovery.js";
import {
  acceptXuanxueOrderGraphs,
} from "./xuanxue-ai-production-order-graph-acceptance.js";

const dataDir = await mkdtemp(
  path.join(tmpdir(), "xuanxue-ai-production-acceptance-"),
);
try {
  const gateway = new FixtureGateway();
  const store = new XuanxueAiProductionStore(dataDir);
  const runtime: XuanxueAiProductionRuntime = {
    dataDir,
    aiInputGateway: gateway,
    store,
  };

  const {
    hehun,
    qimenFollowupParent,
    qimenFollowupParentFinal,
  } = await acceptXuanxueOrderGraphs({ runtime, gateway });
  gateway.bareOutputHashes = true;
  const canonicalHashBoundary = order(
    "aiprod_canonical_hash_boundary",
    "bazi_canonical_base_interpretation",
    ["base_interpretation"],
  );
  createXuanxueAiProductionOrder(runtime, canonicalHashBoundary);
  const canonicalHashResult = await executeXuanxueAiProductionOrder(
    runtime,
    canonicalHashBoundary.orderId,
  );
  gateway.bareOutputHashes = false;
  assert.equal(canonicalHashResult.status, "completed");
  assert.ok(canonicalHashResult.stages.every((stage) =>
    /^sha256:[a-f0-9]{64}$/u.test(stage.rawOutputHash ?? "")));

  const payment = order(
    "aiprod_payment_observation",
    "payment_screenshot_observation",
    ["payment_screenshot_observation"],
  );
  createXuanxueAiProductionOrder(runtime, payment);
  assert.equal(
    (await executeXuanxueAiProductionOrder(runtime, payment.orderId)).status,
    "completed",
  );

  const publicArticle = order(
    "aiprod_public_article",
    "public_knowledge_article_pipeline",
    ["corpus_research", "article_synthesis"],
  );
  createXuanxueAiProductionOrder(runtime, publicArticle);
  const publicResult = await executeXuanxueAiProductionOrder(
    runtime,
    publicArticle.orderId,
  );
  assert.equal(publicResult.status, "completed");
  const publicArticleRequest = gateway.requests.find(
    (request) =>
      request.taskIdentity.taskKind === "public_knowledge_article_pipeline"
      && request.roundId === "article_synthesis",
  );
  const publicResearchStage = publicResult.stages.find(
    (stage) => stage.stageId === "corpus_research",
  );
  const publicArticleStage = publicResult.stages.find(
    (stage) => stage.stageId === "article_synthesis",
  );
  assert.equal(
    publicArticleRequest?.providerContinuationRef?.priorTaskId,
    `${XUANXUE_AI_PRODUCTION_JOB_ID}:`
      + `${publicArticle.orderId}:corpus_research`,
  );
  assert.equal(
    publicArticleStage?.aiFeedResult?.providerProof.webChatUrl,
    publicResearchStage?.aiFeedResult?.providerProof.webChatUrl,
  );

  const transientOrder = order(
    "aiprod_transient_stage_retry",
    "qimen_professional_answer",
    ["analysis"],
  );
  createXuanxueAiProductionOrder(runtime, transientOrder);
  gateway.transientFailures.set(
    `${transientOrder.orderId}:analysis`,
    1,
  );
  const beforeTransient = gateway.requests.length;
  const transientResult = await executeXuanxueAiProductionOrder(
    runtime,
    transientOrder.orderId,
  );
  assert.equal(transientResult.status, "completed");
  assert.equal(
    gateway.requests.length - beforeTransient,
    2,
    "a temporary stage failure must retry under the live order execution",
  );
  const transientExecutionIds = gateway.executionIds.slice(
    beforeTransient,
  );
  assert.equal(
    new Set(transientExecutionIds).size,
    1,
    "a recoverable transport failure must retain one execution id so a captured turn can never be resubmitted",
  );
  assert.equal(
    gateway.supersededExecutionIds.slice(beforeTransient)
      .filter(Boolean).length,
    0,
    "a recoverable transport failure must not retire or replace its durable gateway owner",
  );

  const monitoredOrder = order(
    "aiprod_submitted_monitor_interference",
    "qimen_professional_answer",
    ["analysis"],
  );
  createXuanxueAiProductionOrder(runtime, monitoredOrder);
  gateway.submittedReviewFailures.set(
    `${monitoredOrder.orderId}:analysis`,
    1,
  );
  const beforeMonitorInterference = gateway.requests.length;
  const monitoredResult = await executeXuanxueAiProductionOrder(
    runtime,
    monitoredOrder.orderId,
  );
  assert.equal(monitoredResult.status, "completed");
  assert.equal(
    new Set(
      gateway.executionIds.slice(beforeMonitorInterference),
    ).size,
    1,
    "a submitted turn interrupted by a second physical monitor tab must resume the same execution without another logical submission",
  );
  assert.equal(
    gateway.supersededExecutionIds.slice(beforeMonitorInterference)
      .filter(Boolean).length,
    0,
  );

  const contaminatedNaming = order(
    "aiprod_contaminated_naming",
    "naming_from_existing_bazi_report",
    ["naming_author"],
  );
  const contaminatedSource =
    `${contaminatedNaming.orderId}:naming_author`;
  gateway.contaminatedResponses.set(contaminatedSource, 1);
  const beforeContaminated = gateway.requests.length;
  createXuanxueAiProductionOrder(runtime, contaminatedNaming);
  const contaminatedRecovered =
    await executeXuanxueAiProductionOrder(
      runtime,
      contaminatedNaming.orderId,
    );
  assert.equal(contaminatedRecovered.status, "completed");
  assert.equal(
    gateway.requests.length - beforeContaminated,
    2,
    "provider citation residue must discard the response and restart once",
  );
  const contaminationExecutionIds = gateway.executionIds.slice(
    beforeContaminated,
  );
  assert.equal(new Set(contaminationExecutionIds).size, 2);
  assert.equal(
    gateway.supersededExecutionIds.at(-1),
    contaminationExecutionIds[0],
  );
  assert.doesNotMatch(
    contaminatedRecovered.result?.stages[0]?.rawResponseText ?? "",
    /filecite/u,
  );
  assert.equal(transientResult.stages[0]?.attemptCount, 2);

  const parallelOrders = Array.from({ length: 11 }, (_, index) =>
    order(
      `aiprod_qimen_${index + 1}`,
      "qimen_professional_answer",
      ["analysis"],
    ));
  for (const candidate of parallelOrders) {
    createXuanxueAiProductionOrder(runtime, candidate);
  }
  const coordinator = new XuanxueAiProductionCoordinator(runtime);
  gateway.holdQimen = true;
  const executions = parallelOrders.map((candidate) =>
    coordinator.execute(candidate.orderId));
  await new Promise<void>((resolve) => setTimeout(resolve, 100));
  assert.equal(
    gateway.started.filter((value) =>
      /aiprod_qimen_\d+:analysis$/u.test(value)).length,
    10,
    "the eleventh order must remain outside the ten-order production window",
  );
  assert.equal(gateway.maxActive, 10);
  gateway.releaseQimen();
  const completed = await Promise.all(
    executions,
  );
  assert.ok(completed.every((record) => record.status === "completed"));
  await coordinator.close();

  await acceptXuanxueParentRecovery({
    runtime,
    gateway,
    qimenParent: qimenFollowupParent,
    qimenParentFinal: qimenFollowupParentFinal,
  });

  const replay = createXuanxueAiProductionOrder(runtime, hehun);
  assert.equal(replay.order.orderId, hehun.orderId);
  assert.throws(
    () => createXuanxueAiProductionOrder(runtime, {
      ...hehun,
      requestHash: hash(randomUUID()),
    }),
    /ORDER_IDENTITY_CONFLICT/u,
  );

  await acceptXuanxueRestartRecovery({
    dataDir,
    gateway,
    runtime,
    completedOrderId: hehun.orderId,
    qimenParent: {
      jobId: qimenFollowupParent.orderId,
      rawOutputHash: qimenFollowupParentFinal.rawOutputHash!,
    },
  });
  process.stdout.write(
    "[ACCEPTANCE] xuanxue-ai-production PASS: fixed single-conversation graphs, contaminated-output restart, exact-parent FIFO, parent-conversation replay from cloud material, seeded checkpoints, idempotency and cloud-reconciled SQLite restart recovery.\n",
  );
} finally {
  await rm(dataDir, { recursive: true, force: true });
}
