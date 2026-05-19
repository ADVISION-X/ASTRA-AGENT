import type { DispatchRegisteredAbilityActionInput } from "../contract.js";
import type { RuntimeLogger } from "../../../lib/runtime-logs/index.js";
import type { DispatchAction, DispatchSingleResult, DispatchStatus } from "./dispatch-types.js";

export const emitDispatchStarted = (
  input: DispatchRegisteredAbilityActionInput,
  runtimeLogger: RuntimeLogger,
): void => {
  const action = input.action;
  runtimeLogger.emit({
    traceId: input.missionId,
    level: "info",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    eventType: "CAPABILITY_DISPATCH_STARTED",
    owner: "orchestration",
    missionId: input.missionId,
    runId: input.runId,
    ...(input.roundId ? { roundId: input.roundId } : {}),
    status: "started",
    reason: `Dispatching ${action.actionCode}${action.gridCell ? ` at ${action.gridCell}` : ""}${action.cellZone ? ` zone=${action.cellZone}` : ""}`,
  });
};

export const emitDispatchCompleted = (
  input: DispatchRegisteredAbilityActionInput,
  result: DispatchSingleResult,
  runtimeLogger: RuntimeLogger,
): void => {
  const action = input.action;
  runtimeLogger.emit({
    traceId: input.missionId,
    level: result.status === "success" ? "info" : result.status === "review_required" ? "warn" : "error",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    eventType: result.status === "success" ? "CAPABILITY_DISPATCH_COMPLETED" : "CAPABILITY_DISPATCH_FAILED",
    owner: "orchestration",
    missionId: input.missionId,
    runId: input.runId,
    ...(input.roundId ? { roundId: input.roundId } : {}),
    status: result.status,
    reason: result.status === "success" ? successReason(action) : `${action.actionCode} ${result.status}: ${result.failureReason ?? "unknown"}`,
  });
};

export const emitAbilityActionResult = (
  input: DispatchRegisteredAbilityActionInput,
  action: DispatchAction,
  status: DispatchStatus,
  runtimeLogger: RuntimeLogger,
): void => {
  const eventType = action.actionCode.startsWith("TYPE_") || action.actionCode.startsWith("PRESS_")
    ? "TEXT_INPUT_RESULT"
    : "BROWSER_ACTION_RESULT";
  runtimeLogger.emit({
    traceId: input.missionId,
    level: status === "success" ? "debug" : "warn",
    modeVisibility: ["DEBUG", "TRACE"],
    eventType,
    owner: "orchestration",
    missionId: input.missionId,
    runId: input.runId,
    ...(input.roundId ? { roundId: input.roundId } : {}),
    status,
    reason: status === "success" ? `${action.actionCode} ok` : `${action.actionCode} ${status}`,
    refs: { actionCode: action.actionCode },
  });
};

const successReason = (action: DispatchAction): string =>
  `${action.actionCode} ok${action.gridCell ? ` at ${action.gridCell}` : ""}${action.cellZone ? ` zone=${action.cellZone}` : ""}`;
