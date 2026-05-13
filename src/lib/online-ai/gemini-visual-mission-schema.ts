const GEMINI_CELL_ZONE_VALUES = [
  "top_left",
  "top_center",
  "top_right",
  "middle_left",
  "center",
  "middle_right",
  "bottom_left",
  "bottom_center",
  "bottom_right",
] as const;

const GeminiVisualMissionActionSchema = {
  type: "OBJECT",
  properties: {
    actionCode: { type: "STRING" },
    required: { type: "BOOLEAN" },
    gridCell: { type: "STRING" },
    cellZone: { type: "STRING", enum: [...GEMINI_CELL_ZONE_VALUES] },
    input: {
      type: "OBJECT",
      properties: {
        gridCell: { type: "STRING" },
        cellZone: { type: "STRING", enum: [...GEMINI_CELL_ZONE_VALUES] },
        recordType: { type: "STRING" },
        evidenceLabel: { type: "STRING" },
        approvedText: { type: "STRING" },
        approvedKey: { type: "STRING" },
      },
    },
    reason: { type: "STRING" },
  },
  required: ["actionCode", "required", "reason"],
} as const;

const GeminiVisualMissionClickTargetSchema = {
  type: "OBJECT",
  properties: {
    gridCell: { type: "STRING" },
    targetName: { type: "STRING" },
  },
  required: ["gridCell", "targetName"],
} as const;

const GeminiVisualMissionResponseSchema = {
  type: "OBJECT",
  properties: {
    schemaVersion: { type: "STRING", enum: ["visualMissionActionPlan.v1"] },
    userIntentUnderstanding: {
      type: "OBJECT",
      properties: {
        matched: { type: "BOOLEAN" },
        summary: { type: "STRING" },
      },
      required: ["matched", "summary"],
    },
    platform: { type: "STRING", enum: ["facebook-web", "tiktok-web"] },
    isTargetPlatform: { type: "BOOLEAN" },
    surface: { type: "STRING" },
    isTargetFeed: { type: "BOOLEAN" },
    pageStateDecision: { type: "STRING", enum: ["ready", "recover", "review_required", "blocked"] },
    isProductVideo: { type: "BOOLEAN" },
    productDecision: { type: "STRING", enum: ["product_yes", "product_no", "uncertain"] },
    confidence: { type: "NUMBER" },
    visibleProductTypes: { type: "ARRAY", items: { type: "STRING" } },
    visualEvidence: { type: "ARRAY", items: { type: "STRING" } },
    reason: { type: "STRING" },
    actions: { type: "ARRAY", items: GeminiVisualMissionActionSchema },
    nonExecutableClickTargets: { type: "ARRAY", items: GeminiVisualMissionClickTargetSchema },
    riskFlags: { type: "ARRAY", items: { type: "STRING" } },
    nonExecutableSummary: { type: "STRING" },
  },
  required: [
    "schemaVersion",
    "userIntentUnderstanding",
    "platform",
    "isTargetPlatform",
    "surface",
    "isTargetFeed",
    "pageStateDecision",
    "isProductVideo",
    "productDecision",
    "confidence",
    "visibleProductTypes",
    "visualEvidence",
    "reason",
    "actions",
    "nonExecutableClickTargets",
    "riskFlags",
    "nonExecutableSummary",
  ],
} as const;

export { GeminiVisualMissionResponseSchema };
