import type { NerveBusAbilityGroup } from "../nerve-bus/contract.js";
import type { OrchestrationAbilityGroup, OrchestrationExecutionContext } from "./contract.js";
import { MissionStateSchema } from "./schema.js";
import { listOrchestrationChildren } from "./registry.js";
import { createStartMissionCapability } from "./children/start-mission/implementation.js";
import { createPauseMissionCapability } from "./children/pause-mission/implementation.js";
import { createResumeMissionCapability } from "./children/resume-mission/implementation.js";
import { createStopMissionCapability } from "./children/stop-mission/implementation.js";
import { createEmergencyStopCapability } from "./children/emergency-stop/implementation.js";
import { createExecuteMapStepCapability } from "./children/execute-map-step/implementation.js";
import { createEvaluateStepTransitionCapability } from "./children/evaluate-step-transition/implementation.js";
import { createRequestHumanReviewCapability } from "./children/request-human-review/implementation.js";
import { createFinalizeMissionCapability } from "./children/finalize-mission/implementation.js";
import { createSystemOrchestrationClock } from "./runtime/orchestration-clock.js";
import { createInMemoryOrchestrationIdempotencyPort } from "./runtime/orchestration-idempotency.js";
import { createInMemoryOrchestrationStatePort } from "./runtime/mission-state-store.js";
import { createStaticOrchestrationMapStore } from "./runtime/map-selection-gate.js";
import { executeMissionCommand, submitMissionReviewDecision } from "./runtime/orchestration-executor.js";
import { productVideoDetectionMap } from "./maps/product-video-detection/map.js";
import { browseNextVideoMap } from "./maps/browse-next-video/map.js";
import { commentEvidenceMap } from "./maps/comment-evidence/map.js";
import { recoveryMap } from "./maps/recovery/map.js";
import { humanReviewMap } from "./maps/human-review/map.js";

function buildPayloadDocument(input: {
  missionId: string;
  mapId: string;
  stepId: string;
  documentType: string;
  summary: string;
  payloadRefs: Record<string, string | null>;
}) {
  const contentBlocks = Object.entries(input.payloadRefs).map(([key, value]) => ({ key, value }));
  const refValues = Object.values(input.payloadRefs).filter((value): value is string => typeof value === "string");

  return {
    documentType: input.documentType,
    documentRef: `${input.missionId}:${input.mapId}:${input.stepId}:input`,
    summary: input.summary,
    entityRefs: refValues,
    evidenceRefs: refValues,
    contentBlocks,
  };
}

function buildEnvelopeBase(input: {
  channelId: "orchestration-to-ability" | "orchestration-to-ai";
  envelopeId: string;
  missionId: string;
  mapId: string;
  stepId: string;
  inputRef: string;
  payloadRefs: Record<string, string | null>;
  summary: string;
  tags: string[];
}) {
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  const payloadRef = Object.keys(input.payloadRefs);
  const refValues = Object.values(input.payloadRefs).filter((value): value is string => typeof value === "string");

  return {
    abilityGroupId: "nerve-bus" as const,
    channelId: input.channelId,
    envelopeId: input.envelopeId,
    transportId: `${input.envelopeId}:transport`,
    traceId: `${input.missionId}:${input.mapId}`,
    spanId: `${input.stepId}:${input.channelId}`,
    attemptId: `${input.envelopeId}:attempt:1`,
    missionId: input.missionId,
    mapId: input.mapId,
    stepId: input.stepId,
    idempotencyKey: `${input.envelopeId}:idempotent`,
    sequenceNo: 0,
    inputRef: input.inputRef,
    payloadRef: payloadRef.length > 0 ? payloadRef : ["empty-payload"],
    payload: {
      summary: input.summary,
      entityRefs: refValues,
      evidenceRefs: refValues,
      tags: input.tags,
      attributes: [],
    },
    createdAt,
    expiresAt,
  };
}

