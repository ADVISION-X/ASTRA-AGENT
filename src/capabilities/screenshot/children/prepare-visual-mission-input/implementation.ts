import { DEFAULT_VISUAL_MISSION_GRID_COLUMN_COUNT, DEFAULT_VISUAL_MISSION_GRID_ROW_COUNT } from "../../shared/visual-mission-grid.js";
import { PrepareVisualMissionInputPlanSchema } from "./schema.js";
import type { PrepareVisualMissionInputChildCapability } from "./contract.js";

export const prepareVisualMissionInputChildCapability: PrepareVisualMissionInputChildCapability = {
  childCapabilityId: "prepare-visual-mission-input",
  async execute({ request }) {
    return PrepareVisualMissionInputPlanSchema.parse({
      kind: "image-processing",
      operation: "prepare-visual-mission-input",
      sourceFilePath: request.source.sourceStorageRef,
      sourceProof: request.source.sourceProof,
      rowCount: DEFAULT_VISUAL_MISSION_GRID_ROW_COUNT,
      columnCount: DEFAULT_VISUAL_MISSION_GRID_COLUMN_COUNT,
    });
  },
};