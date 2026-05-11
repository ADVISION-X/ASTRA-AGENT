import { z } from "zod";

const MUSCLE_MEMORY_PRESS_KEY_ALLOWLIST = ["L", "ArrowDown", "ArrowUp", "Escape", "Enter", "Tab"] as const;
const MuscleMemoryGridCellSchema = z.string().regex(/^[A-Z]+[1-9]\d*$/u, "gridCell must use governed cell coordinates like A30 or C50.");
const MuscleMemoryPressKeySchema = z.enum(MUSCLE_MEMORY_PRESS_KEY_ALLOWLIST);

export {
  MUSCLE_MEMORY_PRESS_KEY_ALLOWLIST,
  MuscleMemoryGridCellSchema,
  MuscleMemoryPressKeySchema,
};