function buildTypedEnvelopeBase<TChannelId extends "orchestration-to-ability" | "orchestration-to-ai">(input: {
  channelId: TChannelId;
  envelopeId: string;
  missionId: string;
  mapId: string;
  stepId: string;
  inputRef: string;
  payloadRefs: Record<string, string | null>;
  summary: string;
  tags: string[];
}) {
  return buildEnvelopeBase(input) as ReturnType<typeof buildEnvelopeBase> & { channelId: TChannelId };
}

function createOrchestrationNerveBusPort(nerveBus: NerveBusAbilityGroup): OrchestrationExecutionContext["nerveBus"] {
  return {
    async sendCommandToAbility(input) {
      const inputPayload = buildPayloadDocument({
        missionId: input.missionId,
        mapId: input.mapId,
        stepId: input.stepId,
        documentType: "orchestration.ability_dispatch",
        summary: `Dispatch ${input.childCapabilityId} to ${input.targetAbilityGroupId}`,
        payloadRefs: input.payloadRefs,
      });
      const envelopeId = `${input.missionId}:${input.mapId}:${input.stepId}:command`;
      const transport = await nerveBus.dispatchAbilityCommand({
        envelope: {
          ...buildTypedEnvelopeBase({
            channelId: "orchestration-to-ability",
            envelopeId,
            missionId: input.missionId,
            mapId: input.mapId,
            stepId: input.stepId,
            inputRef: inputPayload.documentRef,
            payloadRefs: input.payloadRefs,
            summary: inputPayload.summary,
            tags: [input.targetAbilityGroupId, input.childCapabilityId],
          }),
          envelopeKind: "ability_command" as const,
          commandId: `${input.missionId}:${input.stepId}:command`,
          from: "orchestration" as const,
          to: input.targetAbilityGroupId,
          commandName: input.childCapabilityId,
        },
        inputPayload,
      });

      return {
        status: transport.resultEnvelope.status,
        envelopeId: transport.commandEnvelope.envelopeId,
        resultRef: transport.resultEnvelope.resultId,
        decision: null,
        failureReason: transport.resultEnvelope.failureReason ?? transport.resultEnvelope.reviewRequiredReason,
        payloadRefs: {
          ...input.payloadRefs,
          abilityResultRef: transport.resultEnvelope.outputRef,
        },
      };
    },

    async sendRequestToAi(input) {
      const inputPayload = buildPayloadDocument({
        missionId: input.missionId,
        mapId: input.mapId,
        stepId: input.stepId,
        documentType: "orchestration.ai_dispatch",
        summary: `Request AI prompt ${input.promptContractId}`,
        payloadRefs: input.payloadRefs,
      });
      const envelopeId = `${input.missionId}:${input.mapId}:${input.stepId}:ai-request`;
      const transport = await nerveBus.requestAi({
        envelope: {
          ...buildTypedEnvelopeBase({
            channelId: "orchestration-to-ai",
            envelopeId,
            missionId: input.missionId,
            mapId: input.mapId,
            stepId: input.stepId,
            inputRef: inputPayload.documentRef,
            payloadRefs: input.payloadRefs,
            summary: inputPayload.summary,
            tags: ["ai", input.promptContractId],
          }),
          envelopeKind: "ai_request" as const,
          requestId: `${input.missionId}:${input.stepId}:ai`,
          from: "orchestration" as const,
          to: "ai" as const,
          taskType: input.promptContractId,
          promptRef: input.promptContractId,
        },
        inputPayload,
      });

      return {
        status: transport.responseEnvelope.status,
        envelopeId: transport.requestEnvelope.envelopeId,
        resultRef: transport.responseEnvelope.responseId,
        decision: transport.responseEnvelope.decision,
        failureReason: transport.responseEnvelope.failureReason ?? transport.responseEnvelope.reviewRequiredReason,
        payloadRefs: {
          ...input.payloadRefs,
          aiResultRef: transport.responseEnvelope.outputRef,
        },
      };
    },

    async sendReviewRequestToCommander(input) {
      return {
        status: "review_required",
        envelopeId: `${input.missionId}:${input.stepId}:review`,
        resultRef: `${input.missionId}:${input.stepId}:review-result`,
        decision: null,
        failureReason: input.reason,
        payloadRefs: {
          ...input.payloadRefs,
          reviewReasonRef: `${input.missionId}:${input.stepId}:review-reason`,
        },
      };
    },
  };
}

