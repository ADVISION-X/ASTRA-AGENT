import { randomUUID } from "node:crypto";

import type { OrchestrationChildrenContext } from "../children-context.js";
import type { MissionState } from "../contract.js";
import { applyMissionStatus, getMissionState, setActiveMission, upsertMissionState } from "./mission-state.js";

const INITIAL_PLATFORM_ENTRY_SETTLE_WAIT_MS = 10_000;

type OpenInput = {
  ctx: OrchestrationChildrenContext;
  missionId: string;
  runId: string;
  roundId: string;
  sessionId: string;
  state: MissionState;
};

const shouldOpenInitialPlatformEntry = (state: MissionState): boolean =>
  (state.roundIndex ?? 0) === 0 && Boolean(state.targetUrl) && !state.openResultRef;

const waitForInitialPlatformEntrySettle = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, INITIAL_PLATFORM_ENTRY_SETTLE_WAIT_MS));

const emitOpenResult = (
  input: OpenInput,
  status: "success" | "failed" | "review_required",
  reason: string,
): void => {
  input.ctx.runtimeLogger.emit({
    traceId: input.missionId,
    level: status === "success" ? "info" : "warn",
    modeVisibility: ["FLOW", "DEBUG", "TRACE"],
    eventType: "OPEN_RESULT",
    owner: "orchestration",
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    status,
    reason,
  });
};

const emitSettle = (input: OpenInput, status: "started" | "success"): void => {
  input.ctx.runtimeLogger.emit({
    traceId: input.missionId,
    level: "debug",
    modeVisibility: ["DEBUG", "TRACE"],
    eventType: "OPEN_RESULT",
    owner: "orchestration",
    missionId: input.missionId,
    runId: input.runId,
    roundId: input.roundId,
    status,
    reason: `Initial platform entry settle wait ${status} durationMs=${INITIAL_PLATFORM_ENTRY_SETTLE_WAIT_MS}`,
  });
};

const failOpenGate = (missionId: string, reason: string): void => {
  upsertMissionState(applyMissionStatus(getMissionState(missionId), {
    status: "failed",
    failureReason: reason,
  }));
  setActiveMission(null);
};

const executeOpen = async (input: OpenInput) => {
  const openCallId = randomUUID();
  return input.ctx.openAbilityGroup.execute({
    childCapabilityId: "open-platform-entry-once",
    missionId: input.missionId,
    runId: input.runId,
    sessionId: input.sessionId,
    roundId: input.roundId,
    stepId: randomUUID(),
    capabilityCallId: openCallId,
    nerveBusEnvelopeId: openCallId,
    requestedBy: "orchestration:mission-loop",
    inputRef: randomUUID(),
    idempotencyKey: `open-entry:${input.missionId}:${input.runId}`,
    targetUrl: input.state.targetUrl ?? "",
    targetUrlSource: "platformRegistry",
    ...(input.state.targetProfileRef ? { targetProfileRef: input.state.targetProfileRef } : {}),
  });
};

export const maybeOpenInitialPlatformEntry = async (input: OpenInput): Promise<boolean> => {
  if (!shouldOpenInitialPlatformEntry(input.state)) return true;
  const result = await executeOpen(input);
  const okReason = `Opened targetUrl=${input.state.targetUrl}`;
  const failReason = `OPEN FAILED targetUrl=${input.state.targetUrl}: ${result.failureReason ?? "unknown"}`;
  emitOpenResult(input, result.status, result.status === "success" ? okReason : failReason);
  if (result.status !== "success") {
    failOpenGate(input.missionId, result.failureReason ?? "Open gate failed");
    return false;
  }
  upsertMissionState({ ...getMissionState(input.missionId), openResultRef: result.openResultRef });
  emitSettle(input, "started");
  await waitForInitialPlatformEntrySettle();
  emitSettle(input, "success");
  return true;
};
