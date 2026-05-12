import { z } from "zod";

const MUSCLE_MEMORY_PRESS_KEY_ALLOWLIST = ["L", "ArrowDown", "ArrowUp", "Escape", "Enter", "Tab"] as const;
const MUSCLE_MEMORY_CELL_ZONE_ALLOWLIST = [
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
const MuscleMemoryGridCellSchema = z.string().regex(/^[A-Z]+[1-9]\d*$/u, "gridCell must use governed cell coordinates like A30 or C50.");
const MuscleMemoryPressKeySchema = z.enum(MUSCLE_MEMORY_PRESS_KEY_ALLOWLIST);
const MuscleMemoryCellZoneSchema = z.enum(MUSCLE_MEMORY_CELL_ZONE_ALLOWLIST);

export {
  MUSCLE_MEMORY_CELL_ZONE_ALLOWLIST,
  MUSCLE_MEMORY_PRESS_KEY_ALLOWLIST,
  MuscleMemoryCellZoneSchema,
  MuscleMemoryGridCellSchema,
  MuscleMemoryPressKeySchema,
};
