// Visual Mission Flow Inspector — config
// 10 structural checks that prove the form-submit → seed video mining flow is wired correctly.

export const VISUAL_MISSION_FLOW_CONFIG = {
  // Known forbidden actionCodes / field names
  forbiddenActionCodes: ["SAVE_LEAD", "CLICK_CELL", "OPEN_FACEBOOK_ENTRY", "OPEN_TIKTOK_ENTRY", "PREPARE_VISUAL_MISSION_INPUT"] as string[],

  // AI must NOT produce these fields in its output
  forbiddenAiOutputFields: ["abilityGroupId", "childCapabilityId"] as string[],

  // Task-start debug writer must not contain this no-op comment
  noOpSignature: "Task-start debug events are now silently dropped" as string,

  // RuntimeLogger wiring — these must appear together in workbench-assembly.ts
  runtimeLoggerTokens: ["createRuntimeLogger", "setDefaultRuntimeLogger"] as string[],

  // mission-loop-runner.ts must have screenshot → grid → AI → dispatch order
  // Uses childCapabilityId "render-coordinate-grid" (called directly, not via actionCode)
  roundLoopKeywords: ["screenshotAbilityGroup", "render-coordinate-grid", "aiAbilityGroup", "dispatchAbilityCommand"] as string[],

  // dispatch-sequence.ts must use findMuscleMemoryEntry (not hardcoded IDs)
  dispatchMuscleMemoryToken: "findMuscleMemoryEntry" as string,

  // Geometry Guard integration marker
  geometryGuardToken: "geometryGuard" as string,
  geometryGuardProofField: "requiresGeometryProof" as string,

  // Platform profile files
  platformProfiles: [
    "src/platforms/builtins/facebook-web.profile.ts",
    "src/platforms/builtins/tiktok-web.profile.ts",
  ] as string[],

  // Mission loop file path
  missionLoopPath: "src/capabilities/orchestration/runtime/mission-loop-runner.ts" as string,

  // dispatch-sequence path
  dispatchSequencePath: "src/capabilities/orchestration/runtime/dispatch-sequence.ts" as string,

  // handleStartMission host
  childrenPath: "src/capabilities/orchestration/children.ts" as string,

  // AI prompt path
  aiPromptPath: "src/capabilities/ai/prompt/visual-mission-judge-prompt.ts" as string,

  // Task-start debug writer path
  debugWriterPath: "src/lib/local-app-shell/task-start-debug-writer.ts" as string,

  // Workbench assembly path
  workbenchAssemblyPath: "src/lib/local-runtime/workbench-assembly.ts" as string,

  // MuscleMemory catalog path
  catalogPath: "src/muscle-memory/generated-catalog.json" as string,

  // SAVE_CURRENT_VIDEO_EVIDENCE_ONCE must be in catalog with allowedForAiActionPlan=true
  evidenceSaveActionCode: "SAVE_CURRENT_VIDEO_EVIDENCE_ONCE" as string,

  // handleStartMission fire-and-forget token
  fireAndForgetToken: "runMissionRoundLoop" as string,
};
