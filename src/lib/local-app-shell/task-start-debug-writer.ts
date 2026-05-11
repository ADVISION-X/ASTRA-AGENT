import { emitRuntimeLog } from "../runtime-logs/logger.js";
import { RuntimeLogEventType } from "../runtime-logs/event-types.js";

type CommanderDebugInput = {
  eventType?: string;
  traceId?: string;
  missionId?: string | null;
  runId?: string;
  actionableMessage?: string | null;
  status?: string;
  reason?: string;
  attemptId?: string;
  spanId?: string;
  ownerResponsible?: string | null;
  failureReason?: string | null;
  refs?: unknown;
  proofRefs?: unknown;
};

const EVENT_TYPE_MAP: Record<string, string> = {
  HUMAN_COMMAND_DRAFTED: RuntimeLogEventType.HUMAN_COMMAND_RECEIVED,
  HUMAN_COMMAND_RECEIVED: RuntimeLogEventType.HUMAN_COMMAND_RECEIVED,
  HUMAN_COMMAND_VALIDATED: RuntimeLogEventType.HUMAN_COMMAND_VALIDATED,
  COMMAND_ACCEPTED: RuntimeLogEventType.HUMAN_COMMAND_VALIDATED,
  COMMAND_REJECTED: RuntimeLogEventType.HUMAN_COMMAND_REJECTED,
  MISSION_PREFLIGHT_PASSED: RuntimeLogEventType.MISSION_PREFLIGHT_PASSED,
  MISSION_PREFLIGHT_FAILED: RuntimeLogEventType.MISSION_PREFLIGHT_FAILED,
};

export const recordTaskStartDebugEvent = (
  _activeWorkbench: unknown,
  input: CommanderDebugInput,
): void => {
  const rawType = input.eventType;
  const eventType = (rawType ? (EVENT_TYPE_MAP[rawType] ?? RuntimeLogEventType.HUMAN_COMMAND_RECEIVED) : RuntimeLogEventType.HUMAN_COMMAND_RECEIVED) as typeof RuntimeLogEventType[keyof typeof RuntimeLogEventType];

  const { missionId, runId, actionableMessage, reason, attemptId, spanId, ownerResponsible, failureReason } = input;
  const rawStatus = input.status;
  const validStatuses = ["started", "success", "failed", "review_required", "skipped"] as const;
  type ValidStatus = typeof validStatuses[number];
  const status = (rawStatus && (validStatuses as readonly string[]).includes(rawStatus))
    ? (rawStatus as ValidStatus)
    : undefined;

  emitRuntimeLog({
    eventType,
    traceId: input.traceId ?? "unknown",
    level: rawStatus === "failed" ? "error" : "debug",
    modeVisibility: ["DEBUG", "TRACE"],
    owner: "commander-console",
    ...(missionId ? { missionId } : {}),
    ...(runId ? { runId } : {}),
    reason: reason ?? rawType ?? "task-start event",
    ...(actionableMessage ? { actionableMessage } : {}),
    ...(status ? { status } : {}),
    payload: {
      attemptId,
      spanId,
      ownerResponsible,
      ...(failureReason ? { failureReason } : {}),
    },
  });
};