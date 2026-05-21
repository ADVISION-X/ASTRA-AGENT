import type { DomSnapshot } from "../../capabilities/dom-automation/index.js";
import type {
  ProductVideoComment,
  ProductVideoDomMissionInput,
  ProductVideoEvidencePacket,
} from "./product-video-dom.schema.js";
import {
  extractProductVideoAuthor,
  extractProductVideoDescription,
  extractProductVideoDomId,
  extractProductVideoEngagement,
  extractProductVideoHashtags,
  extractProductVideoProductSignals,
  extractProductVideoTitle,
} from "./product-video-dom-extractor.js";
import { extractCommentCountText } from "./product-video-comment-extractor.js";

export const buildProductVideoEvidencePacket = (input: {
  mission: ProductVideoDomMissionInput;
  snapshot: DomSnapshot;
  comments: ProductVideoComment[];
  aiDecision: NonNullable<ProductVideoDomMissionInput["aiDecision"]>;
  aiDecisionReason: string;
  liked: boolean;
  evidenceRefs: string[];
}): ProductVideoEvidencePacket => ({
  platformId: input.mission.platformId,
  pageUrl: input.snapshot.url,
  videoVisitId: input.mission.videoVisitId,
  videoDomId: extractProductVideoDomId(input.snapshot, input.mission.videoVisitId),
  author: extractProductVideoAuthor(input.snapshot),
  titleText: extractProductVideoTitle(input.snapshot),
  descriptionText: extractProductVideoDescription(input.snapshot),
  hashtags: extractProductVideoHashtags(input.snapshot),
  engagement: extractProductVideoEngagement(input.snapshot),
  productSignals: extractProductVideoProductSignals(input.snapshot),
  commentCountText: extractCommentCountText(input.snapshot),
  comments: input.comments,
  aiDecision: input.aiDecision,
  aiDecisionReason: input.aiDecisionReason,
  liked: input.liked,
  nextActionHint: "next-video",
  evidenceRefs: input.evidenceRefs,
  capturedAt: new Date().toISOString(),
});
