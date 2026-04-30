import type { NerveBusAbilityGroup } from "../../nerve-bus/index.js";
import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import type { OrchestrationRuntimeContext } from "../internal.js";
export type { OrchestrationRuntimeContext } from "../internal.js";
import type { OrchestrationNerveBusPort } from "../ports/orchestration-nerve-bus-port.js";
import type { OrchestrationMapStorePort } from "../ports/orchestration-map-store-port.js";
import { getDefaultMapPluginRegistry } from "../../../map-plugins/registry/map-plugin-registry.js";
import { createSystemOrchestrationClock } from "./orchestration-clock.js";
import { createInMemoryOrchestrationIdempotencyPort } from "./orchestration-idempotency.js";
import { createInMemoryOrchestrationStatePort } from "./mission-state-store.js";

function createRegistryBackedMapStore(): OrchestrationMapStorePort {
  const registry = getDefaultMapPluginRegistry();
  return {
    async getMap(mapId) {
      return registry.active.getOperationalMap(mapId);
    },
    async getActiveMapRecord(mapId) {
      return registry.active.getActiveOperationalMapRecord(mapId);
    },
    async getActiveMapRecordByTaskTemplateId(taskTemplateId) {
      return registry.active.getActiveOperationalMapRecordByTaskTemplateId(taskTemplateId);
    },
    async getActiveMapRecordByActivationId(activationId) {
      return registry.active.getActiveOperationalMapRecordByActivationId(activationId);
    },
    async listMaps() {
      return registry.active.listActivePackages().map((mapPackage) => {
        const { mapVersion: _mapVersion, proofPolicy: _proofPolicy, ...operationalMap } = mapPackage.operationalMap;
        return operationalMap;
      });
    },
  };
}

function createOrchestrationNerveBusAdapter(nerveBus: NerveBusAbilityGroup): OrchestrationNerveBusPort {
  const clock = { now: () => ({ isoTimestamp: new Date().toISOString(), monotonicMs: performance.now() }) };

  return {
    async sendCommandToAbility(input) {
      const envelopeId = randomUUID();
      const createdAt = clock.now().isoTimestamp;
      const expiresAt = new Date(Date.now() + input.timeoutMs).toISOString();
      const transport = await nerveBus.dispatchAbilityCommand({
        envelope: {
          abilityGroupId: "nerve-bus",
          channelId: "orchestration-to-ability",
          envelopeId,
          transportId: randomUUID(),
          traceId: `${input.missionId}:${input.mapId}`,
          spanId: `${input.stepId}:ability`,
          attemptId: `${envelopeId}:attempt:1`,
          missionId: input.missionId,
          mapId: input.mapId,
          stepId: input.stepId,
          idempotencyKey: input.idempotencyKey,
          sequenceNo: input.sequenceNo,
          inputRef: `${input.missionId}:${input.stepId}:input`,
          payloadRef: [`${input.missionId}:${input.stepId}:payload`],
          payload: {
            summary: `Dispatch ${input.childCapabilityId} to ${input.targetAbilityGroupId}`,
            entityRefs: [],
            evidenceRefs: [],
            tags: [input.targetAbilityGroupId, input.childCapabilityId],
            attributes: [],
          },
          createdAt,
          expiresAt,
          envelopeKind: "ability_command",
          commandId: `${input.missionId}:${input.stepId}:cmd`,
          from: "orchestration",
          to: input.targetAbilityGroupId,
          commandName: input.childCapabilityId,
        },
        inputPayload: {
          documentType: "orchestration.ability_dispatch",
          documentRef: `${input.missionId}:${input.stepId}:input`,
          summary: `Dispatch ${input.childCapabilityId} to ${input.targetAbilityGroupId}`,
          entityRefs: [],
          evidenceRefs: [],
          contentBlocks: [],
        },
      });
      return {
        status: transport.resultEnvelope.status,
        envelopeId: transport.commandEnvelope.envelopeId,
        resultRef: transport.resultEnvelope.resultId ?? `${envelopeId}:result`,
        decision: null,
        failureReason: transport.resultEnvelope.failureReason ?? transport.resultEnvelope.reviewRequiredReason ?? null,
        payloadRefs: {
          ...input.payloadRefs,
          abilityResultRef: transport.resultEnvelope.outputRef ?? null,
        },
      };
    },

    async sendRequestToAi(input) {
      const envelopeId = randomUUID();
      const createdAt = clock.now().isoTimestamp;
      const expiresAt = new Date(Date.now() + input.timeoutMs).toISOString();
      const transport = await nerveBus.requestAi({
        envelope: {
          abilityGroupId: "nerve-bus",
          channelId: "orchestration-to-ai",
          envelopeId,
          transportId: randomUUID(),
          traceId: `${input.missionId}:${input.mapId}`,
          spanId: `${input.stepId}:ai`,
          attemptId: `${envelopeId}:attempt:1`,
          missionId: input.missionId,
          mapId: input.mapId,
          stepId: input.stepId,
          idempotencyKey: input.idempotencyKey,
          sequenceNo: input.sequenceNo,
          inputRef: `${input.missionId}:${input.stepId}:ai-input`,
          payloadRef: [`${input.missionId}:${input.stepId}:ai-payload`],
          payload: {
            summary: `Request AI prompt ${input.promptContractId}`,
            entityRefs: [],
            evidenceRefs: [],
            tags: ["ai", input.promptContractId],
            attributes: [],
          },
          createdAt,
          expiresAt,
          envelopeKind: "ai_request",
          requestId: `${input.missionId}:${input.stepId}:ai`,
          from: "orchestration",
          to: "ai",
          taskType: input.promptContractId,
          promptRef: input.promptContractId,
        },
        inputPayload: {
          documentType: "orchestration.ai_dispatch",
          documentRef: `${input.missionId}:${input.stepId}:ai-input`,
          summary: `Request AI prompt ${input.promptContractId}`,
          entityRefs: [],
          evidenceRefs: [],
          contentBlocks: [],
        },
      });
      return {
        status: transport.responseEnvelope.status,
        envelopeId: transport.requestEnvelope.envelopeId,
        resultRef: transport.responseEnvelope.responseId ?? `${envelopeId}:result`,
        decision: transport.responseEnvelope.decision ?? null,
        failureReason: transport.responseEnvelope.failureReason ?? transport.responseEnvelope.reviewRequiredReason ?? null,
        payloadRefs: {
          ...input.payloadRefs,
          aiResultRef: transport.responseEnvelope.outputRef ?? null,
        },
      };
    },

    async sendReviewRequestToCommander(input) {
      const reviewDispatchRef = randomUUID();
      return {
        status: "review_required",
        reviewDispatchRef,
        failureReason: input.reason,
        payloadRefs: {
          ...input.payloadRefs,
          reviewReasonRef: reviewDispatchRef,
        },
      };
    },
  };
}

export function createOrchestrationRuntimeContext(nerveBus: NerveBusAbilityGroup): OrchestrationRuntimeContext {
  return {
    clock: createSystemOrchestrationClock(),
    idempotency: createInMemoryOrchestrationIdempotencyPort(),
    mapStore: createRegistryBackedMapStore(),
    nerveBus: createOrchestrationNerveBusAdapter(nerveBus),
    statePort: createInMemoryOrchestrationStatePort(),
  };
}
