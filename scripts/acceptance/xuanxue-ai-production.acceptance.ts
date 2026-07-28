import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type {
  AiFeedInput,
  AiFeedResult,
  AiInputGatewayAbilityGroup,
} from "../../src/capabilities/ai-input-gateway/index.js";
import {
  createXuanxueAiProductionOrder,
  executeXuanxueAiProductionOrder,
  XUANXUE_AI_PRODUCTION_JOB_ID,
  XuanxueAiProductionCoordinator,
  XuanxueAiProductionStore,
  type XuanxueAiProductionOrder,
  type XuanxueAiProductionRuntime,
} from "../../src/plugins/xuanxue-ai-production/index.js";

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const providerResult = (
  input: AiFeedInput,
  ordinal: number,
): AiFeedResult => {
  const rawResponseText = JSON.stringify({
    stage: input.roundId,
    ordinal,
    verdict: "fixture-transport-only",
  });
  return {
    abilityGroupId: "ai-input-gateway",
    childCapabilityId: "feed-gpt-web-chat-once",
    providerKind: "gpt-web-chat",
    status: "success",
    rawResponseText,
    transportWarnings: [],
    normalizedText: rawResponseText,
    rawOutputRef: `fixture-output:${input.taskIdentity.sourceTaskId}`,
    rawOutputHash: hash(rawResponseText),
    parseStatus: "json_valid",
    parsedJson: JSON.parse(rawResponseText),
    schemaValidationStatus: "valid",
    providerProof: {
      providerKind: "gpt-web-chat",
      providerLeaseId: `fixture-lease:${ordinal}`,
      modelName: null,
      inputHash: hash(JSON.stringify(input)),
      outputHash: hash(rawResponseText),
      inputRefs: input.inputRefs.map((ref) => ref.id),
      uploadedFileRefs: input.inputRefs.map((ref) => ref.id),
      outputRefs: [`fixture-output:${input.taskIdentity.sourceTaskId}`],
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      durationMs: 1,
      transport: "web-chat",
      webChatUrl: input.providerContinuationRef?.providerPageUrl
        ?? `https://chatgpt.com/c/${String(ordinal).padStart(8, "0")}`,
      sourcePageUrlBeforeFeed: null,
      restoredSourcePage: null,
      retryCount: 0,
      cooldownMs: 0,
      estimatedInputTokens: null,
      estimatedOutputTokens: null,
      tokenEstimateUnavailableReason: "fixture",
      ...(input.providerContinuationRef
        ? {
            continuationPriorTaskId:
              input.providerContinuationRef.priorTaskId,
            continuationPriorRawOutputHash:
              input.providerContinuationRef.priorRawOutputHash,
            continuationRequestedUrl:
              input.providerContinuationRef.providerPageUrl,
            continuationActualUrl:
              input.providerContinuationRef.providerPageUrl,
            continuationVerified: true,
          }
        : {}),
    },
    failureReason: null,
    reviewRequiredReason: null,
  };
};

class FixtureGateway implements AiInputGatewayAbilityGroup {
  readonly abilityGroupId = "ai-input-gateway" as const;
  readonly requests: AiFeedInput[] = [];
  readonly started: string[] = [];
  active = 0;
  maxActive = 0;
  holdQimen = false;
  private releaseHeldQimen: (() => void) | null = null;
  private readonly heldQimen = new Promise<void>((resolve) => {
    this.releaseHeldQimen = resolve;
  });

  listChildCapabilityIds():
    ReturnType<AiInputGatewayAbilityGroup["listChildCapabilityIds"]> {
    return ["feed-gpt-web-chat-once"];
  }

  getRuntimeCapacity(): number {
    return 10;
  }

  async execute(input: unknown): Promise<AiFeedResult> {
    const request = input as AiFeedInput;
    this.requests.push(request);
    this.started.push(request.taskIdentity.sourceTaskId);
    this.active += 1;
    this.maxActive = Math.max(this.maxActive, this.active);
    try {
      if (
        this.holdQimen
        && request.taskIdentity.taskKind === "qimen_professional_answer"
      ) {
        await this.heldQimen;
      } else {
        await new Promise<void>((resolve) => setTimeout(resolve, 5));
      }
      return providerResult(request, this.requests.length);
    } finally {
      this.active -= 1;
    }
  }

  releaseQimen(): void {
    this.releaseHeldQimen?.();
    this.releaseHeldQimen = null;
  }
}

const material = (
  stageId: XuanxueAiProductionOrder["materials"][number]["stageId"],
): XuanxueAiProductionOrder["materials"][number] => ({
  stageId,
  promptPackageId: `fixture:${stageId}`,
  promptContractId: `fixture-contract:${stageId}`,
  expectedOutputSchemaRef: `fixture-schema:${stageId}`,
  textPrompt: `fixture prompt for ${stageId}`,
  inputRefs: [],
  timeoutMs: 60_000,
  maxInputChars: 10_000,
  maxFileCount: 8,
  maxFileBytes: 10_000_000,
});

