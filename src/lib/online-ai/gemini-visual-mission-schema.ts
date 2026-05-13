const GEMINI_CELL_ZONE_VALUES = [
  "top_left",
  "top_center",
  "top_right",
  "middle_left",
  "middle_center",
  "center",
  "middle_right",
  "bottom_left",
  "bottom_center",
  "bottom_right",
] as const;

const GeminiPureVisualRoundNextActionSchema = {
  type: "OBJECT",
  properties: {
    actionCode: { type: "STRING" },
    reason: { type: "STRING" },
    gridCell: { type: "STRING", nullable: true },
    cellZone: { type: "STRING", enum: [...GEMINI_CELL_ZONE_VALUES], nullable: true },
    input: {
      type: "OBJECT",
      properties: {
        gridCell: { type: "STRING" },
        cellZone: { type: "STRING", enum: [...GEMINI_CELL_ZONE_VALUES] },
        approvedText: { type: "STRING" },
        approvedKey: { type: "STRING" },
      },
    },
  },
  required: ["actionCode", "reason", "input", "gridCell", "cellZone"],
} as const;

const GeminiVisualMissionResponseSchema = {
  type: "OBJECT",
  properties: {
    schemaVersion: { type: "STRING", enum: ["pureVisualRound.v1"] },
    goalMatched: { type: "BOOLEAN" },
    save: { type: "BOOLEAN" },
    saveReason: { type: "STRING" },
    confidence: { type: "NUMBER" },
    visualEvidence: { type: "ARRAY", items: { type: "STRING" } },
    decision: { type: "STRING", enum: ["act", "done", "review_required", "blocked"] },
    nextAction: {
      anyOf: [
        GeminiPureVisualRoundNextActionSchema,
        { type: "NULL" },
      ],
    },
    reviewRequiredReason: { type: "STRING", nullable: true },
    doneReason: { type: "STRING", nullable: true },
  },
  required: [
    "schemaVersion",
    "goalMatched",
    "save",
    "saveReason",
    "confidence",
    "visualEvidence",
    "decision",
    "nextAction",
    "reviewRequiredReason",
    "doneReason",
  ],
} as const;

export { GeminiVisualMissionResponseSchema };
