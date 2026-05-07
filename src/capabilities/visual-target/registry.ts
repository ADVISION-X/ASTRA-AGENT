import type { VisualTargetChildCapabilityId } from "./contract.js";
import { createObserveCloseCommentsButtonCapability } from "./children/observe-close-comments-button/implementation.js";
import { createObserveCommentsButtonCapability } from "./children/observe-comments-button/implementation.js";
import { createObserveCommentsPanelCapability } from "./children/observe-comments-panel/implementation.js";
import { createObserveLikeButtonCapability } from "./children/observe-like-button/implementation.js";
import { createObserveMetricCommentCountCapability } from "./children/observe-metric-comment-count/implementation.js";
import { createObserveMetricLikeCountCapability } from "./children/observe-metric-like-count/implementation.js";
import { createObserveNextVideoRegionCapability } from "./children/observe-next-video-region/implementation.js";
import { createObserveNotInterestedButtonCapability } from "./children/observe-not-interested-button/implementation.js";
import { createObserveSaveButtonCapability } from "./children/observe-save-button/implementation.js";
import type { VisualTargetChildCapability } from "./runtime/visual-target-child-contract.js";

const CHILDREN = [
  createObserveLikeButtonCapability(),
  createObserveSaveButtonCapability(),
  createObserveCommentsButtonCapability(),
  createObserveCommentsPanelCapability(),
  createObserveCloseCommentsButtonCapability(),
  createObserveNotInterestedButtonCapability(),
  createObserveNextVideoRegionCapability(),
  createObserveMetricLikeCountCapability(),
  createObserveMetricCommentCountCapability(),
] as const;

export function createVisualTargetCapabilityRegistry(): Map<VisualTargetChildCapabilityId, VisualTargetChildCapability> {
  return new Map(CHILDREN.map((child) => [child.childCapabilityId, child]));
}

export function listVisualTargetChildren(): VisualTargetChildCapabilityId[] {
  return CHILDREN.map((child) => child.childCapabilityId);
}