const order = (
  orderId: string,
  productId: XuanxueAiProductionOrder["productId"],
  stageIds: readonly XuanxueAiProductionOrder["materials"][number]["stageId"][],
): XuanxueAiProductionOrder => ({
  protocolVersion: "xuanxue-ai-production-v1",
  orderId,
  sourceProject: "xuanxue-web",
  sourceTaskId: `source:${orderId}`,
  productId,
  inputBundleRef: `bundle:${orderId}`,
  inputBundleHash: hash(`bundle:${orderId}`),
  requestHash: hash(`request:${orderId}`),
  continuationParent: null,
  seededStages: [],
  materials: stageIds.map(material),
  createdAt: new Date().toISOString(),
});

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

  const hehun = order("aiprod_hehun", "hehun_ai_analysis", [
    "party_a_interpretation",
    "party_b_interpretation",
    "final_compatibility",
  ]);
  createXuanxueAiProductionOrder(runtime, hehun);
  const hehunResult = await executeXuanxueAiProductionOrder(
    runtime,
    hehun.orderId,
  );
  assert.equal(hehunResult.status, "completed");
  assert.equal(hehunResult.result?.stages.length, 3);
  assert.deepEqual(
    gateway.started.slice(0, 2).map((value) => value.split(":").at(-1)).sort(),
    ["party_a_interpretation", "party_b_interpretation"],
  );
  const finalRequest = gateway.requests.find(
    (request) => request.roundId === "final_compatibility",
  );
  assert.ok(finalRequest?.providerContinuationRef);
  assert.ok(finalRequest.inputRefs.some(
    (ref) => ref.kind === "prior_stage_raw_response",
  ));
  const parentFinal = hehunResult.stages.find(
    (stage) => stage.stageId === "final_compatibility",
  );
  assert.ok(parentFinal?.rawOutputHash);
  const challenge: XuanxueAiProductionOrder = {
    ...order(
      "aiprod_manual_challenge",
      "manual_accuracy_challenge",
      ["manual_accuracy_challenge"],
    ),
    continuationParent: {
      jobId: hehun.orderId,
      stageId: "final_compatibility",
      rawOutputHash: parentFinal.rawOutputHash,
    },
  };
  createXuanxueAiProductionOrder(runtime, challenge);
  const challengeResult = await executeXuanxueAiProductionOrder(
    runtime,
    challenge.orderId,
  );
  assert.equal(challengeResult.status, "completed");
  const challengeRequest = gateway.requests.find(
    (request) =>
      request.roundId === "manual_accuracy_challenge",
  );
  assert.equal(
    challengeRequest?.providerContinuationRef?.priorTaskId,
    parentFinal.executionId,
  );
  assert.equal(
    challengeRequest?.providerContinuationRef?.priorRawOutputHash,
    parentFinal.rawOutputHash,
  );
  assert.ok(challengeRequest?.inputRefs.some(
    (ref) =>
      ref.kind === "prior_stage_raw_response"
      && ref.sha256 === parentFinal.rawOutputHash,
  ));
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
    gateway.started.filter((value) => value.includes("aiprod_qimen")).length,
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

  const replay = createXuanxueAiProductionOrder(runtime, hehun);
  assert.equal(replay.order.orderId, hehun.orderId);
  assert.throws(
    () => createXuanxueAiProductionOrder(runtime, {
      ...hehun,
      requestHash: hash(randomUUID()),
    }),
    /ORDER_IDENTITY_CONFLICT/u,
  );

  const recoverable = Array.from({ length: 70 }, (_, index) =>
    order(
      `aiprod_restart_recovery_${index + 1}`,
      "qimen_professional_answer",
      ["analysis"],
    ));
  for (const candidate of recoverable) {
    createXuanxueAiProductionOrder(runtime, candidate);
  }
  store.close();
  const reopened = new XuanxueAiProductionStore(dataDir);
  assert.equal(reopened.readOrder(hehun.orderId)?.status, "completed");
  assert.equal(
    reopened.listRecoverableOrders().length,
    recoverable.length,
    "restart discovery must never truncate an offline backlog",
  );
  const resumedRuntime = { ...runtime, store: reopened };
  const resumedCoordinator =
    new XuanxueAiProductionCoordinator(resumedRuntime);
  resumedCoordinator.resumeRecoverableOrders();
  const recoveryDeadline = Date.now() + 5_000;
  while (
    Date.now() < recoveryDeadline
    && recoverable.some(
      (candidate) =>
        reopened.readOrder(candidate.orderId)?.status !== "completed",
    )
  ) {
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
  assert.ok(
    recoverable.every(
      (candidate) =>
        reopened.readOrder(candidate.orderId)?.status === "completed",
    ),
    "all persisted offline orders must resume without a 64-order ceiling",
  );
  await resumedCoordinator.close();
  assert.equal(reopened.listRecoverableOrders().length, 0);
  reopened.close();
  process.stdout.write(
    "[ACCEPTANCE] xuanxue-ai-production PASS: fixed graphs, parallel branches, seeded legacy checkpoints, same-chat manual challenges and SEO, payment observation, idempotency and SQLite restart recovery.\n",
  );
} finally {
  await rm(dataDir, { recursive: true, force: true });
}
