import type { AiRequestEnvelope, CommandEnvelope } from "../nerve-bus/shared/envelope.js";
import type { NerveBusAbilityGroup } from "../nerve-bus/contract.js";
import { createAbilityRoster } from "./ability-roster.js";
import type {
  HumanCommandKind,
  MissionCommand,
  MissionControlState,
  MissionExecutionResult,
  MissionReviewDecisionInput,
  MissionRuntimeSnapshot,
  OrchestrationAbilityGroup,
  OrchestrationMissionRuntimeController,
} from "./contract.js";
import { createMapDebugProof, createMissionState, advanceMissionState } from "./mission-state.js";
import { createOperationalMapRegistry } from "./map-registry.js";
import { evaluateStepTransition } from "./shared/transition-evaluator.js";
import type { OperationalMap, OperationalMapId } from "./shared/map-types.js";

function selectMapId(command: MissionCommand): OperationalMapId {
  if (command.preferredMapId) {
    return command.preferredMapId;
  }

  return command.requestedPlatform === "facebook-web"
    ? "facebook-product-discovery-map"
    : "tiktok-product-discovery-map";
}

function buildCommandEnvelope(command: MissionCommand, map: OperationalMap, stepId: string, commandName: string, payload: Record<string, unknown>, createdAt: string): CommandEnvelope {
  return {
    envelopeId: `${command.missionId}:${stepId}:command`,
    commandId: `${command.missionId}:${stepId}`,
    missionId: command.missionId,
    mapId: map.mapId,
    stepId,
    from: "orchestration",
    to: map.steps.find((step) => step.stepId === stepId)?.targetAbilityGroupId ?? "open",
    commandName,
    payloadRef: Object.keys(payload),
    payload,
    createdAt,
  };
}

function buildAiRequestEnvelope(command: MissionCommand, map: OperationalMap, stepId: string, commandName: string, payload: Record<string, unknown>, createdAt: string): AiRequestEnvelope {
  return {
    envelopeId: `${command.missionId}:${stepId}:ai-request`,
    requestId: `${command.missionId}:${stepId}:ai`,
    missionId: command.missionId,
    mapId: map.mapId,
    stepId,
    from: "orchestration",
    to: "local-ai-decision",
    taskType: commandName,
    promptRef: `${map.mapId}:${commandName}`,
    payloadRef: Object.keys(payload),
    payload,
    createdAt,
  };
}

function createInitialMissionControlState(): MissionControlState {
  return {
    missionId: null,
    mapId: null,
    requestedPlatform: null,
    humanGoal: null,
    status: "idle",
    activeTaskRunId: null,
    currentRoundIndex: 0,
    reviewRequiredReason: null,
    failureReason: null,
    lastHumanCommand: null,
    startedAt: null,
    updatedAt: null,
    endedAt: null,
  };
}

function applyRuntimeSnapshot(input: {
  previousState: MissionControlState;
  runtimeSnapshot: MissionRuntimeSnapshot;
  commandKind: HumanCommandKind | null;
  now: string;
}): MissionControlState {
  const task = input.runtimeSnapshot.task;
  const nextStatus = task?.status
    ?? (input.commandKind === "stop-mission" || input.commandKind === "emergency-stop"
      ? "stopped"
      : input.previousState.status);
  const endedAt = nextStatus === "running" || nextStatus === "paused"
    ? null
    : input.previousState.missionId
      ? input.now
      : input.previousState.endedAt;

  return {
    ...input.previousState,
    status: nextStatus,
    activeTaskRunId: task?.taskRunId ?? null,
    currentRoundIndex: task?.currentRoundIndex ?? input.previousState.currentRoundIndex,
    reviewRequiredReason: input.runtimeSnapshot.reviewRequiredReason,
    failureReason: input.runtimeSnapshot.failureReason,
    lastHumanCommand: input.commandKind,
    updatedAt: input.now,
    endedAt,
  };
}

async function syncMissionControlState(input: {
  missionState: MissionControlState;
  commandKind: HumanCommandKind | null;
  runtimeController: OrchestrationMissionRuntimeController | undefined;
  now: () => string;
}): Promise<MissionControlState> {
  if (!input.runtimeController) {
    return {
      ...input.missionState,
      lastHumanCommand: input.commandKind,
      updatedAt: input.now(),
      endedAt: input.missionState.status === "running" || input.missionState.status === "paused"
        ? null
        : input.missionState.endedAt,
    };
  }

  const runtimeSnapshot = await input.runtimeController.getRuntimeSnapshot(input.missionState.missionId);
  return applyRuntimeSnapshot({
    previousState: input.missionState,
    runtimeSnapshot,
    commandKind: input.commandKind,
    now: input.now(),
  });
}

