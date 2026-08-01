import { createHash } from "node:crypto";

import type {
  AiFeedInput,
  AiFeedResult,
  AiInputGatewayAbilityGroup,
} from "../../src/capabilities/ai-input-gateway/index.js";
import type {
  XuanxueAiProductionOrder,
} from "../../src/plugins/xuanxue-ai-production/index.js";

export const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

export const providerResult = (
  input: AiFeedInput,
  ordinal: number,
  generatedImageArtifact?: AiFeedResult["outputArtifacts"][number],
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
    outputKind: input.expectedOutputKind,
    outputArtifacts: input.expectedOutputKind === "generated_image" && generatedImageArtifact
      ? [generatedImageArtifact]
      : [],
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
      uploadedFileRefs: input.inputRefs
        .filter((ref) => Boolean(ref.filePath))
        .map((ref) => ref.id),
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

const transientFailure = (
  result: AiFeedResult,
): AiFeedResult => ({
  ...result,
  status: "failed",
  rawResponseText: null,
  normalizedText: null,
  rawOutputRef: null,
  rawOutputHash: null,
  parsedJson: null,
  schemaValidationStatus: "invalid",
  providerProof: {
    ...result.providerProof,
    outputHash: null,
    outputRefs: [],
  },
  failureReason: "不能获取对象。 (-1728)",
});

const contaminatedResult = (
  result: AiFeedResult,
): AiFeedResult => {
  const rawResponseText =
    `{"answer":"\uE200filecite\uE202turn0file0\uE201"}`;
  const rawOutputHash = hash(rawResponseText);
  return {
    ...result,
    rawResponseText,
    normalizedText: rawResponseText,
    rawOutputHash,
    providerProof: {
      ...result.providerProof,
      outputHash: rawOutputHash,
    },
  };
};

const continuationMismatchResult = (
  result: AiFeedResult,
): AiFeedResult => ({
  ...result,
  status: "review_required",
  rawResponseText: null,
  normalizedText: null,
  rawOutputRef: null,
  rawOutputHash: null,
  parsedJson: null,
  schemaValidationStatus: "invalid",
  providerProof: {
    ...result.providerProof,
    outputHash: null,
    outputRefs: [],
  },
  failureReason: null,
  reviewRequiredReason:
    "WEB_CHAT_CONTINUATION_CONVERSATION_DRIFT: "
    + "expected=https://chatgpt.com/c/old-parent; "
    + "actual=https://chatgpt.com/",
});

const submittedReviewFailure = (
  result: AiFeedResult,
): AiFeedResult => ({
  ...result,
  status: "review_required",
  rawResponseText: null,
  normalizedText: null,
  rawOutputRef: null,
  rawOutputHash: null,
  parsedJson: null,
  schemaValidationStatus: "invalid",
  providerProof: {
    ...result.providerProof,
    outputHash: null,
    outputRefs: [],
  },
  failureReason: null,
  reviewRequiredReason:
    "review_required: more than one physical provider tab is open.",
});

const bareHashResult = (
  result: AiFeedResult,
): AiFeedResult => ({
  ...result,
  rawOutputHash: result.rawOutputHash?.replace(/^sha256:/u, "") ?? null,
  providerProof: {
    ...result.providerProof,
    outputHash:
      result.providerProof.outputHash?.replace(/^sha256:/u, "") ?? null,
  },
});

export class FixtureGateway implements AiInputGatewayAbilityGroup {
  readonly abilityGroupId = "ai-input-gateway" as const;
  readonly requests: AiFeedInput[] = [];
  readonly executionIds: string[] = [];
  readonly supersededExecutionIds: (string | null)[] = [];
  readonly started: string[] = [];
  active = 0;
  maxActive = 0;
  readonly activeByContinuation = new Map<string, number>();
  readonly maxActiveByContinuation = new Map<string, number>();
  holdQimen = false;
  bareOutputHashes = false;
  readonly transientFailures = new Map<string, number>();
  readonly submittedReviewFailures = new Map<string, number>();
  readonly contaminatedResponses = new Map<string, number>();
  readonly continuationFailures = new Map<string, number>();
  private releaseHeldQimen: (() => void) | null = null;
  private readonly heldQimen = new Promise<void>((resolve) => {
    this.releaseHeldQimen = resolve;
  });

  constructor(
    private readonly generatedImageArtifact?: AiFeedResult["outputArtifacts"][number],
  ) {}

  listChildCapabilityIds():
    ReturnType<AiInputGatewayAbilityGroup["listChildCapabilityIds"]> {
    return ["feed-gpt-web-chat-once"];
  }

  getRuntimeCapacity(): number {
    return 10;
  }

  private start(
    request: AiFeedInput,
    executionId: string,
  ): string | null {
    this.requests.push(request);
    this.executionIds.push(executionId);
    this.started.push(request.taskIdentity.sourceTaskId);
    this.active += 1;
    this.maxActive = Math.max(this.maxActive, this.active);
    const lane = request.providerContinuationRef?.providerPageUrl ?? null;
    if (!lane) return null;
    const active = (this.activeByContinuation.get(lane) ?? 0) + 1;
    this.activeByContinuation.set(lane, active);
    this.maxActiveByContinuation.set(
      lane,
      Math.max(this.maxActiveByContinuation.get(lane) ?? 0, active),
    );
    return lane;
  }

  private finish(lane: string | null): void {
    this.active -= 1;
    if (!lane) return;
    this.activeByContinuation.set(
      lane,
      Math.max(0, (this.activeByContinuation.get(lane) ?? 1) - 1),
    );
  }

  private consumeFailure(
    request: AiFeedInput,
    result: AiFeedResult,
  ): AiFeedResult | null {
    const key = request.taskIdentity.sourceTaskId;
    const remaining = this.transientFailures.get(key) ?? 0;
    if (remaining < 1) return null;
    this.transientFailures.set(key, remaining - 1);
    return transientFailure(result);
  }

  private consumeSubmittedReviewFailure(
    request: AiFeedInput,
    result: AiFeedResult,
  ): AiFeedResult | null {
    const key = request.taskIdentity.sourceTaskId;
    const remaining = this.submittedReviewFailures.get(key) ?? 0;
    if (remaining < 1) return null;
    this.submittedReviewFailures.set(key, remaining - 1);
    return submittedReviewFailure(result);
  }

  private consumeContamination(
    request: AiFeedInput,
    result: AiFeedResult,
  ): AiFeedResult | null {
    const key = request.taskIdentity.sourceTaskId;
    const remaining = this.contaminatedResponses.get(key) ?? 0;
    if (remaining < 1) return null;
    this.contaminatedResponses.set(key, remaining - 1);
    return contaminatedResult(result);
  }

  private consumeContinuationFailure(
    request: AiFeedInput,
    result: AiFeedResult,
  ): AiFeedResult | null {
    const key = request.taskIdentity.sourceTaskId;
    const remaining = this.continuationFailures.get(key) ?? 0;
    if (remaining < 1) return null;
    this.continuationFailures.set(key, remaining - 1);
    return continuationMismatchResult(result);
  }

  async execute(
    input: unknown,
    options?: Parameters<AiInputGatewayAbilityGroup["execute"]>[1],
  ): Promise<AiFeedResult> {
    const request = input as AiFeedInput;
    this.supersededExecutionIds.push(
      options?.supersededExecutionId ?? null,
    );
    const lane = this.start(request, options?.executionId ?? "");
    try {
      if (
        this.holdQimen
        && request.taskIdentity.taskKind === "qimen_professional_answer"
      ) await this.heldQimen;
      else await new Promise<void>((resolve) => setTimeout(resolve, 5));
      const result = providerResult(
        request,
        this.requests.length,
        this.generatedImageArtifact,
      );
      const continuationFailure =
        this.consumeContinuationFailure(request, result);
      if (continuationFailure) return continuationFailure;
      const submittedReview =
        this.consumeSubmittedReviewFailure(request, result);
      if (submittedReview) return submittedReview;
      const failed = this.consumeFailure(request, result);
      if (failed) {
        await options?.onProgress?.({
          phase: "recovery_pending",
          occurredAt: new Date().toISOString(),
        });
        return failed;
      }
      const contaminated = this.consumeContamination(request, result);
      if (contaminated) return contaminated;
      return this.bareOutputHashes ? bareHashResult(result) : result;
    } finally {
      this.finish(lane);
    }
  }

  releaseQimen(): void {
    this.releaseHeldQimen?.();
    this.releaseHeldQimen = null;
  }
}

export const material = (
  stageId: XuanxueAiProductionOrder["materials"][number]["stageId"],
): XuanxueAiProductionOrder["materials"][number] => ({
  stageId,
  promptPackageId: `fixture:${stageId}`,
  promptContractId: `fixture-contract:${stageId}`,
  expectedOutputSchemaRef: `fixture-schema:${stageId}`,
  expectedOutputKind: stageId === "article_image_generation" ? "generated_image" : "text",
  textPrompt: `fixture prompt for ${stageId}`,
  inputRefs: [],
  timeoutMs: 60_000,
  maxInputChars: 10_000,
  maxFileCount: 8,
  maxFileBytes: 10_000_000,
});

export const order = (
  orderId: string,
  productId: XuanxueAiProductionOrder["productId"],
  stageIds: readonly XuanxueAiProductionOrder["materials"][number]["stageId"][],
): XuanxueAiProductionOrder => ({
  protocolVersion: "xuanxue-ai-production-v2",
  orderId,
  sourceProject: "xuanxue-web",
  sourceTaskId: `source:${orderId}`,
  productId,
  serviceClass: productId === "scheduled_quality_reflection" ? "quality_background" : productId === "public_knowledge_article_pipeline" ? "public_content" : "user_delivery",
  triggerKind: productId === "scheduled_quality_reflection" ? "scheduled_quality_reflection" : productId === "public_knowledge_article_pipeline" ? "scheduled_public_content" : "user_request",
  lineageId: productId === "scheduled_quality_reflection" ? `lineage:${orderId}` : null,
  reflectionSnapshotRef: productId === "scheduled_quality_reflection" ? `snapshot:${orderId}` : null,
  reflectionPlanId: productId === "scheduled_quality_reflection" ? `plan:${orderId}` : null,
  inputBundleRef: `bundle:${orderId}`,
  inputBundleHash: hash(`bundle:${orderId}`),
  requestHash: hash(`request:${orderId}`),
  continuationParent: null,
  seededStages: [],
  materials: stageIds.map(material),
  createdAt: new Date().toISOString(),
});
