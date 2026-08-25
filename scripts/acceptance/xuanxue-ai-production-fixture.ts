import type {
  AiFeedInput,
  AiFeedResult,
  AiInputGatewayAbilityGroup,
} from "../../src/capabilities/ai-input-gateway/index.js";
import type { WebChatFailureClassification } from "../../src/capabilities/ai-input-gateway/index.js";
import type {
  XuanxueAiProductionOrder,
} from "../../src/plugins/xuanxue-ai-production/index.js";
import type { XuanxueLocalizationRole } from "../../src/plugins/xuanxue-ai-production/xuanxue-ai-production-localization-contract.js";
import {
  fixtureHash,
  fixtureModelIdentityProof,
  fixtureOrderProviderExecutionProfile,
  fixtureProviderExecutionProfileProof,
} from "./xuanxue-ai-production-fixture-provider-profile.js";
import { FixtureGatewayFaults } from "./xuanxue-ai-production-fixture-faults.js";

export const hash = fixtureHash;

const classifyFixtureWebChatFailure = (
  error: unknown,
  hasDurableSubmission: boolean,
): WebChatFailureClassification => {
  const reason = error instanceof Error ? error.message : String(error);
  if (hasDurableSubmission || /(?:WEB_CHAT_|ChatGPT fresh conversation pending|不能获取对象)/iu.test(reason)) {
    return "recovery_pending";
  }
  if (/(?:login|sign in|verification|captcha|security barrier|credential)/iu.test(reason)) {
    return "review_required";
  }
  return "failed";
};

const fixtureConversationProofs = (
  input: AiFeedInput,
  pageUrl: string,
  turnMarker: string,
  verifiedAt: string,
): Pick<AiFeedResult["providerProof"],
  "freshConversationProof" | "sameConversationProof" | "forkedFromCheckpointProof"> => ({
  freshConversationProof: input.providerContinuationRef || input.providerForkRef
    ? null
    : {
        preSubmitUserTurnCount: 0,
        preSubmitAssistantTurnCount: 0,
        continuationParent: null,
        forkParent: null,
        firstTurnMarker: turnMarker,
        createdConversationUrl: pageUrl,
        createdByExecutionId: input.taskIdentity.sourceTaskId,
        verifiedAt,
      },
  sameConversationProof: input.providerContinuationRef
    ? {
        parentConversationUrl: input.providerContinuationRef.providerPageUrl,
        parentRawOutputHash: input.providerContinuationRef.priorRawOutputHash,
        actualConversationUrl: pageUrl,
        priorTurnMarker: input.providerContinuationRef.priorTurnMarker ?? null,
        newTurnMarker: turnMarker,
        continuationVerifiedAt: verifiedAt,
      }
    : null,
  forkedFromCheckpointProof: input.providerForkRef
    ? {
        parentConversationUrl: input.providerForkRef.providerPageUrl,
        parentCheckpointTurnMarker: input.providerForkRef.checkpointTurnMarker,
        parentCheckpointResponseHash: input.providerForkRef.checkpointResponseHash,
        forkActionEvidenceRef: `fixture-fork:${input.taskIdentity.sourceTaskId}`,
        forkActionEvidenceHash: hash(`fixture-fork:${input.taskIdentity.sourceTaskId}`),
        childConversationUrl: pageUrl,
        childInitialHistoryFingerprint: hash(`fixture-history:${input.taskIdentity.sourceTaskId}`),
        childFirstTurnMarker: turnMarker,
        verifiedAt,
      }
    : null,
});

const fixtureAttachmentProof = (
  input: AiFeedInput,
  verifiedAt: string,
): NonNullable<AiFeedResult["providerProof"]["attachmentUploadProof"]> | undefined => {
  const files = input.inputRefs.filter((ref) => Boolean(ref.filePath));
  if (files.length === 0) return undefined;
  return {
    childCapabilityId: "attach-approved-web-chat-files-once" as const,
    uploadAttemptId: `fixture-upload:${input.taskIdentity.sourceTaskId}`,
    transportKind: "exact_target_file_input_batch" as const,
    expectedFileCount: files.length,
    detectedFileCount: files.length,
    stagingManifestHash: hash(JSON.stringify(files.map((file) => file.id))),
    files: files.map((file, index) => ({
      inputRefId: file.id,
      order: index + 1,
      sourceFileName: file.fileName ?? `fixture-${index + 1}.md`,
      displayFileName: file.fileName ?? `fixture-${index + 1}.md`,
      sha256: file.sha256!,
      byteCount: file.byteCount!,
    })),
    startedAt: verifiedAt,
    endedAt: verifiedAt,
    status: "attachments_stable" as const,
    failureReason: null,
    reviewRequiredReason: null,
  };
};

