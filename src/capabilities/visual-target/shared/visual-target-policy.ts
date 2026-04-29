import type { VisualTargetChildCapabilityId, VisualTargetType } from "../contract.js";

export type VisualTargetChildProfile = {
  childCapabilityId: VisualTargetChildCapabilityId;
  targetType: VisualTargetType;
  targetNature: "action" | "region" | "metric";
  minimumConfidence: number;
  minimumAmbiguityGap: number;
  freshnessTtlMs: number;
  requireClickPoint: boolean;
  allowOperatorManual: boolean;
  allowedPageStateTypes: readonly string[];
};

export const VISUAL_TARGET_CHILD_PROFILES: Record<VisualTargetChildCapabilityId, VisualTargetChildProfile> = {
  "detect-like-button": {
    childCapabilityId: "detect-like-button",
    targetType: "like_button",
    targetNature: "action",
    minimumConfidence: 0.78,
    minimumAmbiguityGap: 0.08,
    freshnessTtlMs: 3000,
    requireClickPoint: true,
    allowOperatorManual: false,
    allowedPageStateTypes: ["platform_feed"],
  },
  "detect-save-button": {
    childCapabilityId: "detect-save-button",
    targetType: "save_button",
    targetNature: "action",
    minimumConfidence: 0.78,
    minimumAmbiguityGap: 0.08,
    freshnessTtlMs: 3000,
    requireClickPoint: true,
    allowOperatorManual: false,
    allowedPageStateTypes: ["platform_feed"],
  },
  "detect-comments-button": {
    childCapabilityId: "detect-comments-button",
    targetType: "comments_button",
    targetNature: "action",
    minimumConfidence: 0.78,
    minimumAmbiguityGap: 0.08,
    freshnessTtlMs: 3000,
    requireClickPoint: true,
    allowOperatorManual: false,
    allowedPageStateTypes: ["platform_feed"],
  },
  "detect-comments-panel": {
    childCapabilityId: "detect-comments-panel",
    targetType: "comments_panel",
    targetNature: "region",
    minimumConfidence: 0.72,
    minimumAmbiguityGap: 0.06,
    freshnessTtlMs: 3000,
    requireClickPoint: false,
    allowOperatorManual: false,
    allowedPageStateTypes: ["comments_panel"],
  },
  "detect-close-comments-button": {
    childCapabilityId: "detect-close-comments-button",
    targetType: "close_comments_button",
    targetNature: "action",
    minimumConfidence: 0.78,
    minimumAmbiguityGap: 0.08,
    freshnessTtlMs: 3000,
    requireClickPoint: true,
    allowOperatorManual: false,
    allowedPageStateTypes: ["comments_panel"],
  },
  "detect-not-interested-button": {
    childCapabilityId: "detect-not-interested-button",
    targetType: "not_interested_button",
    targetNature: "action",
    minimumConfidence: 0.8,
    minimumAmbiguityGap: 0.1,
    freshnessTtlMs: 3000,
    requireClickPoint: true,
    allowOperatorManual: false,
    allowedPageStateTypes: ["platform_feed"],
  },
  "detect-next-video-region": {
    childCapabilityId: "detect-next-video-region",
    targetType: "next_video_region",
    targetNature: "region",
    minimumConfidence: 0.72,
    minimumAmbiguityGap: 0.06,
    freshnessTtlMs: 3000,
    requireClickPoint: false,
    allowOperatorManual: false,
    allowedPageStateTypes: ["platform_feed"],
  },
  "detect-metric-like-count": {
    childCapabilityId: "detect-metric-like-count",
    targetType: "metric_like_count",
    targetNature: "metric",
    minimumConfidence: 0.72,
    minimumAmbiguityGap: 0.06,
    freshnessTtlMs: 3000,
    requireClickPoint: false,
    allowOperatorManual: false,
    allowedPageStateTypes: ["platform_feed", "comments_panel"],
  },
  "detect-metric-comment-count": {
    childCapabilityId: "detect-metric-comment-count",
    targetType: "metric_comment_count",
    targetNature: "metric",
    minimumConfidence: 0.72,
    minimumAmbiguityGap: 0.06,
    freshnessTtlMs: 3000,
    requireClickPoint: false,
    allowOperatorManual: false,
    allowedPageStateTypes: ["platform_feed", "comments_panel"],
  },
};

export function getVisualTargetChildProfile(childCapabilityId: VisualTargetChildCapabilityId): VisualTargetChildProfile {
  return VISUAL_TARGET_CHILD_PROFILES[childCapabilityId];
}