import { dispatchExecutionAction, resolveFailureStatus } from "./muscle-memory-execution-dispatch.js";
import { MuscleMemoryExecutionResultSchema } from "./muscle-memory-execution.schema.js";
import type { ExecuteMuscleMemoryPlanInput } from "./muscle-memory-executor.types.js";

const buildExecutionFailureResult = (input: {
  status: "failed" | "review_required";
  failureReason: string;
  payloadRefs: ExecuteMuscleMemoryPlanInput["state"]["payloadRefs"];
  actionResults: Array<Awaited<ReturnType<typeof dispatchExecutionAction>>["actionResult"]>;
}) => MuscleMemoryExecutionResultSchema.parse({
  status: input.status,
  failureReason: input.failureReason,
  payloadRefs: input.payloadRefs,
  actionResults: input.actionResults,
});

export async function executeMuscleMemoryPlan(input: ExecuteMuscleMemoryPlanInput) {
  let payloadRefs = { ...input.state.payloadRefs };
  const actionResults: Array<Awaited<ReturnType<typeof dispatchExecutionAction>>["actionResult"]> = [];

  for (const [actionIndex, action] of input.plan.actions.entries()) {
    const dispatchedAction = await dispatchExecutionAction({
      executionInput: input,
      action,
      actionIndex,
      payloadRefs,
    });
    payloadRefs = dispatchedAction.nextPayloadRefs;
    actionResults.push(dispatchedAction.actionResult);

    const dispatchStatus = dispatchedAction.dispatchResult.status;
    if (dispatchStatus !== "success" && (action.required || action.onFailure !== "continue")) {
      return buildExecutionFailureResult({
        status: resolveFailureStatus(action, dispatchStatus),
        failureReason: dispatchedAction.dispatchResult.failureReason ?? `Muscle-memory action ${action.sourceActionCode} failed.`,
        payloadRefs,
        actionResults,
      });
    }
  }

  return MuscleMemoryExecutionResultSchema.parse({
    status: "success",
    failureReason: null,
    payloadRefs,
    actionResults,
  });
}