export function createOrchestrationAbilityGroup(input: {
  nerveBus: NerveBusAbilityGroup;
}): OrchestrationAbilityGroup {
  const context: OrchestrationExecutionContext = {
    clock: createSystemOrchestrationClock(),
    idempotency: createInMemoryOrchestrationIdempotencyPort(),
    mapStore: createStaticOrchestrationMapStore([
      productVideoDetectionMap,
      browseNextVideoMap,
      commentEvidenceMap,
      recoveryMap,
      humanReviewMap,
    ]),
    nerveBus: createOrchestrationNerveBusPort(input.nerveBus),
    statePort: createInMemoryOrchestrationStatePort(),
  };

  const startMissionChild = createStartMissionCapability();
  const pauseMissionChild = createPauseMissionCapability();
  const resumeMissionChild = createResumeMissionCapability();
  const stopMissionChild = createStopMissionCapability();
  const emergencyStopChild = createEmergencyStopCapability();
  const executeMapStepChild = createExecuteMapStepCapability();
  const evaluateStepTransitionChild = createEvaluateStepTransitionCapability();
  const requestHumanReviewChild = createRequestHumanReviewCapability();
  const finalizeMissionChild = createFinalizeMissionCapability();

  return {
    listChildCapabilityIds() {
      return listOrchestrationChildren();
    },

    listMapIds() {
      return [
        productVideoDetectionMap.mapId,
        browseNextVideoMap.mapId,
        commentEvidenceMap.mapId,
        recoveryMap.mapId,
        humanReviewMap.mapId,
      ];
    },

    async execute(inputValue) {
      switch (inputValue.childCapabilityId) {
        case "start-mission":
          return startMissionChild.execute(inputValue.payload as never, context);
        case "pause-mission":
          return pauseMissionChild.execute(inputValue.payload as never, context);
        case "resume-mission":
          return resumeMissionChild.execute(inputValue.payload as never, context);
        case "stop-mission":
          return stopMissionChild.execute(inputValue.payload as never, context);
        case "emergency-stop":
          return emergencyStopChild.execute(inputValue.payload as never, context);
        case "execute-map-step":
          return executeMapStepChild.execute(inputValue.payload as never, context);
        case "evaluate-step-transition":
          return evaluateStepTransitionChild.execute(inputValue.payload as never, context);
        case "request-human-review":
          return requestHumanReviewChild.execute(inputValue.payload as never, context);
        case "finalize-mission":
          return finalizeMissionChild.execute(inputValue.payload as never, context);
        default:
          throw new Error(`Unknown orchestration child capability ${inputValue.childCapabilityId}.`);
      }
    },

    executeMission(command) {
      return executeMissionCommand({ command, caller: "commander-console", context });
    },

    async startMission(command) {
      const result = await executeMissionCommand({ command, caller: "commander-console", context });
      return MissionStateSchema.parse(result.missionState);
    },

    async pauseMission(missionId) {
      return MissionStateSchema.parse(
        await pauseMissionChild.execute({ missionId, reason: null, note: null }, context),
      );
    },

    async resumeMission(missionId) {
      return MissionStateSchema.parse(
        await resumeMissionChild.execute({ missionId, reason: null, note: null }, context),
      );
    },

    async stopMission(inputValue) {
      return MissionStateSchema.parse(
        await stopMissionChild.execute(
          { missionId: inputValue.missionId, reason: inputValue.reason ?? null, note: null },
          context,
        ),
      );
    },

    async emergencyStop(inputValue) {
      return MissionStateSchema.parse(
        await emergencyStopChild.execute(
          { missionId: inputValue.missionId, reason: inputValue.reason ?? null, note: null },
          context,
        ),
      );
    },

    async getMissionState(missionId) {
      return MissionStateSchema.parse(await context.statePort.getMissionState(missionId ?? null));
    },

    async submitReviewDecision(inputValue) {
      return MissionStateSchema.parse(
        await submitMissionReviewDecision({ command: inputValue, caller: "commander-console", context }),
      );
    },
  };
}