const fixtureProviderProof = (
  input: AiFeedInput,
  ordinal: number,
  rawResponseText: string,
  pageUrl: string,
  turnMarker: string,
  verifiedAt: string,
): AiFeedResult["providerProof"] => {
  const attachmentUploadProof = fixtureAttachmentProof(input, verifiedAt);
  return {
  providerKind: "gpt-web-chat",
  providerLeaseId: `fixture-lease:${ordinal}`,
  modelName: null,
  ...fixtureModelIdentityProof(input, rawResponseText, verifiedAt),
  ...fixtureProviderExecutionProfileProof(input),
  inputHash: hash(JSON.stringify(input)),
  outputHash: hash(rawResponseText),
  inputRefs: input.inputRefs.map((ref) => ref.id),
  uploadedFileRefs: input.inputRefs.filter((ref) => Boolean(ref.filePath)).map((ref) => ref.id),
  outputRefs: [`fixture-output:${input.taskIdentity.sourceTaskId}`],
  startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), durationMs: 1,
  transport: "web-chat",
  conversationMode: input.providerForkRef
    ? "forked_from_checkpoint"
    : input.providerContinuationRef ? "same_conversation" : "fresh",
  conversationScopeRef: input.conversationScopeRef ?? null,
  ...fixtureConversationProofs(input, pageUrl, turnMarker, verifiedAt),
  webChatUrl: pageUrl,
  sourcePageUrlBeforeFeed: null, restoredSourcePage: null,
  retryCount: 0, cooldownMs: 0,
  estimatedInputTokens: null, estimatedOutputTokens: null,
  tokenEstimateUnavailableReason: "fixture",
  ...(attachmentUploadProof ? { attachmentUploadProof } : {}),
  ...(input.providerContinuationRef ? {
    continuationPriorTaskId: input.providerContinuationRef.priorTaskId,
    continuationPriorRawOutputHash: input.providerContinuationRef.priorRawOutputHash,
    continuationRequestedUrl: input.providerContinuationRef.providerPageUrl,
    continuationActualUrl: input.providerContinuationRef.providerPageUrl,
    continuationVerified: true,
  } : {}),
  };
};

export const providerResult = (
  input: AiFeedInput,
  ordinal: number,
  generatedImageArtifact?: AiFeedResult["outputArtifacts"][number],
): AiFeedResult => {
  const rawResponseText = JSON.stringify({
    stage: input.roundId,
    verdict: "fixture-transport-only",
  });
  const pageUrl = input.providerContinuationRef?.providerPageUrl
    ?? `https://chatgpt.com/c/${String(ordinal).padStart(8, "0")}`;
  const turnMarker = `fixture-turn:${input.taskIdentity.sourceTaskId}`;
  const verifiedAt = new Date().toISOString();
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
    providerProof: fixtureProviderProof(
      input, ordinal, rawResponseText, pageUrl, turnMarker, verifiedAt,
    ),
    failureReason: null,
    reviewRequiredReason: null,
  };
};

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
  heldTaskKind: string | null = null;
  heldRoundId: string | null = null;
  bareOutputHashes = false;
  readonly faults = new FixtureGatewayFaults();
  private releaseHeldRequest: (() => void) | null = null;
  private heldRequest = Promise.resolve();

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

  classifyFailure(
    error: unknown,
    hasDurableSubmission: boolean,
  ): WebChatFailureClassification {
    return classifyFixtureWebChatFailure(error, hasDurableSubmission);
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
        this.heldTaskKind === request.taskIdentity.taskKind
        && (this.heldRoundId === null || this.heldRoundId === request.roundId)
      ) await this.heldRequest;
      else await new Promise<void>((resolve) => setTimeout(resolve, 5));
      const result = providerResult(
        request,
        this.requests.length,
        this.generatedImageArtifact,
      );
      const fault = this.faults.consume(request, result);
      if (fault?.emitsRecoveryProgress) {
        await options?.onProgress?.({
          phase: "recovery_pending",
          occurredAt: new Date().toISOString(),
        });
      }
      const selected = fault
        ? fault.result
        : this.bareOutputHashes ? bareHashResult(result) : result;
      const attachmentProof = selected.providerProof.attachmentUploadProof;
      if (attachmentProof) {
        await options?.onAttachmentUploadCompleted?.(attachmentProof as import("../../src/capabilities/ai-input-gateway/index.js").WebChatAttachmentUploadProof);
      }
      return selected;
    } finally {
      this.finish(lane);
    }
  }

  holdRequest(taskKind: string, roundId: string | null = null): void {
    if (this.releaseHeldRequest) throw new Error("FIXTURE_GATEWAY_REQUEST_ALREADY_HELD");
    this.heldTaskKind = taskKind;
    this.heldRoundId = roundId;
    this.heldRequest = new Promise<void>((resolve) => {
      this.releaseHeldRequest = resolve;
    });
  }

  releaseRequest(): void {
    this.releaseHeldRequest?.();
    this.releaseHeldRequest = null;
    this.heldTaskKind = null;
    this.heldRoundId = null;
  }
}

