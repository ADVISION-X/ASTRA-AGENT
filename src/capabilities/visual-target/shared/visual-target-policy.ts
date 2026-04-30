import {
  VISUAL_TARGET_CANDIDATE_KINDS,
  VISUAL_TARGET_CHILD_CAPABILITY_IDS,
  VISUAL_TARGET_COORDINATE_SPACES,
  VISUAL_TARGET_TYPES,
} from "./visual-target-types.js";

type VisualTargetChildCapabilityId = (typeof VISUAL_TARGET_CHILD_CAPABILITY_IDS)[number];
type VisualTargetType = (typeof VISUAL_TARGET_TYPES)[number];
type VisualTargetCandidateKind = (typeof VISUAL_TARGET_CANDIDATE_KINDS)[number];
type VisualTargetCoordinateSpace = (typeof VISUAL_TARGET_COORDINATE_SPACES)[number];

export const VISUAL_TARGET_ALLOWED_AI_PROMPT_CONTRACT_IDS = [
  "local-vision.target-detection.v1",
  "local-ocr.ui-target.v1",
  "visual-target.candidate-extraction.v1",
] as const;

export const VISUAL_TARGET_ALLOWED_AI_OUTPUT_SCHEMA_REFS = [
  "visual-target-candidates.schema.v1",
] as const;

export type VisualTargetGeometryHandoffPolicy = "required" | "optional" | "forbidden";

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
  allowedCandidateKinds: readonly VisualTargetCandidateKind[];
  allowedCoordinateSpaces: readonly VisualTargetCoordinateSpace[];
  geometryGuardHandoffPolicy: VisualTargetGeometryHandoffPolicy;
  allowedSourceAbilityGroups: readonly string[];
  requiredObservationKinds: readonly string[];
};

const ACTION_CANDIDATE_KINDS = ["ai_candidate", "heuristic_profile"] as const;
const METRIC_CANDIDATE_KINDS = ["ai_candidate", "heuristic_profile"] as const;
const ACTION_COORDINATE_SPACES = ["browser_viewport", "desktop_screen", "source_image", "ai_input"] as const;
const REGION_COORDINATE_SPACES = ["browser_viewport", "desktop_screen", "source_image", "ai_input"] as const;
const METRIC_COORDINATE_SPACES = ["browser_viewport", "source_image", "ai_input"] as const;
const DEFAULT_SOURCE_ABILITY_GROUPS = ["orchestration", "page-state", "mouse-scroll", "mouse-click"] as const;

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
    allowedCandidateKinds: ACTION_CANDIDATE_KINDS,
    allowedCoordinateSpaces: ACTION_COORDINATE_SPACES,
    geometryGuardHandoffPolicy: "required",
    allowedSourceAbilityGroups: DEFAULT_SOURCE_ABILITY_GROUPS,
    requiredObservationKinds: ["like_button"],
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
    allowedCandidateKinds: ACTION_CANDIDATE_KINDS,
    allowedCoordinateSpaces: ACTION_COORDINATE_SPACES,
    geometryGuardHandoffPolicy: "required",
    allowedSourceAbilityGroups: DEFAULT_SOURCE_ABILITY_GROUPS,
    requiredObservationKinds: ["save_button"],
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
    allowedCandidateKinds: ACTION_CANDIDATE_KINDS,
    allowedCoordinateSpaces: ACTION_COORDINATE_SPACES,
    geometryGuardHandoffPolicy: "required",
    allowedSourceAbilityGroups: DEFAULT_SOURCE_ABILITY_GROUPS,
    requiredObservationKinds: ["comments_button"],
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
    allowedCandidateKinds: ACTION_CANDIDATE_KINDS,
    allowedCoordinateSpaces: REGION_COORDINATE_SPACES,
    geometryGuardHandoffPolicy: "optional",
    allowedSourceAbilityGroups: DEFAULT_SOURCE_ABILITY_GROUPS,
    requiredObservationKinds: ["comments_panel"],
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
    allowedCandidateKinds: ACTION_CANDIDATE_KINDS,
    allowedCoordinateSpaces: ACTION_COORDINATE_SPACES,
    geometryGuardHandoffPolicy: "required",
    allowedSourceAbilityGroups: DEFAULT_SOURCE_ABILITY_GROUPS,
    requiredObservationKinds: ["close_comments_button"],
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
    allowedPageStateTypes: ["platform_feed", "context_menu"],
    allowedCandidateKinds: ACTION_CANDIDATE_KINDS,
    allowedCoordinateSpaces: ACTION_COORDINATE_SPACES,
    geometryGuardHandoffPolicy: "required",
    allowedSourceAbilityGroups: DEFAULT_SOURCE_ABILITY_GROUPS,
    requiredObservationKinds: ["not_interested_button"],
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
    allowedCandidateKinds: ACTION_CANDIDATE_KINDS,
    allowedCoordinateSpaces: REGION_COORDINATE_SPACES,
    geometryGuardHandoffPolicy: "optional",
    allowedSourceAbilityGroups: DEFAULT_SOURCE_ABILITY_GROUPS,
    requiredObservationKinds: ["next_video_region"],
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
    allowedCandidateKinds: METRIC_CANDIDATE_KINDS,
    allowedCoordinateSpaces: METRIC_COORDINATE_SPACES,
    geometryGuardHandoffPolicy: "forbidden",
    allowedSourceAbilityGroups: DEFAULT_SOURCE_ABILITY_GROUPS,
    requiredObservationKinds: ["metric_like_count"],
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
    allowedCandidateKinds: METRIC_CANDIDATE_KINDS,
    allowedCoordinateSpaces: METRIC_COORDINATE_SPACES,
    geometryGuardHandoffPolicy: "forbidden",
    allowedSourceAbilityGroups: DEFAULT_SOURCE_ABILITY_GROUPS,
    requiredObservationKinds: ["metric_comment_count"],
  },
};

export function getVisualTargetChildProfile(childCapabilityId: VisualTargetChildCapabilityId): VisualTargetChildProfile {
  return VISUAL_TARGET_CHILD_PROFILES[childCapabilityId];
}

export function isAllowedAiPromptContract(promptContractId: string): boolean {
  return VISUAL_TARGET_ALLOWED_AI_PROMPT_CONTRACT_IDS.includes(promptContractId as (typeof VISUAL_TARGET_ALLOWED_AI_PROMPT_CONTRACT_IDS)[number]);
}

export function isAllowedAiOutputSchemaRef(outputSchemaRef: string): boolean {
  return VISUAL_TARGET_ALLOWED_AI_OUTPUT_SCHEMA_REFS.includes(outputSchemaRef as (typeof VISUAL_TARGET_ALLOWED_AI_OUTPUT_SCHEMA_REFS)[number]);
}