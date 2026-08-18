import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createMediaProcessingAbilityGroupFromFilesystem } from "../../src/capabilities/media-processing/index.js";
import {
  createXuanxueAiProductionOrder,
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
