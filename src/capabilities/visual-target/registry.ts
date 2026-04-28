import type { VisualTargetChildCapability, VisualTargetChildCapabilityId } from "./contract.js";
import { createDetectCommentsButtonCapability } from "./children/detect-comments-button/implementation.js";
import { createDetectNotInterestedButtonCapability } from "./children/detect-not-interested-button/implementation.js";
import { createDetectNextVideoRegionCapability } from "./children/detect-next-video-region/implementation.js";
import { createDetectLikeButtonCapability } from "./children/detect-like-button/implementation.js";
import { createDetectSaveButtonCapability } from "./children/detect-save-button/implementation.js";
import { createDetectCommentsPanelCapability } from "./children/detect-comments-panel/implementation.js";
import { createDetectCloseCommentsButtonCapability } from "./children/detect-close-comments-button/implementation.js";
import { createDetectMetricLikeCountCapability } from "./children/detect-metric-like-count/implementation.js";
import { createDetectMetricCommentCountCapability } from "./children/detect-metric-comment-count/implementation.js";

export function createVisualTargetCapabilityRegistry(): Map<VisualTargetChildCapabilityId, VisualTargetChildCapability> {
  return new Map<VisualTargetChildCapabilityId, VisualTargetChildCapability>([
    ["detect-comments-button", createDetectCommentsButtonCapability()],
    ["detect-not-interested-button", createDetectNotInterestedButtonCapability()],
    ["detect-next-video-region", createDetectNextVideoRegionCapability()],
    ["detect-like-button", createDetectLikeButtonCapability()],
    ["detect-save-button", createDetectSaveButtonCapability()],
    ["detect-comments-panel", createDetectCommentsPanelCapability()],
    ["detect-close-comments-button", createDetectCloseCommentsButtonCapability()],
    ["detect-metric-like-count", createDetectMetricLikeCountCapability()],
    ["detect-metric-comment-count", createDetectMetricCommentCountCapability()],
  ]);
}