export const material = (
  stageId: XuanxueAiProductionOrder["materials"][number]["stageId"],
  localization = false,
): XuanxueAiProductionOrder["materials"][number] => ({
  stageId,
  promptPackageId: `fixture:${stageId}`,
  promptContractId: `fixture-contract:${stageId}`,
  expectedOutputSchemaRef: `fixture-schema:${stageId}`,
  expectedOutputKind: stageId === "article_image_generation" ? "generated_image" : "text",
  textPrompt: `fixture prompt for ${stageId}`,
  inputRefs: localization ? [{
    id: `fixture-localization-context:${stageId}`,
    kind: "localization_review_context_json",
    summary: "fixture localization review context",
  }] : [],
  timeoutMs: 60_000,
  maxFileCount: 8,
});

const fixtureServiceClass = (
  productId: XuanxueAiProductionOrder["productId"],
  localization: boolean,
): XuanxueAiProductionOrder["serviceClass"] => {
  if (localization) return "localization";
  if (productId === "scheduled_quality_reflection") return "quality_background";
  if (productId === "public_knowledge_article_pipeline") return "public_content";
  return "user_delivery";
};

const fixtureTriggerKind = (
  productId: XuanxueAiProductionOrder["productId"],
  localization: boolean,
): XuanxueAiProductionOrder["triggerKind"] => {
  if (
    productId === "localization_static_review_candidate"
    || productId === "localization_static_review_selector"
  ) return "localization_static_review";
  if (localization) return "terminal_localization";
  if (productId === "scheduled_quality_reflection") return "scheduled_quality_reflection";
  if (productId === "public_knowledge_article_pipeline") return "scheduled_public_content";
  return "user_request";
};

const fixtureFrozenSubject = (
  orderId: string,
  productId: XuanxueAiProductionOrder["productId"],
  localization: boolean,
): XuanxueAiProductionOrder["frozenSubject"] => ({
  privacyOwnerRef: productId === "localization_article_translation" ? "public-knowledge-content" : localization ? "localization-catalog" : `owner:${orderId}`,
  snapshotRef: `snapshot:${orderId}`,
  snapshotHash: hash(`snapshot:${orderId}`),
  caseRevisionRef: `case-revision:${orderId}`,
  primaryPersonRef: localization ? null : `person:${orderId}`,
  participantManifestHash: localization ? hash("[]") : hash(`participants:${orderId}`),
  participants: localization ? [] : [{
    slotRef: "primary",
    roleCode: "primary",
    personRef: `person:${orderId}`,
    profileVersionRef: `profile:${orderId}:v1`,
    chartStateRef: `chart:${orderId}`,
    chartStateVersion: "v1",
    chartStateHash: hash(`chart:${orderId}`),
    purposeCode: productId,
    authorizationReceiptRef: `authorization:${orderId}`,
  }],
});

export const order = (
  orderId: string,
  productId: XuanxueAiProductionOrder["productId"],
  stageIds: readonly XuanxueAiProductionOrder["materials"][number]["stageId"][],
  localizationRole?: XuanxueLocalizationRole,
): XuanxueAiProductionOrder => {
  const localization = localizationRole !== undefined;
  if (localization && !localizationRole) throw new Error("fixture localization role is required");
  return {
  protocolVersion: "xuanxue-ai-production-v6",
  orderId,
  sourceProject: "xuanxue-web",
  sourceTaskId: `source:${orderId}`,
  productId,
  serviceClass: fixtureServiceClass(productId, localization),
  triggerKind: fixtureTriggerKind(productId, localization),
  lineageId: productId === "scheduled_quality_reflection" ? `lineage:${orderId}` : null,
  reflectionSnapshotRef: productId === "scheduled_quality_reflection" ? `snapshot:${orderId}` : null,
  reflectionPlanId: productId === "scheduled_quality_reflection" ? `plan:${orderId}` : null,
  inputBundleRef: `bundle:${orderId}`,
  inputBundleHash: hash(`bundle:${orderId}`),
  requestHash: hash(`request:${orderId}`),
  contractManifestHash: localization ? hash("fixture:localization-contract-manifest") : null,
  productContractHash: hash(`fixture:product-contract:${productId}`),
  localizationRole: localizationRole ?? null,
  providerExecutionProfile: fixtureOrderProviderExecutionProfile(productId, localizationRole),
  frozenSubject: fixtureFrozenSubject(orderId, productId, localization),
  conversationScopeRef: `conversation-scope:${orderId}`,
  conversationParent: null,
  joinParents: [],
  materials: stageIds.map((stageId) => material(stageId, localization)),
  createdAt: new Date().toISOString(),
  };
};
