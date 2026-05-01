import type { MouseScrollCoordinateSpace, ParsedMouseScrollAbilityInput } from "../contract.js";
import type { MouseScrollExecutionContext } from "./mouse-scroll-runtime-context.js";

export type MouseScrollExecutionInput = {
  request: ParsedMouseScrollAbilityInput;
  expectedCoordinateSpace: MouseScrollCoordinateSpace;
  context: MouseScrollExecutionContext;
};

export type MouseScrollExecutionSeed = ReturnType<typeof import("./mouse-scroll-input-gate.js").buildMouseScrollExecutionSeed>;