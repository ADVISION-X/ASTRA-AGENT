import type { VisualTargetChildCapabilityId } from "./contract.js";
import { createDetectCloseCommentsButtonCapability } from "./children/detect-close-comments-button/implementation.js";
import { createDetectCommentsButtonCapability } from "./children/detect-comments-button/implementation.js";
import { createDetectCommentsPanelCapability } from "./children/detect-comments-panel/implementation.js";
import { createDetectLikeButtonCapability } from "./children/detect-like-button/implementation.js";
import { createDetectMetricCommentCountCapability } from "./children/detect-metric-comment-count/implementation.js";
import { createDetectMetricLikeCountCapability } from "./children/detect-metric-like-count/implementation.js";
import { createDetectNextVideoRegionCapability } from "./children/detect-next-video-region/implementation.js";
import { createDetectNotInterestedButtonCapability } from "./children/detect-not-interested-button/implementation.js";
import { createDetectSaveButtonCapability } from "./children/detect-save-button/implementation.js";
import type { VisualTargetChildCapability } from "./runtime/visual-target-child-contract.js";

const CHILDREN = [
  createDetectLikeButtonCapability(),
  createDetectSaveButtonCapability(),
  createDetectCommentsButtonCapability(),
  createDetectCommentsPanelCapability(),
  createDetectCloseCommentsButtonCapability(),
  createDetectNotInterestedButtonCapability(),
  createDetectNextVideoRegionCapability(),
  createDetectMetricLikeCountCapability(),
  createDetectMetricCommentCountCapability(),
] as const;

export function createVisualTargetCapabilityRegistry(): Map<VisualTargetChildCapabilityId, VisualTargetChildCapability> {
  return new Map(CHILDREN.map((child) => [child.childCapabilityId, child]));
}

export function listVisualTargetChildren(): VisualTargetChildCapabilityId[] {
  return CHILDREN.map((child) => child.childCapabilityId);
}