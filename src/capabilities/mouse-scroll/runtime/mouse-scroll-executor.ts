import type { MouseScrollCoordinateSpace, ParsedMouseScrollAbilityInput } from "../contract.js";
import { reserveMouseScrollExecution, runReservedMouseScrollExecution } from "./mouse-scroll-execution-reservation.js";
import { validateMouseScrollExecution } from "./mouse-scroll-execution-validator.js";
import type { MouseScrollExecutionContext } from "./mouse-scroll-runtime-context.js";

export async function executeMouseScroll(input: {
  request: ParsedMouseScrollAbilityInput;
  expectedCoordinateSpace: MouseScrollCoordinateSpace;
  context: MouseScrollExecutionContext;
}) {
  const validated = validateMouseScrollExecution(input);
  if (!validated.ok) {
    return validated.result;
  }

  const reserved = reserveMouseScrollExecution(validated.execution, input.context);
  if (!reserved.ok) {
    return reserved.result;
  }

  return runReservedMouseScrollExecution(reserved.execution, input);
}