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
  requireClickPoint: boolean;
  allowOperatorManual: boolean;
  allowedPageStateTypes: readonly string[];
  allowedCandidateKinds: readonly VisualTargetCandidateKind[];
  allowedCoordinateSpaces: readonly VisualTargetCoordinateSpace[];
  geometryGuardHandoffPolicy: VisualTargetGeometryHandoffPolicy;
  allowedSourceAbilityGroups: readonly string[];
  requiredObservationKinds: readonly string[];
};

const ACTION_CANDIDATE_KINDS = ["ai_candidate"] as const;
const METRIC_CANDIDATE_KINDS = ["ai_candidate"] as const;
const ACTION_COORDINATE_SPACES = ["browser_viewport", "desktop_screen", "source_image", "ai_input"] as const;
const REGION_COORDINATE_SPACES = ["browser_viewport", "desktop_screen", "source_image", "ai_input"] as const;
const METRIC_COORDINATE_SPACES = ["browser_viewport", "source_image", "ai_input"] as const;
const DEFAULT_SOURCE_ABILITY_GROUPS = ["orchestration", "page-state", "mouse-scroll", "mouse-click"] as const;

export const VISUAL_TARGET_CHILD_PROFILES: Record<VisualTargetChildCapabilityId, VisualTargetChildProfile> = {
  "observe-like-button": {
    childCapabilityId: "observe-like-button",
    targetType: "like_button",
    targetNature: "action",
    requireClickPoint: true,
    allowOperatorManual: false,
    allowedPageStateTypes: ["platform_feed"],
    allowedCandidateKinds: ACTION_CANDIDATE_KINDS,
    allowedCoordinateSpaces: ACTION_COORDINATE_SPACES,
    geometryGuardHandoffPolicy: "required",
    allowedSourceAbilityGroups: DEFAULT_SOURCE_ABILITY_GROUPS,
    requiredObservationKinds: ["like_button"],
  },
  "observe-save-button": {
    childCapabilityId: "observe-save-button",
    targetType: "save_button",
    targetNature: "action",
    requireClickPoint: true,
    allowOperatorManual: false,
    allowedPageStateTypes: ["platform_feed"],
    allowedCandidateKinds: ACTION_CANDIDATE_KINDS,
    allowedCoordinateSpaces: ACTION_COORDINATE_SPACES,
    geometryGuardHandoffPolicy: "required",
    allowedSourceAbilityGroups: DEFAULT_SOURCE_ABILITY_GROUPS,
    requiredObservationKinds: ["save_button"],
  },
  "observe-comments-button": {
    childCapabilityId: "observe-comments-button",
    targetType: "comments_button",
    targetNature: "action",
    requireClickPoint: true,
    allowOperatorManual: false,
    allowedPageStateTypes: ["platform_feed"],
    allowedCandidateKinds: ACTION_CANDIDATE_KINDS,
    allowedCoordinateSpaces: ACTION_COORDINATE_SPACES,
    geometryGuardHandoffPolicy: "required",
    allowedSourceAbilityGroups: DEFAULT_SOURCE_ABILITY_GROUPS,
    requiredObservationKinds: ["comments_button"],
  },
  "observe-comments-panel": {
    childCapabilityId: "observe-comments-panel",
    targetType: "comments_panel",
    targetNature: "region",
    requireClickPoint: false,
    allowOperatorManual: false,
    allowedPageStateTypes: ["comments_panel"],
    allowedCandidateKinds: ACTION_CANDIDATE_KINDS,
    allowedCoordinateSpaces: REGION_COORDINATE_SPACES,
    geometryGuardHandoffPolicy: "optional",
    allowedSourceAbilityGroups: DEFAULT_SOURCE_ABILITY_GROUPS,
    requiredObservationKinds: ["comments_panel"],
  },
  "observe-close-comments-button": {
    childCapabilityId: "observe-close-comments-button",
    targetType: "close_comments_button",
    targetNature: "action",
    requireClickPoint: true,
    allowOperatorManual: false,
    allowedPageStateTypes: ["comments_panel"],
    allowedCandidateKinds: ACTION_CANDIDATE_KINDS,
    allowedCoordinateSpaces: ACTION_COORDINATE_SPACES,
    geometryGuardHandoffPolicy: "required",
    allowedSourceAbilityGroups: DEFAULT_SOURCE_ABILITY_GROUPS,
    requiredObservationKinds: ["close_comments_button"],
  },
  "observe-not-interested-button": {
    childCapabilityId: "observe-not-interested-button",
    targetType: "not_interested_button",
    targetNature: "action",
    requireClickPoint: true,
    allowOperatorManual: false,
    allowedPageStateTypes: ["platform_feed", "context_menu"],
    allowedCandidateKinds: ACTION_CANDIDATE_KINDS,
    allowedCoordinateSpaces: ACTION_COORDINATE_SPACES,
    geometryGuardHandoffPolicy: "required",
    allowedSourceAbilityGroups: DEFAULT_SOURCE_ABILITY_GROUPS,
    requiredObservationKinds: ["not_interested_button"],
  },
  "observe-next-video-region": {
    childCapabilityId: "observe-next-video-region",
    targetType: "next_video_region",
    targetNature: "region",
    requireClickPoint: false,
    allowOperatorManual: false,
    allowedPageStateTypes: ["platform_feed"],
    allowedCandidateKinds: ACTION_CANDIDATE_KINDS,
    allowedCoordinateSpaces: REGION_COORDINATE_SPACES,
    geometryGuardHandoffPolicy: "optional",
    allowedSourceAbilityGroups: DEFAULT_SOURCE_ABILITY_GROUPS,
    requiredObservationKinds: ["next_video_region"],
  },
  "observe-metric-like-count": {
    childCapabilityId: "observe-metric-like-count",
    targetType: "metric_like_count",
    targetNature: "metric",
    requireClickPoint: false,
    allowOperatorManual: false,
    allowedPageStateTypes: ["platform_feed", "comments_panel"],
    allowedCandidateKinds: METRIC_CANDIDATE_KINDS,
    allowedCoordinateSpaces: METRIC_COORDINATE_SPACES,
    geometryGuardHandoffPolicy: "forbidden",
    allowedSourceAbilityGroups: DEFAULT_SOURCE_ABILITY_GROUPS,
    requiredObservationKinds: ["metric_like_count"],
  },
  "observe-metric-comment-count": {
    childCapabilityId: "observe-metric-comment-count",
    targetType: "metric_comment_count",
    targetNature: "metric",
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
