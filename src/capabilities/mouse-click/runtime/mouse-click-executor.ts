import { runMouseClickPreflightStages, type MouseClickExecutorInput } from "./mouse-click-preflight-stages.js";
import { runMouseClickPrimitiveStage } from "./mouse-click-primitive-stage.js";

export async function executeMouseClick(input: MouseClickExecutorInput) {
  const preflight = runMouseClickPreflightStages(input);
  return preflight.ok
    ? runMouseClickPrimitiveStage(input, preflight.state)
    : preflight.result;
}