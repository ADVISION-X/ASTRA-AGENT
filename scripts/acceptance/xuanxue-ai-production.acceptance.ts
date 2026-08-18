import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createMediaProcessingAbilityGroupFromFilesystem } from "../../src/capabilities/media-processing/index.js";
import {
  createXuanxueAiProductionOrder,
  executeXuanxueAiProductionOrder,
  XuanxueAiProductionStore,
  type XuanxueAiProductionRuntime,
} from "../../src/plugins/xuanxue-ai-production/index.js";
import { FixtureGateway, order } from "./xuanxue-ai-production-fixture.js";
import { acceptXuanxueAiProductionConcurrency } from "./xuanxue-ai-production-concurrency-acceptance.js";
import { acceptXuanxueOrderGraphs } from "./xuanxue-ai-production-order-graph-acceptance.js";
import { acceptXuanxueAiProductionRecovery } from "./xuanxue-ai-production-recovery-acceptance.js";
import { acceptXuanxueParentRecovery } from "./xuanxue-ai-production-parent-recovery.js";
import { acceptXuanxueAiProductionSurface } from "./xuanxue-ai-production-surface-acceptance.js";
import { acceptXuanxueRestartRecovery } from "./xuanxue-ai-production-restart-recovery.js";

const dataDir = await mkdtemp(
  path.join(tmpdir(), "xuanxue-ai-production-acceptance-"),
);
try {
  const sharedSource = await readFile(
    path.resolve("src/capabilities/ai-input-gateway/providers/web-chat-shared.ts"),
    "utf8",
  );
  assert.ok(
    sharedSource.indexOf("await selectWebChatModelAndReasoning") >= 0,
    "GPT Web flow must select the model before preparation",
  );
  assert.match(
    sharedSource,
    /preSubmit\.modelIdentityProof/u,
    "completed proof must use the pre-submit model identity read-back",
  );
  const modelIdentitySource = await readFile(
    path.resolve("src/capabilities/ai-input-gateway/providers/web-chat-model-identity.ts"),
    "utf8",
  );
  assert.match(modelIdentitySource, /selectWebChatModel/u);
  assert.match(modelIdentitySource, /GPT-5\.6 Sol/u);

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
    dataDir,
    aiInputGateway: gateway,
    mediaProcessing: createMediaProcessingAbilityGroupFromFilesystem({ dataDir }),
    store,
  };

  const { hehun, qimenFollowupParent, qimenFollowupParentFinal } =
    await acceptXuanxueOrderGraphs({ runtime, gateway });
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
  await acceptXuanxueAiProductionSurface({ runtime, gateway });
  await acceptXuanxueAiProductionRecovery({ dataDir, runtime, gateway });
  await acceptXuanxueAiProductionConcurrency({ runtime, gateway });
  await acceptXuanxueParentRecovery({
    runtime,
    gateway,
    qimenParent: qimenFollowupParent,
    qimenParentFinal: qimenFollowupParentFinal,
  });
  const localization = order(
    "aiprod_localization_static_review",
    "localization_static_review",
    [
      "localization_candidate_a",
      "localization_candidate_b",
      "localization_selector_first",
      "localization_selector_swap",
      "localization_consistency",
    ],
  );
  assert.equal(localization.frozenSubject.primaryPersonRef, null);
  assert.deepEqual(localization.frozenSubject.participants, []);
  createXuanxueAiProductionOrder(runtime, localization);
  const localizationResult = await executeXuanxueAiProductionOrder(
    runtime,
    localization.orderId,
  );
  assert.equal(localizationResult.status, "completed");
  assert.deepEqual(
    localizationResult.stages.map((stage) => stage.stageId),
    [
      "localization_candidate_a",
      "localization_candidate_b",
      "localization_selector_first",
      "localization_selector_swap",
      "localization_consistency",
    ],
  );
  assert.equal(
    localizationResult.stages.every((stage) =>
      Boolean(stage.aiFeedResult?.providerProof.providerTranscriptJsonl)
      && Boolean(stage.aiFeedResult?.providerProof.modelIdentityProof),
    ),
    true,
  );
  await acceptXuanxueRestartRecovery({
    dataDir,
    gateway,
    runtime,
    completedOrderId: hehun.orderId,
  });
  store.close();
  process.stdout.write(
    "[ACCEPTANCE] xuanxue-ai-production PASS: fixed single-conversation graphs, contaminated-output restart, exact-parent FIFO, parent-conversation replay from cloud material, seeded checkpoints, idempotency and cloud-reconciled SQLite restart recovery.\n",
  );
} finally {
  await rm(dataDir, { recursive: true, force: true });
}
