import type { ProductVideoJudgeOutput } from "./product-video-judge.contract.js";
import {
  judgeProductVideoFromDomFacts,
  type ProductVideoDomJudgeResult,
} from "./product-video-dom-judge.js";
import {
  buildProductVideoDomMissionInput,
  type ProductVideoDomRoundInput,
  type ProductVideoDomRoundRuntimeResult,
} from "./product-video-dom-round-contract.js";
import {
  buildProductVideoContinueResult,
  checkProductVideoPageReadiness,
  ensureProductVideoMissionPageLoaded,
  readCurrentProductVideoSnapshot,
  saveProductVideoEvidenceRecord,
} from "./product-video-dom-round-support.js";

const buildRoundFailureResult = (
  input: ProductVideoDomRoundInput,
  reason: string,
): ProductVideoDomRoundRuntimeResult => ({
  roundResult: {
    status: reason.includes("browser_control_lost") ? "stop" : "review_required",
    reason,
  },
  savedRecord: null,
  advanceFailureCount: input.consecutiveAdvanceFailures,
});

const requestJudgeDecision = (
  input: ProductVideoDomRoundInput,
  mission: ReturnType<typeof buildProductVideoDomMissionInput>,
  snapshot: Parameters<typeof judgeProductVideoFromDomFacts>[0]["snapshot"],
) => judgeProductVideoFromDomFacts({
  dataDir: input.dataDir,
  mission,
  snapshot,
  userRequirementText: input.userRequirementText,
  ...(input.judgeOverride ? { judgeOverride: input.judgeOverride } : {}),
});

const continueProductVideoRound = (input: {
  roundInput: ProductVideoDomRoundInput;
  beforeSnapshot: Parameters<typeof buildProductVideoContinueResult>[0]["beforeSnapshot"];
  savedRecord: ProductVideoDomRoundRuntimeResult["savedRecord"];
  reason: string;
}) => buildProductVideoContinueResult({
  roundInput: input.roundInput,
  beforeSnapshot: input.beforeSnapshot,
  savedRecord: input.savedRecord,
  reason: input.reason,
});

const buildSkippedJudgeResult = (input: {
  roundInput: ProductVideoDomRoundInput;
  snapshot: Parameters<typeof buildProductVideoContinueResult>[0]["beforeSnapshot"];
  reason: string;
}) => continueProductVideoRound({
  roundInput: input.roundInput,
  beforeSnapshot: input.snapshot,
  savedRecord: null,
  reason: input.reason,
});

const buildSavedJudgeResult = async (input: {
  roundInput: ProductVideoDomRoundInput;
  snapshot: Parameters<typeof buildProductVideoContinueResult>[0]["beforeSnapshot"];
  judgeOutput: ProductVideoJudgeOutput;
}) => {
  const savedRecord = await saveProductVideoEvidenceRecord({
    roundInput: input.roundInput,
    snapshot: input.snapshot,
    aiJudge: input.judgeOutput,
  });
  return continueProductVideoRound({
    roundInput: input.roundInput,
    beforeSnapshot: input.snapshot,
    savedRecord,
    reason: "saved_product_video_record",
  });
};

const handleJudgeResult = async (input: {
  roundInput: ProductVideoDomRoundInput;
  snapshot: Parameters<typeof buildProductVideoContinueResult>[0]["beforeSnapshot"];
  judge: ProductVideoDomJudgeResult;
}): Promise<ProductVideoDomRoundRuntimeResult> => {
  if (input.judge.status === "invalid") {
    return buildSkippedJudgeResult({
      roundInput: input.roundInput,
      snapshot: input.snapshot,
      reason: input.judge.aiDecisionReason,
    });
  }
  const judgeOutput = input.judge.judgeOutput;
  if (input.judge.aiDecision === "review_required" || !judgeOutput) {
    return buildSkippedJudgeResult({
      roundInput: input.roundInput,
      snapshot: input.snapshot,
      reason: `skip_ai_review_required: ${input.judge.aiDecisionReason}`,
    });
  }
  return !judgeOutput.shouldSave || judgeOutput.nextDomAction === "next_video"
    ? buildSkippedJudgeResult({
        roundInput: input.roundInput,
        snapshot: input.snapshot,
        reason: input.judge.aiDecisionReason,
      })
    : buildSavedJudgeResult({
        roundInput: input.roundInput,
        snapshot: input.snapshot,
        judgeOutput,
      });
};

export const runProductVideoDomRoundRuntime = async (
  input: ProductVideoDomRoundInput,
): Promise<ProductVideoDomRoundRuntimeResult> => {
  try {
    await ensureProductVideoMissionPageLoaded(input);
    const snapshot = await readCurrentProductVideoSnapshot(input.browser);
    const pageReadiness = checkProductVideoPageReadiness(snapshot);
    if (pageReadiness) {
      return {
        roundResult: pageReadiness,
        savedRecord: null,
        advanceFailureCount: input.consecutiveAdvanceFailures,
      };
    }

    const mission = buildProductVideoDomMissionInput(input, snapshot);
    const judge = await requestJudgeDecision(input, mission, snapshot);
    return handleJudgeResult({ roundInput: input, snapshot, judge });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return buildRoundFailureResult(input, reason);
  }
};
