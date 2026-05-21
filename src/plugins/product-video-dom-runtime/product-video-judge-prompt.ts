import type { DomSnapshot } from "../../capabilities/dom-automation/index.js";
import { PRODUCT_VIDEO_JUDGE_PROMPT_CONTRACT_ID } from "./product-video-judge.contract.js";
import type { ProductVideoDomMissionInput } from "./product-video-dom.schema.js";
import {
  extractProductVideoEngagement,
  extractProductVideoHashtags,
  extractProductVideoProductSignals,
} from "./product-video-dom-extractor.js";
import { extractCommentCountText } from "./product-video-comment-extractor.js";

const collectText = (snapshot: DomSnapshot): string =>
  [
    snapshot.title,
    ...snapshot.textBlocks.map((item) => item.visibleText ?? item.ariaLabel ?? item.nearbyText ?? ""),
    ...snapshot.links.map((item) => item.visibleText ?? item.ariaLabel ?? item.nearbyText ?? ""),
    ...snapshot.buttons.map((item) => item.visibleText ?? item.ariaLabel ?? item.nearbyText ?? ""),
  ].filter(Boolean).join("\n").replace(/\s+/g, " ").slice(0, 3200);

export const buildProductVideoJudgePrompt = (input: {
  mission: ProductVideoDomMissionInput;
  snapshot: DomSnapshot;
}): string => {
  const engagement = extractProductVideoEngagement(input.snapshot);
  return `You are GrassEye product-video judge.
Prompt contract: ${PRODUCT_VIDEO_JUDGE_PROMPT_CONTRACT_ID}

Your only job is to judge whether the current video is a product-seeding video worth DOM evidence collection.
Do not choose browser coordinates, DOM selectors, browser commands, save payloads, or multi-step action plans.
Use only the DOM facts below. If facts are insufficient, choose review_required.

User goal: ${input.mission.aiDecisionReason ?? "Find product-seeding videos."}
Platform: ${input.mission.platformId}
URL: ${input.snapshot.url}
Title: ${input.snapshot.title}
Hashtags: ${extractProductVideoHashtags(input.snapshot).join(", ") || "none"}
Product/link signals: ${extractProductVideoProductSignals(input.snapshot).join(" | ") || "none"}
Engagement: likes=${engagement.likesText ?? "unknown"} comments=${engagement.commentsText ?? extractCommentCountText(input.snapshot) ?? "unknown"} saves=${engagement.savesText ?? "unknown"} shares=${engagement.sharesText ?? "unknown"}
DOM visible text summary:
${collectText(input.snapshot)}

Return strict JSON matching productVideoJudge.v1.`;
};
