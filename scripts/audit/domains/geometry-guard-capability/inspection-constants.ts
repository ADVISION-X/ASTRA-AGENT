const ROOT = "src/capabilities/geometry-guard";

export const geometryGuardInspectionConfig = {
  ROOT,
  CONTRACT_PATH: `${ROOT}/contract.ts`,
  SCHEMA_PATH: `${ROOT}/schema.ts`,
  SCHEMA_FOUNDATION_PATH: `${ROOT}/schema-foundation.ts`,
  SCHEMA_INPUT_PATH: `${ROOT}/schema-input.ts`,
  SCHEMA_RESULT_PATH: `${ROOT}/schema-result.ts`,
  SCHEMA_RUNTIME_PROOF_PATH: `${ROOT}/schema-runtime-proof.ts`,
  ABILITY_GROUP_PATH: `${ROOT}/ability-group.ts`,
  REGISTRY_PATH: `${ROOT}/registry.ts`,
  INDEX_PATH: `${ROOT}/index.ts`,
  TYPES_PATH: `${ROOT}/shared/geometry-types.ts`,
  CLOCK_PORT_PATH: `${ROOT}/ports/geometry-clock-port.ts`,
  CLOCK_PATH: `${ROOT}/runtime/geometry-clock.ts`,
  CHILD_FACTORY_PATH: `${ROOT}/runtime/geometry-child-capability.ts`,
  EXECUTOR_PATH: `${ROOT}/runtime/geometry-guard-executor.ts`,
  EXECUTION_PLAN_PATH: `${ROOT}/runtime/geometry-execution-plan.ts`,
  INPUT_STAGES_PATH: `${ROOT}/runtime/geometry-input-stages.ts`,
  TRANSFORM_STAGE_PATH: `${ROOT}/runtime/geometry-transform-stage.ts`,
  RESULT_BUILDER_PATH: `${ROOT}/runtime/geometry-result-builder.ts`,
  PROOF_BUILDER_PATH: `${ROOT}/runtime/geometry-proof-builder.ts`,
  REQUIRED_CHILDREN: ["validate-coordinate-space", "validate-bbox-integrity", "validate-click-point", "validate-scale-mapping", "map-ai-input-to-viewport", "map-region-to-source", "validate-browser-viewport-bounds", "validate-desktop-screen-bounds"],
  REQUIRED_FILES: [
    `${ROOT}/contract.ts`, `${ROOT}/schema.ts`, `${ROOT}/ability-group.ts`, `${ROOT}/registry.ts`, `${ROOT}/index.ts`, `${ROOT}/shared/geometry-types.ts`,
    `${ROOT}/shared/geometry-policy.ts`, `${ROOT}/shared/geometry-proof.ts`, `${ROOT}/shared/geometry-result.ts`, `${ROOT}/shared/geometry-failure.ts`, `${ROOT}/shared/geometry-transform.ts`,
    `${ROOT}/ports/geometry-clock-port.ts`, `${ROOT}/runtime/geometry-clock.ts`, `${ROOT}/runtime/geometry-input-gate.ts`, `${ROOT}/runtime/coordinate-space-gate.ts`, `${ROOT}/runtime/bounds-gate.ts`,
    `${ROOT}/runtime/scale-mapping-gate.ts`, `${ROOT}/runtime/click-safety-gate.ts`, `${ROOT}/runtime/geometry-transformer.ts`, `${ROOT}/runtime/geometry-child-capability.ts`,
    `${ROOT}/runtime/geometry-dispatch-failure.ts`, `${ROOT}/runtime/geometry-result-builder.ts`, `${ROOT}/runtime/geometry-proof-builder.ts`, `${ROOT}/runtime/geometry-guard-executor.ts`,
    `${ROOT}/children/validate-coordinate-space/implementation.ts`, `${ROOT}/children/validate-bbox-integrity/implementation.ts`, `${ROOT}/children/validate-click-point/implementation.ts`, `${ROOT}/children/validate-scale-mapping/implementation.ts`,
    `${ROOT}/children/map-ai-input-to-viewport/implementation.ts`, `${ROOT}/children/map-region-to-source/implementation.ts`, `${ROOT}/children/validate-browser-viewport-bounds/implementation.ts`, `${ROOT}/children/validate-desktop-screen-bounds/implementation.ts`,
  ],
  FORBIDDEN_FILES: [
    `${ROOT}/shared/bounds-utils.ts`, `${ROOT}/shared/coordinate-space.ts`, `${ROOT}/shared/failure.ts`, `${ROOT}/shared/guard-result.ts`, `${ROOT}/shared/runtime-proof.ts`, `${ROOT}/shared/scale-mapping.ts`,
  ],
  FORBIDDEN_IMPORT_SEGMENTS: [
    "browser/browser-controller", "types/platform-action", "types/visual-action", "capabilities/mouse-click", "mouse-click/", "capabilities/mouse-scroll", "mouse-scroll/", "capabilities/screenshot", "screenshot/", "capabilities/ai", "ai/", "features/platform-action", "local-runtime/platform-runtime-contract",
  ],
  FORBIDDEN_IDENTIFIERS: ["BrowserController", "PlatformActionType", "VisualTarget", "GeometryGuardCoordinateActionPlan", "TARGET_ACTION_ALLOWLIST", "fallbackMode"],
  FORBIDDEN_BUSINESS_LITERALS: ["open_comments", "continue_next", "click_not_interested", "capture_video_region", "capture_comment_region", "like_or_save_candidate"],
  FORBIDDEN_DRIFT_MARKERS: ["compat", "legacy", "bridge", "geometry-guard-v2"],
  REQUIRED_INPUT_FIELDS: [
    "abilityGroupId", "sessionId", "roundId", "videoVisitId", "requestedBy", "purpose", "sourceAbilityGroupId", "sourceChildCapabilityId", "inputRef", "sourceScreenshotEvidenceRef", "sourceTargetRef", "sourceAiResultRef", "sourceCoordinateSpace", "requestedExecutionSpace", "bbox", "clickPoint", "imageSize", "viewportSize", "screenSize", "deviceScaleFactor", "scaleMapping", "safetyPolicy", "dataQualityFlags",
  ],
  REQUIRED_SAFETY_POLICY_FIELDS: ["allowReviewRequired", "minimumConfidence", "coordinateConfidence", "requireSourceRef", "clickSafetyMarginPx", "roundingPolicy"],
  REQUIRED_RESULT_FIELDS: [
    "status", "abilityGroupId", "childCapabilityId", "sessionId", "roundId", "videoVisitId", "geometryGuardRef", "guardDecision", "output", "normalizedCoordinateSpace", "normalizedClickPoint", "normalizedBbox", "appliedScaleMapping", "sourceScreenshotEvidenceRef", "sourceTargetRef", "sourceAiResultRef", "failureReason", "reviewRequiredReason", "debugLogRef", "runtimeProof", "policyDecision", "boundsDecision", "scaleDecision", "transformDecision", "dataQualityFlags", "statusMessage", "startedAt", "endedAt", "durationMs",
  ],
  REQUIRED_RUNTIME_PROOF_FIELDS: [
    "proofId", "runId", "missionId", "sessionId", "roundId", "videoVisitId", "abilityGroupId", "childCapabilityId", "sourceAbilityGroupId", "sourceChildCapabilityId", "inputRef", "outputRef", "sourceScreenshotEvidenceRef", "sourceTargetRef", "sourceAiResultRef", "sourceCoordinateSpace", "requestedExecutionSpace", "normalizedCoordinateSpace", "sourceBounds", "targetBounds", "bboxBefore", "bboxAfter", "clickPointBefore", "clickPointAfter", "scaleMappingRef", "deviceScaleFactor", "startedAt", "endedAt", "durationMs", "status", "guardDecision", "failureReason", "reviewRequiredReason", "policyDecision", "boundsDecision", "scaleDecision", "transformDecision", "dataQualityFlags",
  ],
  REQUIRED_FAILURE_REASONS: [
    "input_schema_invalid", "unknown_child_capability", "click_point_in_safety_margin", "contact_sheet_coordinate_not_executable", "confidence_below_threshold", "source_bounds_missing", "target_bounds_missing", "source_coordinate_space_mismatch", "requested_execution_space_mismatch", "child_execution_mismatch", "coordinate_transform_failed", "output_schema_invalid", "runtime_exception",
  ],
  REQUIRED_COORDINATE_SPACES: ["browserViewport", "desktopScreen", "imageEvidence", "aiInput", "regionCrop", "contactSheet"],
} as const;
