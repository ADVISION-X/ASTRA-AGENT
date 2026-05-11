// Visual Mission Runtime Inspector — config
// 12 structural checks for the Facebook seed video mining runtime wiring.

export const VISUAL_MISSION_RUNTIME_CONFIG = {
  // ── Source paths ──────────────────────────────────────────────────────────
  orchestrationSchemaPath: "src/capabilities/orchestration/schema.ts" as string,
  missionStatePath: "src/capabilities/orchestration/runtime/mission-state.ts" as string,
  childrenPath: "src/capabilities/orchestration/children.ts" as string,
  screenshotSchemaPath: "src/capabilities/screenshot/schema.ts" as string,
  captureBrowserViewportPath: "src/capabilities/screenshot/children/capture-browser-viewport.ts" as string,
  renderCoordinateGridPath: "src/capabilities/screenshot/children/render-coordinate-grid.ts" as string,
  missionLoopPath: "src/capabilities/orchestration/runtime/mission-loop-runner.ts" as string,
  aiPromptPath: "src/capabilities/ai/prompt/visual-mission-judge-prompt.ts" as string,
  dispatchSequencePath: "src/capabilities/orchestration/runtime/dispatch-sequence.ts" as string,

  // ── Tokens to verify ──────────────────────────────────────────────────────
  // MissionStateSchema platform target fields
  missionStateTargetFields: ["targetProfileRef", "targetUrl", "targetTitle"] as string[],

  // createInitialMissionState must accept these params
  missionStateCreateParams: ["targetProfileRef", "targetUrl", "targetTitle"] as string[],

  // children.ts must extract from initialPayload
  initialPayloadExtractToken: "initialPayload" as string,

  // screenshot schema fields
  aiReadableImagePathToken: "aiReadableImagePath" as string,

  // mission-loop-runner open gate tokens
  openGateTokens: ["open-platform-entry-once", "targetProfileRef", "openResultRef"] as string[],

  // mission-loop-runner AI filePath tokens
  aiFilePathTokens: ["originalAiPath", "gridAiPath", "aiReadableImagePath"] as string[],

  // mission-loop-runner platformContext from state
  platformContextStateToken: "state.targetUrl" as string,

  // AI prompt must throw if SAVE not found (no fallback)
  saveActionFallbackForbiddenToken: "?? scrollAction" as string,
  saveActionThrowToken: "throw new Error" as string,

  // dispatch-sequence context must include screenshotAbilityGroup
  screenshotAbilityGroupContextToken: "screenshotAbilityGroup: ScreenshotAbilityGroup" as string,

  // dispatch-sequence must track comment-panel attempts and log reason/gridCell
  clickTrackingToken: "commentPanelOpenAttempted" as string,
  postCommentScreenshotToken: "postCommentScreenshotRef" as string,
  abilityResultReasonToken: '"reason"' as string,
  abilityResultGridCellToken: '"gridCell"' as string,
};