function createMissionControlState(command: MissionCommand, mapId: OperationalMapId, startedAt: string): MissionControlState {
  return {
    missionId: command.missionId,
    mapId,
    requestedPlatform: command.requestedPlatform,
    humanGoal: command.humanGoal,
    status: "running",
    activeTaskRunId: null,
    currentRoundIndex: 0,
    reviewRequiredReason: null,
    failureReason: null,
    lastHumanCommand: "start-mission",
    startedAt,
    updatedAt: startedAt,
    endedAt: null,
  };
}

export function createOrchestrationAbilityGroup(input: {
  nerveBus: NerveBusAbilityGroup;
  runtimeController?: OrchestrationMissionRuntimeController;
  now?: () => string;
}): OrchestrationAbilityGroup {
  const now = input.now ?? (() => new Date().toISOString());
  const roster = createAbilityRoster();
  const mapRegistry = createOperationalMapRegistry();
  let missionControlState = createInitialMissionControlState();

  return {
    listMapIds() {
      return [...mapRegistry.keys()];
    },
    getAbilityRoster() {
      return [...roster.keys()];
    },
    async executeMission(command): Promise<MissionExecutionResult> {
      const map = mapRegistry.get(selectMapId(command));
      if (!map) {
        throw new Error(`No operational map is registered for mission ${command.missionId}`);
      }

      let missionState = createMissionState(command, map);
      const debugProof = [];
      const maxHops = map.steps.length * 3;
      let hops = 0;

      while (missionState.currentStepId && missionState.status === "running") {
        const step = map.steps.find((candidate) => candidate.stepId === missionState.currentStepId);
        if (!step) {
          throw new Error(`Operational map ${map.mapId} is missing step ${missionState.currentStepId}`);
        }

        const payload = {
          ...command.initialPayload,
          missionId: missionState.missionId,
          stepId: step.stepId,
          mapId: map.mapId,
          humanGoal: command.humanGoal,
        };
        const createdAt = now();
        const selectedAbilityGroupId = step.targetAbilityGroupId;
        const result = selectedAbilityGroupId === "local-ai-decision"
          ? await input.nerveBus.requestAi(buildAiRequestEnvelope(command, map, step.stepId, step.commandName, payload, createdAt))
          : await input.nerveBus.dispatchAbilityCommand(buildCommandEnvelope(command, map, step.stepId, step.commandName, payload, createdAt));
        const envelope = "responseEnvelope" in result ? result.responseEnvelope : result.resultEnvelope;
        const commandId = "requestEnvelope" in result ? result.requestEnvelope.requestId : result.commandEnvelope.commandId;
        const resultId = "responseEnvelope" in result ? result.responseEnvelope.responseId : result.resultEnvelope.resultId;
        const branch = evaluateStepTransition(map, step, envelope);

        debugProof.push(createMapDebugProof({ missionState, map, selectedAbilityGroupId, commandId, resultId, branch }));
        missionState = advanceMissionState({ missionState, selectedAbilityGroupId, commandId, resultId, branch });
        hops += 1;

        if (hops > maxHops) {
          missionState = { ...missionState, status: "failed", currentStepId: null };
        }
      }

      return {
        missionState,
        debugProof,
        finalStatus: missionState.status,
      };
    },
    async startMission(command) {
      const startedAt = now();
      missionControlState = createMissionControlState(command, selectMapId(command), startedAt);

      if (!input.runtimeController) {
        return missionControlState;
      }

      const runtimeSnapshot = await input.runtimeController.startMission(command);
      missionControlState = applyRuntimeSnapshot({
        previousState: missionControlState,
        runtimeSnapshot,
        commandKind: "start-mission",
        now: now(),
      });
      return missionControlState;
    },
    async pauseMission(missionId) {
      if (missionControlState.missionId !== missionId) {
        return syncMissionControlState({
          missionState: missionControlState,
          commandKind: null,
          runtimeController: input.runtimeController,
          now,
        });
      }

      if (!input.runtimeController) {
        missionControlState = {
          ...missionControlState,
          status: "paused",
          lastHumanCommand: "pause-mission",
          updatedAt: now(),
        };
        return missionControlState;
      }

      missionControlState = applyRuntimeSnapshot({
        previousState: missionControlState,
        runtimeSnapshot: await input.runtimeController.pauseMission(missionId),
        commandKind: "pause-mission",
        now: now(),
      });
      return missionControlState;
    },
    async resumeMission(missionId) {
      if (missionControlState.missionId !== missionId) {
        return syncMissionControlState({
          missionState: missionControlState,
          commandKind: null,
          runtimeController: input.runtimeController,
          now,
        });
      }

      if (!input.runtimeController) {
        missionControlState = {
          ...missionControlState,
          status: "running",
          lastHumanCommand: "resume-mission",
          updatedAt: now(),
          endedAt: null,
        };
        return missionControlState;
      }

      missionControlState = applyRuntimeSnapshot({
        previousState: missionControlState,
        runtimeSnapshot: await input.runtimeController.resumeMission(missionId),
        commandKind: "resume-mission",
        now: now(),
      });
      return missionControlState;
    },
    async stopMission({ missionId, reason }) {
      if (missionControlState.missionId !== missionId) {
        return syncMissionControlState({
          missionState: missionControlState,
          commandKind: null,
          runtimeController: input.runtimeController,
          now,
        });
      }

      if (!input.runtimeController) {
        missionControlState = {
          ...missionControlState,
          status: "stopped",
          failureReason: reason ?? null,
          lastHumanCommand: "stop-mission",
          updatedAt: now(),
          endedAt: now(),
        };
        return missionControlState;
      }

      missionControlState = applyRuntimeSnapshot({
        previousState: missionControlState,
        runtimeSnapshot: await input.runtimeController.stopMission({
          missionId,
          reason: reason ?? "stop requested by operator",
        }),
        commandKind: "stop-mission",
        now: now(),
      });
      return missionControlState;
    },
    async emergencyStop({ missionId, reason }) {
      if (missionControlState.missionId !== missionId) {
        return syncMissionControlState({
          missionState: missionControlState,
          commandKind: null,
          runtimeController: input.runtimeController,
          now,
        });
      }

      if (!input.runtimeController) {
        missionControlState = {
          ...missionControlState,
          status: "stopped",
          failureReason: reason ?? "emergency stop requested by operator",
          lastHumanCommand: "emergency-stop",
          updatedAt: now(),
          endedAt: now(),
        };
        return missionControlState;
      }

      missionControlState = applyRuntimeSnapshot({
        previousState: missionControlState,
        runtimeSnapshot: await input.runtimeController.emergencyStop({
          missionId,
          reason: reason ?? "emergency stop requested by operator",
        }),
        commandKind: "emergency-stop",
        now: now(),
      });
      return missionControlState;
    },
    async getMissionState() {
      missionControlState = await syncMissionControlState({
        missionState: missionControlState,
        commandKind: null,
        runtimeController: input.runtimeController,
        now,
      });
      return missionControlState;
    },
    async submitReviewDecision(reviewDecision: MissionReviewDecisionInput) {
      if (missionControlState.missionId !== reviewDecision.missionId) {
        return syncMissionControlState({
          missionState: missionControlState,
          commandKind: null,
          runtimeController: input.runtimeController,
          now,
        });
      }

      if (!input.runtimeController) {
        missionControlState = {
          ...missionControlState,
          status: reviewDecision.decision === "resume"
            ? "running"
            : reviewDecision.decision === "stop"
              ? "stopped"
              : "review_required",
          reviewRequiredReason: reviewDecision.decision === "hold" ? reviewDecision.note ?? missionControlState.reviewRequiredReason : null,
          failureReason: reviewDecision.decision === "stop" ? reviewDecision.note ?? "review stopped mission" : missionControlState.failureReason,
          updatedAt: now(),
          endedAt: reviewDecision.decision === "stop" ? now() : null,
        };
        return missionControlState;
      }

      missionControlState = applyRuntimeSnapshot({
        previousState: missionControlState,
        runtimeSnapshot: await input.runtimeController.submitReviewDecision(reviewDecision),
        commandKind: reviewDecision.decision === "resume"
          ? "resume-mission"
          : reviewDecision.decision === "stop"
            ? "stop-mission"
            : null,
        now: now(),
      });
      return missionControlState;
    },
  };
}