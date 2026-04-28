export const GEOMETRY_GUARD_ABILITY_GROUP_ID = "geometry-guard";
export const GEOMETRY_GUARD_CHILD_CAPABILITY_IDS = [
  "validate-coordinate-space",
  "validate-bbox-integrity",
  "validate-click-point",
  "validate-scale-mapping",
  "map-ai-input-to-viewport",
  "map-region-to-source",
  "validate-browser-viewport-bounds",
  "validate-desktop-screen-bounds",
] as const;
export const GEOMETRY_GUARD_COORDINATE_SPACES = [
  "browserViewport",
  "desktopScreen",
  "imageEvidence",
  "aiInput",
  "regionCrop",
  "contactSheet",
] as const;
export const GEOMETRY_GUARD_FAILURE_REASONS = [
  "missing_requested_by",
  "missing_purpose",
  "missing_coordinate_space",
  "missing_source_ref",
  "missing_bbox",
  "invalid_bbox",
  "missing_click_point",
  "invalid_click_point",
  "click_point_outside_bbox",
  "bbox_out_of_bounds",
  "missing_scale_mapping",
  "invalid_scale_mapping",
  "contact_sheet_coordinate_not_executable",
  "ai_input_mapping_required",
  "region_mapping_required",
  "execution_space_missing",
  "device_scale_factor_missing",
  "geometry_review_required",
] as const;

export type GeometryGuardAbilityGroupId = typeof GEOMETRY_GUARD_ABILITY_GROUP_ID;
export type GeometryGuardChildCapabilityId = typeof GEOMETRY_GUARD_CHILD_CAPABILITY_IDS[number];
export type GeometryGuardCoordinateSpace = typeof GEOMETRY_GUARD_COORDINATE_SPACES[number];
export type GeometryGuardExecutionSpace = Extract<GeometryGuardCoordinateSpace, "browserViewport" | "desktopScreen">;
export type GeometryGuardAbilityStatus = "success" | "failed" | "review_required";
export type GeometryGuardDecision = "allow" | "block" | "review_required";
export type GeometryGuardFailureReason = typeof GEOMETRY_GUARD_FAILURE_REASONS[number];

export type GeometryGuardPoint = {
  x: number;
  y: number;
};

export type GeometryGuardBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type GeometryGuardSize = {
  width: number;
  height: number;
};

export type GeometryGuardScaleMapping = {
  sourceCoordinateSpace: Exclude<GeometryGuardCoordinateSpace, "browserViewport" | "desktopScreen" | "contactSheet">;
  targetCoordinateSpace: GeometryGuardExecutionSpace;
  cropOffsetX: number;
  cropOffsetY: number;
  scaleX: number;
  scaleY: number;
  targetWidth: number;
  targetHeight: number;
};

export type GeometryGuardSafetyPolicy = {
  allowReviewRequired: boolean;
  minimumConfidence: number | null;
  coordinateConfidence: number | null;
  requireSourceRef: boolean;
};

export type GeometryGuardRuntimeProof = {
  abilityGroupId: GeometryGuardAbilityGroupId;
  childCapabilityId: GeometryGuardChildCapabilityId;
  geometryGuardRef: string;
  guardDecision: GeometryGuardDecision;
  sourceCoordinateSpace: GeometryGuardCoordinateSpace;
  normalizedCoordinateSpace: GeometryGuardExecutionSpace | null;
  sourceRefs: string[];
};

export type GeometryGuardAbilityInput = {
  abilityGroupId: GeometryGuardAbilityGroupId;
  childCapabilityId: GeometryGuardChildCapabilityId;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  requestedBy: string;
  purpose: string;
  sourceScreenshotEvidenceRef: string | null;
  sourceTargetRef: string | null;
  sourceAiResultRef: string | null;
  sourceCoordinateSpace: GeometryGuardCoordinateSpace;
  requestedExecutionSpace: GeometryGuardExecutionSpace;
  bbox: GeometryGuardBoundingBox | null;
  clickPoint: GeometryGuardPoint | null;
  imageSize: GeometryGuardSize | null;
  viewportSize: GeometryGuardSize | null;
  screenSize: GeometryGuardSize | null;
  deviceScaleFactor: number | null;
  scaleMapping: GeometryGuardScaleMapping | null;
  safetyPolicy: GeometryGuardSafetyPolicy;
  dataQualityFlags: string[];
};

export type GeometryGuardAbilityResult = {
  status: GeometryGuardAbilityStatus;
  abilityGroupId: GeometryGuardAbilityGroupId;
  childCapabilityId: GeometryGuardChildCapabilityId;
  sessionId: string;
  roundId: string | null;
  videoVisitId: string | null;
  geometryGuardRef: string;
  guardDecision: GeometryGuardDecision;
  normalizedCoordinateSpace: GeometryGuardExecutionSpace | null;
  normalizedClickPoint: GeometryGuardPoint | null;
  normalizedBbox: GeometryGuardBoundingBox | null;
  appliedScaleMapping: GeometryGuardScaleMapping | null;
  sourceScreenshotEvidenceRef: string | null;
  sourceTargetRef: string | null;
  sourceAiResultRef: string | null;
  failureReason: GeometryGuardFailureReason | null;
  debugLogRef: string | null;
  runtimeProof: GeometryGuardRuntimeProof;
  dataQualityFlags: string[];
  statusMessage: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
};

export type GeometryGuardAbilityContext = Record<string, never>;

export interface GeometryGuardChildCapability {
  readonly abilityGroupId: GeometryGuardAbilityGroupId;
  readonly childCapabilityId: GeometryGuardChildCapabilityId;

  execute(
    input: GeometryGuardAbilityInput,
    context: GeometryGuardAbilityContext,
  ): Promise<GeometryGuardAbilityResult>;
}

export interface GeometryGuardAbilityGroup {
  listChildCapabilityIds(): GeometryGuardChildCapabilityId[];
  execute(input: GeometryGuardAbilityInput): Promise<GeometryGuardAbilityResult>;
}