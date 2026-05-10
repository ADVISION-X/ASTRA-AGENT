import type { MuscleMemoryActionCode } from "./action-code.js";

type MuscleMemoryRecipeDefinition = {
  actionCode: MuscleMemoryActionCode;
  steps: Array<{ actionCode: MuscleMemoryActionCode; input?: Record<string, unknown> }>;
};

const MUSCLE_MEMORY_RECIPES: readonly MuscleMemoryRecipeDefinition[] = [
  {
    actionCode: "FOCUS_CURRENT_SURFACE",
    steps: [{ actionCode: "PRESS_KEY", input: { key: "Tab" } }],
  },
  {
    actionCode: "LIKE_CURRENT_VIDEO",
    steps: [
      { actionCode: "FOCUS_CURRENT_SURFACE" },
      { actionCode: "PRESS_KEY", input: { key: "L" } },
    ],
  },
  {
    actionCode: "NEXT_VIDEO",
    steps: [
      { actionCode: "FOCUS_CURRENT_SURFACE" },
      { actionCode: "PRESS_KEY", input: { key: "ArrowDown" } },
    ],
  },
] as const;

export { MUSCLE_MEMORY_RECIPES };
export type { MuscleMemoryRecipeDefinition };