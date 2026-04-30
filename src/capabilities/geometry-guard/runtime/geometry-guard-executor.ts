import type {
  GeometryGuardAbilityContext,
  GeometryGuardAbilityResult,
  ParsedGeometryGuardAbilityInput,
} from "../contract.js";
import { dispatchGeometryGuardFailure } from "./geometry-dispatch-failure.js";
import { runGeometryExecutionPlan } from "./geometry-execution-plan.js";

export async function executeGeometryGuardChild(input: {
  request: ParsedGeometryGuardAbilityInput;
  context: GeometryGuardAbilityContext;
}): Promise<GeometryGuardAbilityResult> {
  const started = input.context.clock.now();

  try {
    return runGeometryExecutionPlan({
      request: input.request,
      context: input.context,
      started,
    });
  } catch (error) {
    return dispatchGeometryGuardFailure({
      input: input.request,
      context: input.context,
      failureReason: "runtime_exception",
      status: "failed",
      statusMessage: error instanceof Error ? error.message : String(error),
      dataQualityFlags: [...input.request.dataQualityFlags, "runtime_exception"],
    });
  }
}
