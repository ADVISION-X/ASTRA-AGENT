import type { GeometryGuardAbilityResult } from "../contract.js";

import type { GeometryExecutionInput } from "./geometry-execution-types.js";
import { runGeometryInputStages } from "./geometry-input-stages.js";
import { buildGeometrySuccessResult, runGeometryTransformStage } from "./geometry-transform-stage.js";

export function runGeometryExecutionPlan(input: GeometryExecutionInput): GeometryGuardAbilityResult {
  const validation = runGeometryInputStages(input);
  if (!validation.ok) {
    return validation.result;
  }

  const transformed = runGeometryTransformStage(input, validation.state);
  return transformed.ok ? buildGeometrySuccessResult(input, transformed.state) : transformed.result;
}