// Quality Kernel — minimal quality safety config.

export const QUALITY_KERNEL_LIMITS = {
  // Hard limit: scripts/audit total file count must not exceed this.
  // Enforces "大道至简" — do not grow the inspector universe.
  maxAuditFiles: 39,
  maxGeneratedFiles: 5,
  maxQualityKernelFiles: 5,
  moduleFileLimits: {
    "src/capabilities/mouse-click": 20,
    "src/muscle-memory": 5,
    "src/capabilities/ai": 20,
    "src/capabilities/commander-console": 70,  // baseline post-read-model-deletion; reduce incrementally
    "src/capabilities/forensics-persistence": 18,
    "src/capabilities/geometry-guard": 20,
    "src/capabilities/orchestration": 30,
    "src/capabilities/nerve-bus": 14,
    "src/lib/local-runtime": 20,
    "src/lib/online-ai": 8,
    "src/capabilities/screenshot": 20,
    "src/lib/storage": 8,
    "src/capabilities/text-input": 20,
    "src/capabilities/visual-target": 18,
    "src/capabilities/open": 18,
  } as Record<string, number>,
  // Directories that must NOT exist.
  retiredCapabilityRoots: [
    "src/capabilities/page-state",
    "src/capabilities/post-action-verification",
  ] as string[],
  // MuscleMemory must contain these action codes.
  requiredMuscleMemoryActionCodes: [
    "OPEN_PLATFORM_ENTRY_ONCE",
    "OPEN_LOCAL_WORKBENCH_ONCE",
    "LEFT_CLICK_GRID_CELL_ONCE",
    "DOUBLE_LEFT_CLICK_GRID_CELL",
    "RIGHT_CLICK_GRID_CELL_ONCE",
    "TYPE_APPROVED_TEXT_ONCE",
    "PRESS_APPROVED_KEY_ONCE",
    "CLEAR_FOCUSED_INPUT_ONCE",
  ] as string[],
  // MuscleMemory must NOT contain these action codes.
  forbiddenMuscleMemoryActionCodes: [
    "PREPARE_VISUAL_MISSION_INPUT",
    "WRITE_ACTION_LOG",
    "WRITE_AI_RESULT",
    "SAVE_LEAD",
    "product_yes",
    "CLICK_BROWSER_COORDINATE",
    "CLICK_CELL",
  ] as string[],
  // CI plan must not reference these strings.
  forbiddenCiPlanStrings: [
    "page-state-capability",
    "post-action-verification-capability",
  ] as string[],
} as const;
