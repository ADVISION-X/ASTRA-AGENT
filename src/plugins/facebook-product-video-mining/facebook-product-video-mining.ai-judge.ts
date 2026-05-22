import { existsSync, statSync } from "node:fs";

import type { AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import {
  RuntimeFailureClass,
  createMissionTrace,
  createStageLogger,
  type RuntimeLogger,
  withRoundTrace,
} from "../../lib/runtime-logs/index.js";
import {
  FacebookProductVideoMiningSchemas,
  type FacebookProductVideoMiningContracts,
} from "./facebook-product-video-mining.schema.js";
import {
  FACEBOOK_PRODUCT_VIDEO_MINING_PROMPT_CONTRACT_ID,
  buildAiFeedRequest,
  buildAiHash,
  buildParseStagePayload,
  buildPrompt,
  buildResponseStagePayload,
  buildUploadStagePayload,
  resolveFeedJudgment,
} from "./facebook-product-video-mining.ai-judge-support.js";
import { executeFacebookAiFeedWithHardTimeout } from "./facebook-product-video-mining.ai-timeout.js";

type FacebookCommentRecord = FacebookProductVideoMiningContracts["FacebookCommentRecord"];
type FacebookVideoAiJudgment = FacebookProductVideoMiningContracts["FacebookVideoAiJudgment"];
type FacebookVideoDomProbeResult = FacebookProductVideoMiningContracts["FacebookVideoDomProbeResult"];

type JudgeFacebookProductVideoInput = {
  aiInputGateway: AiInputGatewayAbilityGroup;
  runtimeLogger: RuntimeLogger;
  providerKind: FacebookVideoAiJudgment["providerKind"];
  modelName?: string | null;
  missionId: string;
  runId: string;
  roundId: string;
  probe: FacebookVideoDomProbeResult;
  comments: readonly FacebookCommentRecord[];
  videoFilePath: string;
  timeoutMs: number;
  maxFileBytes: number;
};

const FACEBOOK_RUNTIME_LOG_OWNER = "facebook-product-video-mining" as const;
const FACEBOOK_AI_PROVIDER_FAILURE_PAYLOAD = {
  recoveryTrail: "facebook-ai-recovery-trail",
  action: "recover_ai_provider_failure",
  status: "review_required",
  reason: "ai_provider_returned_no_raw_output",
  durationMs: 0,
  beforeHash: "ai-provider-before",
  afterHash: "ai-provider-after",
} as const;

const readVideoByteSize = (videoFilePath: string): number => {
  if (!existsSync(videoFilePath)) return 0;
  return statSync(videoFilePath).size;
};

const createFacebookRoundTrace = (input: {
  missionId: string;
  runId: string;
  roundId: string;
}) => withRoundTrace({
  context: createMissionTrace({
    missionId: input.missionId,
    runId: input.runId,
    owner: FACEBOOK_RUNTIME_LOG_OWNER,
  }),
  roundId: input.roundId,
});

export const judgeFacebookProductVideo = async (input: JudgeFacebookProductVideoInput): Promise<FacebookVideoAiJudgment> => {
  const prompt = buildPrompt({ probe: input.probe, comments: input.comments });
  const request = buildAiFeedRequest({
    ...input,
    prompt,
    inputRefs: [
      {
        id: `${input.roundId}_video`,
        kind: "video/mp4",
        summary: "staging Facebook video artifact for product-seeding judgment",
        filePath: input.videoFilePath,
        mimeType: "video/mp4",
        uploadStatus: "pending",
      },
    ],
  });
  const traceContext = createFacebookRoundTrace(input);
  const stageLogger = createStageLogger({ logger: input.runtimeLogger });
  const fileRef = request.inputRefs[0]?.filePath ?? input.videoFilePath;
  const videoFileHash = buildAiHash(input.videoFilePath);
  const promptHash = buildAiHash(prompt);
  const beforeHash = promptHash;
  const videoByteSize = readVideoByteSize(input.videoFilePath);
  const uploadStage = stageLogger.start({
    context: traceContext,
    stageName: "FACEBOOK_AI_UPLOAD",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    refs: { fileRef },
    hashes: { videoFileHash, promptHash },
    metrics: { videoByteSize },
    payload: buildUploadStagePayload({
      providerKind: input.providerKind,
      modelName: input.modelName ?? null,
      inputRefs: request.inputRefs,
      expectedOutputSchemaRef: request.expectedOutputSchemaRef ?? FACEBOOK_PRODUCT_VIDEO_MINING_PROMPT_CONTRACT_ID,
      timeoutMs: request.timeoutMs,
      beforeHash,
      afterHash: videoFileHash,
    }),
  });
  const responseStage = stageLogger.start({
    context: traceContext,
    stageName: "FACEBOOK_AI_RESPONSE_WAIT",
    modeVisibility: ["DEBUG", "TRACE"],
    payload: buildResponseStagePayload({
      providerKind: input.providerKind,
      modelName: input.modelName ?? null,
      promptHash,
      timeoutMs: request.timeoutMs,
      beforeHash,
      afterHash: videoFileHash,
    }),
  });
  const parseStage = stageLogger.start({
    context: traceContext,
    stageName: "FACEBOOK_AI_PARSE",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    payload: buildParseStagePayload({
      providerKind: input.providerKind,
      modelName: input.modelName ?? null,
      promptHash,
      expectedOutputSchemaRef: request.expectedOutputSchemaRef ?? FACEBOOK_PRODUCT_VIDEO_MINING_PROMPT_CONTRACT_ID,
      timeoutMs: request.timeoutMs,
      beforeHash,
      afterHash: videoFileHash,
    }),
  });
  const judgment = await executeFacebookAiFeedWithHardTimeout({
    aiInputGateway: input.aiInputGateway,
    request,
    providerKind: input.providerKind,
    prompt,
    videoFilePath: input.videoFilePath,
    timeoutMs: input.timeoutMs,
    resolveFeedResult: (feedResult) => resolveFeedJudgment({ providerKind: input.providerKind, feedResult }),
  });
  const rawOutputRef = judgment.rawOutputRef ?? "ai-raw-output-missing";
  const rawOutputHash = judgment.rawOutputHash ?? "ai-raw-hash-missing";
  const normalizedOutputHash = buildAiHash(judgment.normalizedText ?? "");
  const afterHash = judgment.rawOutputHash ?? videoFileHash;
  if (judgment.rawOutputRef === null) {
    uploadStage.fail({
      reason: judgment.reason,
      failureClass: RuntimeFailureClass.AI_PROVIDER_FAILURE,
      retryable: false,
      terminal: false,
      recoveryPolicy: "review_required",
      payload: {
        ...FACEBOOK_AI_PROVIDER_FAILURE_PAYLOAD,
        reason: judgment.reason,
        durationMs: judgment.providerProof.durationMs,
        afterHash,
      },
    });
    responseStage.fail({
      reason: judgment.reason,
      failureClass: RuntimeFailureClass.AI_PROVIDER_FAILURE,
      retryable: false,
      terminal: false,
      recoveryPolicy: "review_required",
      refs: { rawOutputRef },
      hashes: { rawOutputHash },
      payload: {
        ...FACEBOOK_AI_PROVIDER_FAILURE_PAYLOAD,
        action: "wait_ai_response",
        reason: judgment.reason,
        durationMs: judgment.providerProof.durationMs,
        afterHash,
      },
    });
  } else {
    uploadStage.complete({
      durationMs: judgment.providerProof.durationMs,
      refs: { fileRef },
      hashes: { videoFileHash, promptHash },
      metrics: { videoByteSize },
    });
    responseStage.complete({
      durationMs: judgment.providerProof.durationMs,
      refs: { rawOutputRef },
      hashes: { rawOutputHash },
      payload: {
        parseStatus: judgment.parseStatus,
        schemaValidationStatus: judgment.schemaValidationStatus,
      },
    });
  }
  if (judgment.status === "success") {
    parseStage.complete({
      durationMs: judgment.providerProof.durationMs,
      refs: { rawOutputRef },
      hashes: { normalizedOutputHash },
      metrics: { confidence: judgment.confidence },
      payload: {
        parseStatus: judgment.parseStatus,
        schemaValidationStatus: judgment.schemaValidationStatus,
      },
    });
    return judgment;
  }
  if (judgment.parseStatus !== "json_valid" || judgment.schemaValidationStatus !== "valid") {
    parseStage.fail({
      reason: judgment.reason,
      failureClass: RuntimeFailureClass.AI_PARSE_FAILURE,
      retryable: false,
      terminal: true,
      recoveryPolicy: "review_required",
      refs: { rawOutputRef },
      hashes: { normalizedOutputHash },
      payload: {
        parseStatus: judgment.parseStatus,
        schemaValidationStatus: judgment.schemaValidationStatus,
      },
    });
  } else {
    parseStage.fail({
      reason: judgment.reason,
      failureClass: RuntimeFailureClass.AI_PROVIDER_FAILURE,
      retryable: false,
      terminal: true,
      recoveryPolicy: "review_required",
      refs: { rawOutputRef },
      hashes: { normalizedOutputHash },
      payload: {
        parseStatus: judgment.parseStatus,
        schemaValidationStatus: judgment.schemaValidationStatus,
      },
    });
  }
  return judgment;
};

export { FACEBOOK_PRODUCT_VIDEO_MINING_PROMPT_CONTRACT_ID };
