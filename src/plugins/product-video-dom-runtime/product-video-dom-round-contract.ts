import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { DomSnapshot } from "../../capabilities/dom-automation/index.js";
import type {
  ProductVideoDomMissionInput,
  ProductVideoDomRoundResult,
  ProductVideoEvidenceRecord,
} from "./product-video-dom.schema.js";
import type { ProductVideoJudgeExecutor } from "./product-video-dom-judge.js";
import { extractProductVideoVisitId } from "./product-video-dom-extractor.js";

export const PRODUCT_VIDEO_COMMENT_BUTTON_HINTS = ["comments", "comment", "评论", "留言"];

export type ProductVideoDomRoundRuntimeResult = {
  roundResult: ProductVideoDomRoundResult;
  savedRecord: ProductVideoEvidenceRecord | null;
  advanceFailureCount: number;
};

export type ProductVideoDomRoundInput = {
  browser: BrowserController;
  dataDir: string;
  missionId: string;
  runId: string;
  roundId: string;
  roundIndex: number;
  platformId: string;
  productVideoPageUrl: string;
  userRequirementText: string;
  consecutiveAdvanceFailures: number;
  missionOverride?: Partial<Pick<ProductVideoDomMissionInput, "aiDecision" | "aiDecisionReason">>;
  judgeOverride?: ProductVideoJudgeExecutor;
};

export const buildProductVideoDomMissionInput = (
  input: ProductVideoDomRoundInput,
  snapshot: DomSnapshot,
): ProductVideoDomMissionInput => ({
  missionType: "product_video_dom_mining",
  platformId: input.platformId,
  pageUrl: input.productVideoPageUrl,
  videoVisitId: extractProductVideoVisitId(snapshot) ?? input.roundId,
  aiDecision: input.missionOverride?.aiDecision,
  aiDecisionReason: input.missionOverride?.aiDecisionReason ?? input.userRequirementText,
  targetHints: {
    likeButton: ["like", "点赞", "赞"],
    commentsButton: PRODUCT_VIDEO_COMMENT_BUTTON_HINTS,
    nextVideoButton: ["next", "next video", "下一条", "下一个视频"],
  },
});