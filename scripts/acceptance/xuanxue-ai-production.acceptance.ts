import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
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
import { createMediaProcessingAbilityGroupFromFilesystem } from "../../src/capabilities/media-processing/index.js";
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
import { acceptXuanxueV1Migration } from "./xuanxue-ai-production-v1-migration.js";

const dataDir = await mkdtemp(
  path.join(tmpdir(), "xuanxue-ai-production-acceptance-"),
);
try {
  await acceptXuanxueV1Migration(dataDir);
  const generatedDirectory = path.join(dataDir, "runtime-data", "ai-input-gateway", "generated-images");
  await mkdir(generatedDirectory, { recursive: true });
  const generatedImagePath = path.join(generatedDirectory, "fixture-generated.png");
  const sharp = (await import("sharp")).default;
  await sharp({
    create: { width: 1400, height: 800, channels: 3, background: { r: 200, g: 181, b: 138 } },
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
    dataDir,
    aiInputGateway: gateway,
    mediaProcessing: createMediaProcessingAbilityGroupFromFilesystem({ dataDir }),
    store,
  };

  const {
    hehun,
    qimenFollowupParent,
    qimenFollowupParentFinal,
  } = await acceptXuanxueOrderGraphs({ runtime, gateway });
  const invalidSeededTopology = order(
    "aiprod_seeded_without_topology_proof",
    "qimen_professional_answer",
    ["analysis"],
  );
  invalidSeededTopology.seededStages = [{
    stageId: "analysis",
    executionId: qimenFollowupParentFinal.executionId,
    rawResponseText: qimenFollowupParentFinal.rawResponseText!,
    rawOutputHash: qimenFollowupParentFinal.rawOutputHash!,
    providerProof: {
      ...qimenFollowupParentFinal.aiFeedResult!.providerProof,
      freshConversationProof: null,
    },
    transportWarnings: [],
  }];
  assert.throws(
    () => createXuanxueAiProductionOrder(runtime, invalidSeededTopology),
    /SEEDED_STAGE_PROOF_INVALID/u,
    "a seeded completion without its exact conversation topology must fail closed",
  );
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

  const reflection = order(
    "aiprod_scheduled_quality_reflection",
    "scheduled_quality_reflection",
    ["scheduled_quality_reflection"],
  );
  createXuanxueAiProductionOrder(runtime, reflection);
  const reflectionResult = await executeXuanxueAiProductionOrder(
    runtime,
    reflection.orderId,
  );
  const reflectionRequest = gateway.requests.find(
    (request) => request.taskIdentity.taskKind === "scheduled_quality_reflection",
  );
  assert.equal(reflectionResult.status, "completed");
  assert.equal(reflection.conversationParent, null);
  assert.equal(reflectionRequest?.providerContinuationRef, undefined);
  assert.equal(reflectionResult.stages.length, 1);

  const publicArticle = order(
    "aiprod_public_article",
    "public_knowledge_article_pipeline",
    ["corpus_research", "article_synthesis", "article_image_generation"],
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
  const publicImageStage = publicResult.stages.find(
    (stage) => stage.stageId === "article_image_generation",
  );
  assert.equal(
    publicArticleRequest?.providerContinuationRef?.priorTaskId,
    `${XUANXUE_AI_PRODUCTION_JOB_ID}:`
      + `${publicArticle.orderId}:corpus_research`,
  );
  assert.equal(
    publicArticleRequest?.maxFileCount,
    publicArticle.materials.find(
      (material) => material.stageId === "article_synthesis",
    )!.maxFileCount + 1,
    "one verified parent attachment must expand the frozen material file limit exactly once",
  );
  assert.equal(
    publicArticleStage?.aiFeedResult?.providerProof.webChatUrl,
    publicResearchStage?.aiFeedResult?.providerProof.webChatUrl,
  );
  assert.equal(publicImageStage?.aiFeedResult?.outputKind, "generated_image");
  assert.equal(publicImageStage?.aiFeedResult?.outputArtifacts[0]?.width, 1200);
  assert.equal(publicImageStage?.aiFeedResult?.outputArtifacts[0]?.height, 630);
  const publicKnowledgeRedlinePreset = "public-knowledge-redline-check";
  assert.ok(
    publicImageStage?.aiFeedResult?.providerProof.outputRefs.some(
      (ref) => ref.startsWith("safety-proof:"),
    ),
    `${publicKnowledgeRedlinePreset} must bind a safety proof to the image stage`,
  );
  assert.equal(
    publicImageStage?.aiFeedResult?.providerProof.webChatUrl,
    publicArticleStage?.aiFeedResult?.providerProof.webChatUrl,
  );

  const terminalAttachmentOrder = order(
    "aiprod_terminal_attachment_no_reentry",
    "qimen_professional_answer",
    ["analysis"],
  );
  terminalAttachmentOrder.materials[0]!.inputRefs = [{
    id: "terminal-attachment-fixture",
    kind: "package_manifest_json",
    summary: "terminal attachment transport acceptance fixture",
    filePath: "/fixture/terminal-attachment-fixture.json",
    fileName: "terminal-attachment-fixture.json",
    mimeType: "application/json",
    sha256: hash("terminal-attachment-fixture"),
    byteCount: 27,
  }];
  const terminalAttachmentGateway = new FixtureGateway();
  const terminalAttachmentStore = new XuanxueAiProductionStore(
    path.join(dataDir, "terminal-attachment-no-reentry"),
  );
  const terminalAttachmentRuntime: XuanxueAiProductionRuntime = {
    ...runtime,
    aiInputGateway: terminalAttachmentGateway,
    store: terminalAttachmentStore,
  };
  createXuanxueAiProductionOrder(
    terminalAttachmentRuntime,
    terminalAttachmentOrder,
  );
  terminalAttachmentGateway.faults.terminalAttachment.set(
    `${terminalAttachmentOrder.orderId}:analysis`,
    1,
  );
  const terminalAttachmentGatewayCallCount =
    terminalAttachmentGateway.requests.length;
  const terminalAttachmentResult =
    await executeXuanxueAiProductionOrder(
      terminalAttachmentRuntime,
      terminalAttachmentOrder.orderId,
    );
  assert.equal(terminalAttachmentResult.status, "recovery_pending");
  assert.equal(
    terminalAttachmentGateway.requests.length
      - terminalAttachmentGatewayCallCount,
    1,
    "a terminal attachment transport proof must stop automatic factory re-entry after one upload attempt",
  );
  const terminalAttachmentReplay =
    await executeXuanxueAiProductionOrder(
      terminalAttachmentRuntime,
      terminalAttachmentOrder.orderId,
    );
  assert.equal(terminalAttachmentReplay.status, "recovery_pending");
  assert.equal(
    terminalAttachmentGateway.requests.length
      - terminalAttachmentGatewayCallCount,
    1,
    "restart recovery must preserve the terminal attachment proof without copy-paste or picker re-upload",
  );
  assert.equal(
    terminalAttachmentReplay.stages[0]?.aiFeedResult?.providerProof
      .attachmentUploadProof?.uploadAttemptId,
    "fixture-terminal-attachment-attempt",
  );
  terminalAttachmentStore.close();

  const transientOrder = order(
    "aiprod_transient_stage_retry",
    "qimen_professional_answer",
    ["analysis"],
  );
  createXuanxueAiProductionOrder(runtime, transientOrder);
  gateway.faults.transient.set(
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
  gateway.faults.submittedReview.set(
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
  contaminatedNaming.frozenSubject.participants[0]!.roleCode = "naming_target";
  contaminatedNaming.frozenSubject.participantManifestHash = hash(
    JSON.stringify(contaminatedNaming.frozenSubject.participants),
  );
  const contaminatedSource =
    `${contaminatedNaming.orderId}:naming_author`;
  gateway.faults.contaminated.set(contaminatedSource, 1);
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
      executionId: qimenFollowupParentFinal.executionId,
      inputBundleHash: qimenFollowupParent.inputBundleHash,
      conversationScopeRef: qimenFollowupParent.conversationScopeRef,
      frozenSubject: qimenFollowupParent.frozenSubject,
    },
  });
  process.stdout.write(
    "[ACCEPTANCE] xuanxue-ai-production PASS: fixed single-conversation graphs, contaminated-output restart, exact-parent FIFO, parent-conversation replay from cloud material, seeded checkpoints, idempotency and cloud-reconciled SQLite restart recovery.\n",
  );
} finally {
  await rm(dataDir, { recursive: true, force: true });
}
