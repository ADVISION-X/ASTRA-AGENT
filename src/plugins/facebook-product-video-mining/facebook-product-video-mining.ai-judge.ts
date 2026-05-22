import { statSync } from "node:fs";

import type { AiFeedInput, AiFeedResult, AiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
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
  const request = buildAiFeedRequest({ ...input, prompt });
  const traceContext = createFacebookRoundTrace(input);
  const stageLogger = createStageLogger({ logger: input.runtimeLogger });
  const fileRef = request.inputRefs[0]?.filePath ?? input.videoFilePath;
  const videoFileHash = buildAiHash(input.videoFilePath);
  const promptHash = buildAiHash(prompt);
  const beforeHash = promptHash;
  const videoByteSize = statSync(input.videoFilePath).size;
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
    });
    responseStage.fail({
      reason: judgment.reason,
      failureClass: RuntimeFailureClass.AI_PROVIDER_FAILURE,
      retryable: false,
      terminal: false,
      recoveryPolicy: "review_required",
      refs: { rawOutputRef },
      hashes: { rawOutputHash },
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
