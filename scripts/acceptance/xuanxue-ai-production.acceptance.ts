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
import { acceptStoredOrderContractQuarantine } from "./xuanxue-ai-production-stored-order-quarantine-acceptance.js";
import {
  XUANXUE_LOCALIZATION_CONTRACT_MANIFEST_HASH,
  XUANXUE_LOCALIZATION_PRODUCT_CONTRACTS,
} from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-localization-contract.js";

const dataDir = await mkdtemp(
  path.join(tmpdir(), "xuanxue-ai-production-acceptance-"),
);
try {
  await acceptStoredOrderContractQuarantine();
  const sharedSource = await readFile(
    path.resolve("src/capabilities/ai-input-gateway/providers/web-chat-shared.ts"),
    "utf8",
  );
  assert.ok(
    sharedSource.indexOf("const preSubmit = await prepareWebChatConversation(input)")
      < sharedSource.indexOf("const capturedSubmission = await submitWebChatPrompt({"),
    "GPT Web flow must prepare the governed profile before submitting the prompt",
  );
  assert.match(
    sharedSource,
    /preSubmit\.modelIdentityProof/u,
    "completed proof must use the pre-submit model identity read-back",
  );
  const profileSelectionSource = await readFile(
    path.resolve("src/capabilities/ai-input-gateway/providers/gpt-web-execution-profile.ts"),
    "utf8",
  );
  assert.match(profileSelectionSource, /applyRequiredProfile/u);
  assert.match(profileSelectionSource, /GPT_WEB_EXECUTION_PROFILE_READBACK_MISMATCH/u);
  assert.match(profileSelectionSource, /pro_standard/u);

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

  const candidateA = order(
    "aiprod_localization_candidate_a",
    "localization_static_review_candidate",
    ["localization_candidate"],
    "candidate_a",
  );
  const candidateB = order(
    "aiprod_localization_candidate_b",
    "localization_static_review_candidate",
    ["localization_candidate"],
    "candidate_b",
  );
  const selectorFirst = order(
    "aiprod_localization_selector_first",
    "localization_static_review_selector",
    ["localization_selector"],
    "selector_first",
  );
  const consistency = order(
    "aiprod_localization_consistency",
    "localization_static_review_selector",
    ["localization_selector"],
    "consistency",
  );

  for (const localization of [candidateA, candidateB, selectorFirst, consistency]) {
    assert.equal(localization.frozenSubject.primaryPersonRef, null);
    assert.deepEqual(localization.frozenSubject.participants, []);
    assert.equal(localization.contractManifestHash, XUANXUE_LOCALIZATION_CONTRACT_MANIFEST_HASH);
    createXuanxueAiProductionOrder(runtime, localization);
    const completed = await executeXuanxueAiProductionOrder(runtime, localization.orderId);
    assert.equal(completed.status, "completed", completed.failureReason ?? undefined);
    assert.equal(completed.stages.length, 1);
    assert.equal(completed.result?.contractManifestHash, XUANXUE_LOCALIZATION_CONTRACT_MANIFEST_HASH);
    assert.equal(
      completed.stages.every((stage) =>
        Boolean(stage.aiFeedResult?.providerProof.providerTranscriptJsonl)
        && Boolean(stage.aiFeedResult?.providerProof.modelIdentityProof),
      ),
      true,
    );
  }

  const selectorFirstRecord = store.readOrder(selectorFirst.orderId)!;
  const selectorFirstStage = selectorFirstRecord.stages[0]!;
  const selectorSwapBase = order(
    "aiprod_localization_selector_swap",
    "localization_static_review_selector",
    ["localization_selector"],
    "selector_swap",
  );
  const selectorSwap = {
    ...selectorSwapBase,
    conversationParent: {
      relation: "same_conversation" as const,
      jobId: selectorFirst.orderId,
      stageId: "localization_selector" as const,
      executionId: selectorFirstStage.executionId,
      rawOutputHash: selectorFirstStage.rawOutputHash as `sha256:${string}`,
      inputBundleHash: selectorFirst.inputBundleHash,
      conversationScopeRef: selectorFirst.conversationScopeRef,
    },
  };
  createXuanxueAiProductionOrder(runtime, selectorSwap);
  const swapCompleted = await executeXuanxueAiProductionOrder(
    runtime,
    selectorSwap.orderId,
  );
  assert.equal(swapCompleted.status, "completed");
  assert.equal(
    swapCompleted.stages[0]?.aiFeedResult?.providerProof.sameConversationProof?.parentConversationUrl,
    selectorFirstStage.aiFeedResult?.providerProof.webChatUrl,
  );
  assert.equal(
    selectorSwap.productContractHash,
    XUANXUE_LOCALIZATION_PRODUCT_CONTRACTS.localization_static_review_selector.product_contract_hash,
  );

  await acceptXuanxueRestartRecovery({
    dataDir,
    gateway,
    runtime,
    completedOrderId: hehun.orderId,
  });
  store.close();
  process.stdout.write(
    "[ACCEPTANCE] xuanxue-ai-production PASS: fixed product graphs, four single-stage localization contracts, exact selector continuation, contaminated-output restart, exact-parent FIFO, parent-conversation replay, seeded checkpoints, idempotency and cloud-reconciled SQLite restart recovery.\n",
  );
} finally {
  await rm(dataDir, { recursive: true, force: true });
}
