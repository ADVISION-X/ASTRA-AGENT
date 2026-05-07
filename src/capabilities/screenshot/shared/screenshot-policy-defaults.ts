const SCREENSHOT_POLICY_DEFAULTS = {
  aiInputMaxWidth: 768,
  maxDurationMs: 60_000,
  contentLineLimit: 12,
  contentLineLength: 200,
  maxArtifactsPerVideoVisit: 30,
  maxArtifactsPerRound: 80,
  maxArtifactsPerMission: 500,
  maxBytesPerVideoVisit: 150 * 1024 * 1024,
  maxBytesPerRound: 500 * 1024 * 1024,
  maxBytesPerMission: 2 * 1024 * 1024 * 1024,
  maxPendingTransientBytes: 500 * 1024 * 1024,
  maxPendingTransientArtifacts: 80,
  transientTtlHours: 24,
  diagnosticTtlHours: 24 * 7,
} as const;

const SCREENSHOT_ARTIFACT_BUDGET_POLICY = {
  maxArtifactsPerMission: SCREENSHOT_POLICY_DEFAULTS.maxArtifactsPerMission,
  maxArtifactsPerRound: SCREENSHOT_POLICY_DEFAULTS.maxArtifactsPerRound,
  maxArtifactsPerVideoVisit: SCREENSHOT_POLICY_DEFAULTS.maxArtifactsPerVideoVisit,
  maxBytesPerMission: SCREENSHOT_POLICY_DEFAULTS.maxBytesPerMission,
  maxBytesPerRound: SCREENSHOT_POLICY_DEFAULTS.maxBytesPerRound,
  maxBytesPerVideoVisit: SCREENSHOT_POLICY_DEFAULTS.maxBytesPerVideoVisit,
  maxPendingTransientBytes: SCREENSHOT_POLICY_DEFAULTS.maxPendingTransientBytes,
  maxPendingTransientArtifacts: SCREENSHOT_POLICY_DEFAULTS.maxPendingTransientArtifacts,
  transientTtlHours: SCREENSHOT_POLICY_DEFAULTS.transientTtlHours,
  diagnosticDebugTtlHours: SCREENSHOT_POLICY_DEFAULTS.diagnosticTtlHours,
} as const;

const SCREENSHOT_ARTIFACT_BUDGET_SNAPSHOT = {
  currentArtifactsPerMission: 0,
  currentArtifactsPerRound: 0,
  currentArtifactsPerVideoVisit: 0,
  currentBytesPerMission: 0,
  currentBytesPerRound: 0,
  currentBytesPerVideoVisit: 0,
  pendingTransientBytes: 0,
  pendingTransientArtifacts: 0,
} as const;

export const DEFAULT_AI_INPUT_MAX_WIDTH = SCREENSHOT_POLICY_DEFAULTS.aiInputMaxWidth;
export const DEFAULT_SCREENSHOT_ARTIFACT_BUDGET_POLICY = SCREENSHOT_ARTIFACT_BUDGET_POLICY;
export const DEFAULT_SCREENSHOT_ARTIFACT_BUDGET_SNAPSHOT = SCREENSHOT_ARTIFACT_BUDGET_SNAPSHOT;