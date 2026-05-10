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
  {
    actionCode: "SAVE_PRODUCT_AND_LIKE",
    steps: [
      { actionCode: "SAVE_LEAD" },
      { actionCode: "LIKE_CURRENT_VIDEO" },
    ],
  },
  {
    actionCode: "YES_SEEDING_VIDEO_FLOW",
    steps: [
      { actionCode: "SAVE_LEAD" },
      { actionCode: "LIKE_CURRENT_VIDEO" },
      { actionCode: "NEXT_VIDEO" },
    ],
  },
  {
    actionCode: "CLOSE_POPUP_AND_WAIT",
    steps: [
      { actionCode: "CLICK_CELL" },
      { actionCode: "WAIT_SHORT" },
    ],
  },
] as const;

export { MUSCLE_MEMORY_RECIPES };
export type { MuscleMemoryRecipeDefinition };