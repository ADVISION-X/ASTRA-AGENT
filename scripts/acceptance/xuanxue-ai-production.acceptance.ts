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
  const legacyBazi = order(
    "aiprod_legacy_bazi",
    "bazi_ai_full_analysis",
    ["base_interpretation", "question_analysis"],
  );
  createXuanxueAiProductionOrder(runtime, legacyBazi);
  const legacyResult = await executeXuanxueAiProductionOrder(
    runtime,
    legacyBazi.orderId,
  );
  const legacyBase = legacyResult.stages.find(
    (stage) => stage.stageId === "base_interpretation",
  );
  assert.ok(
    legacyBase?.rawResponseText
    && legacyBase.rawOutputHash
    && legacyBase.aiFeedResult,
  );
  const seededBazi: XuanxueAiProductionOrder = {
    ...order(
      "aiprod_seeded_bazi",
      "bazi_ai_full_analysis",
      ["base_interpretation", "question_analysis"],
    ),
    seededStages: [{
      stageId: "base_interpretation",
      executionId: legacyBase.executionId,
      rawResponseText: legacyBase.rawResponseText,
      rawOutputHash: legacyBase.rawOutputHash,
      providerProof: legacyBase.aiFeedResult.providerProof,
      transportWarnings:
        legacyBase.aiFeedResult.transportWarnings ?? [],
    }],
  };
  const beforeSeeded = gateway.requests.length;
  createXuanxueAiProductionOrder(runtime, seededBazi);
  const seededResult = await executeXuanxueAiProductionOrder(
    runtime,
    seededBazi.orderId,
  );
  assert.equal(seededResult.status, "completed");
  assert.equal(
    gateway.requests.length - beforeSeeded,
    1,
    "a seeded base response must not be submitted to GPT again",
  );
  assert.equal(
    gateway.requests.at(-1)?.providerContinuationRef?.priorTaskId,
    legacyBase.executionId,
  );
  const invalidSeedText =
    `{"answer":"\uE200filecite\uE202turn0file0\uE201"}`;
  const invalidSeededBazi: XuanxueAiProductionOrder = {
    ...order(
      "aiprod_invalid_seeded_output",
      "bazi_ai_full_analysis",
      ["base_interpretation", "question_analysis"],
    ),
    seededStages: [{
      ...seededBazi.seededStages[0]!,
      rawResponseText: invalidSeedText,
      rawOutputHash: hash(invalidSeedText),
      providerProof: {
        ...seededBazi.seededStages[0]!.providerProof,
        outputHash: hash(invalidSeedText),
      },
    }],
  };
  const beforeInvalidSeed = gateway.requests.length;
  const invalidSeedRecord = createXuanxueAiProductionOrder(
    runtime,
    invalidSeededBazi,
  );
  assert.equal(
    invalidSeedRecord.stages[0]?.status,
    "recovery_pending",
    "provider-polluted seeded output must never enter a completed stage",
  );
  const recoveredInvalidSeed = await executeXuanxueAiProductionOrder(
    runtime,
    invalidSeededBazi.orderId,
  );
  assert.equal(recoveredInvalidSeed.status, "completed");
  assert.equal(
    gateway.requests.length - beforeInvalidSeed,
    2,
    "polluted seed must replay the first stage before its continuation",
  );
  assert.doesNotMatch(
    recoveredInvalidSeed.result?.stages[0]?.rawResponseText ?? "",
    /filecite/u,
  );
  const providerFailureText = "消息流中的错误 重试";
  const failedSeededBazi: XuanxueAiProductionOrder = {
    ...order(
      "aiprod_provider_failure_seed",
      "bazi_ai_full_analysis",
      ["base_interpretation", "question_analysis"],
    ),
    seededStages: [{
      ...seededBazi.seededStages[0]!,
      rawResponseText: providerFailureText,
      rawOutputHash: hash(providerFailureText),
      providerProof: {
        ...seededBazi.seededStages[0]!.providerProof,
        outputHash: hash(providerFailureText),
      },
    }],
  };
  const beforeFailedSeed = gateway.requests.length;
  const failedSeedRecord = createXuanxueAiProductionOrder(
    runtime,
    failedSeededBazi,
  );
  assert.equal(failedSeedRecord.stages[0]?.status, "recovery_pending");
  assert.equal(
    (await executeXuanxueAiProductionOrder(
      runtime,
      failedSeededBazi.orderId,
    )).status,
    "completed",
  );
  assert.equal(gateway.requests.length - beforeFailedSeed, 2);

  const staleSeededParent: XuanxueAiProductionOrder = {
    ...order(
      "aiprod_stale_seeded_parent",
      "bazi_ai_full_analysis",
      ["base_interpretation", "question_analysis"],
    ),
    seededStages: seededBazi.seededStages,
  };
  gateway.continuationFailures.set(
    `${staleSeededParent.orderId}:question_analysis`,
    1,
  );
  const beforeGraphRebuild = gateway.requests.length;
  createXuanxueAiProductionOrder(runtime, staleSeededParent);
  const rebuiltGraph = await executeXuanxueAiProductionOrder(
    runtime,
    staleSeededParent.orderId,
  );
  assert.equal(rebuiltGraph.status, "completed");
  assert.equal(
    gateway.requests.length - beforeGraphRebuild,
    3,
    "lost same-order parent must fail once, replay stage one, then continue",
  );
  assert.equal(
    new Set(rebuiltGraph.stages.map(
      (stage) => stage.aiFeedResult?.providerProof.webChatUrl,
    )).size,
    1,
    "the rebuilt graph must finish inside one newly rebuilt conversation",
  );
  assert.match(
    rebuiltGraph.stages[0]?.executionId ?? "",
    /conversation-graph-rebuild/u,
  );
  assert.ok(
    rebuiltGraph.stages.every((stage) =>
      stage.supersededExecutionId),
    "every rebuilt graph node must retain the superseded execution id",
  );
  assert.throws(
    () => createXuanxueAiProductionOrder(runtime, {
      ...order(
        "aiprod_invalid_seed_prefix",
        "bazi_ai_full_analysis",
        ["base_interpretation", "question_analysis"],
      ),
      seededStages: [{
        ...seededBazi.seededStages[0]!,
        stageId: "question_analysis",
      }],
    }),
    /SEEDED_STAGE_PROFILE_INVALID/u,
  );
  assert.throws(
    () => createXuanxueAiProductionOrder(runtime, {
      ...order(
        "aiprod_invalid_seed_hash",
        "bazi_ai_full_analysis",
        ["base_interpretation", "question_analysis"],
      ),
      seededStages: [{
        ...seededBazi.seededStages[0]!,
        rawResponseText: "tampered",
      }],
    }),
    /SEEDED_STAGE_PROOF_INVALID/u,
  );

  gateway.bareOutputHashes = true;
  const canonicalHashBoundary = order(
    "aiprod_canonical_hash_boundary",
    "bazi_ai_full_analysis",
    ["base_interpretation", "question_analysis"],
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
