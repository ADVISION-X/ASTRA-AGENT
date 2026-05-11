import { emitRuntimeLog } from "../runtime-logs/logger.js";
import { RuntimeLogEventType } from "../runtime-logs/event-types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CommanderDebugInput = Record<string, any>;

const EVENT_TYPE_MAP: Record<string, string> = {
  HUMAN_COMMAND_DRAFTED: RuntimeLogEventType.HUMAN_COMMAND_RECEIVED,
  HUMAN_COMMAND_RECEIVED: RuntimeLogEventType.HUMAN_COMMAND_RECEIVED,
  HUMAN_COMMAND_VALIDATED: RuntimeLogEventType.HUMAN_COMMAND_VALIDATED,
  COMMAND_ACCEPTED: RuntimeLogEventType.HUMAN_COMMAND_VALIDATED,
  COMMAND_REJECTED: RuntimeLogEventType.HUMAN_COMMAND_REJECTED,
  MISSION_PREFLIGHT_PASSED: RuntimeLogEventType.MISSION_STARTED,
  MISSION_PREFLIGHT_FAILED: RuntimeLogEventType.MISSION_PREFLIGHT_FAILED,
};

export const recordTaskStartDebugEvent = (
  _activeWorkbench: unknown,
  input: CommanderDebugInput,
): void => {
  const rawType = input.eventType as string | undefined;
  const eventType = (rawType ? (EVENT_TYPE_MAP[rawType] ?? RuntimeLogEventType.HUMAN_COMMAND_RECEIVED) : RuntimeLogEventType.HUMAN_COMMAND_RECEIVED) as typeof RuntimeLogEventType[keyof typeof RuntimeLogEventType];

  const missionId = input.missionId as string | undefined;
  const runId = input.runId as string | undefined;
  const actionableMessage = input.actionableMessage as string | undefined;
  const rawStatus = input.status as string | undefined;
  const validStatuses = ["started", "success", "failed", "review_required", "skipped"] as const;
  type ValidStatus = typeof validStatuses[number];
  const status = (rawStatus && (validStatuses as readonly string[]).includes(rawStatus))
    ? (rawStatus as ValidStatus)
    : undefined;

  emitRuntimeLog({
    eventType,
    traceId: (input.traceId as string | undefined) ?? "unknown",
    level: rawStatus === "failed" ? "error" : "debug",
    modeVisibility: ["DEBUG", "TRACE"],
    owner: "commander-console",
    ...(missionId ? { missionId } : {}),
    ...(runId ? { runId } : {}),
    reason: (input.reason as string | undefined) ?? rawType ?? "task-start event",
    ...(actionableMessage ? { actionableMessage } : {}),
    ...(status ? { status } : {}),
    payload: {
      attemptId: input.attemptId,
      spanId: input.spanId,
      ownerResponsible: input.ownerResponsible,
      ...(input.failureReason ? { failureReason: input.failureReason } : {}),
    },
  });
};