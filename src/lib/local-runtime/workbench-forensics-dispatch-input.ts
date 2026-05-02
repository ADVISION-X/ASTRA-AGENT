import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import { getDefaultMapPluginRegistry } from "../../map-plugins/registry/map-plugin-registry.js";
import { StructuredRuntimeEventSchema } from "../../types/structured-log.js";
import { createId } from "./ids.js";

const buildMapChain = (mapId: string) => {
  const record = getDefaultMapPluginRegistry().active.getActiveOperationalMapRecord(mapId);
  return {
    mapPackageId: record?.packageId ?? null,
    mapPackageVersion: record?.packageVersion ?? null,
    selectedMapVersion: record?.mapVersion ?? null,
    activationSnapshotRef: record?.activationSnapshotRef ?? null,
  };
};

const buildForensicsStructuredRuntimeEvent = (envelope: AbilityCommandEnvelope) =>
  StructuredRuntimeEventSchema.parse({
    eventId: createId("event"),
    eventType: "ABILITY_DISPATCH",
    level: "INFO",
    phase: "ability-dispatch",
    component: "nerve-bus",
    owner: "Nerve Bus",
    abilityGroupId: "nerve-bus",
    childCapabilityId: "orchestration-to-ability",
    sessionId: envelope.missionId,
    missionId: envelope.missionId,
    roundId: envelope.stepId,
    videoVisitId: null,
    mapId: envelope.mapId,
    traceId: envelope.traceId,
    spanId: envelope.spanId,
    attemptId: envelope.attemptId,
    step: envelope.stepId,
    status: "success",
    reason: `Dispatched ${envelope.commandName}.`,
    createdAt: new Date().toISOString(),
    refs: [],
    inputRefs: [envelope.inputRef],
    outputRefs: [],
    evidenceRefs: [],
    proofRefs: [],
    artifactRefs: [],
    actionLogRefs: [],
    dataQualityFlags: [],
  });

export const buildForensicsRuntimeEventInput = (
  envelope: AbilityCommandEnvelope,
) => {
  const mapChain = buildMapChain(envelope.mapId);
  return JSON.parse(JSON.stringify({
    abilityGroupId: "forensics-persistence",
    childCapabilityId: "write-structured-runtime-event",
    recordType: "structured_runtime_event",
    requestedBy: "orchestration",
    sourceAbilityGroupId: "orchestration",
    sourceChildCapabilityId: envelope.commandName,
    missionId: envelope.missionId,
    runId: envelope.transportId,
    sessionId: envelope.missionId,
    roundId: envelope.stepId,
    videoVisitId: null,
    stepId: envelope.stepId,
    mapPackageId: mapChain.mapPackageId,
    mapPackageVersion: mapChain.mapPackageVersion,
    selectedMapId: envelope.mapId,
    selectedMapVersion: mapChain.selectedMapVersion,
    activationSnapshotRef: mapChain.activationSnapshotRef,
    capabilityCallId: envelope.commandId,
    inputRefs: [envelope.inputRef],
    outputRefs: envelope.payloadRef,
    sourceRecordRefs: [],
    parentRefs: [],
    artifactRefs: [],
    persistencePolicy: { mode: "append", allowPartialRefs: true },
    dataQualityFlags: [],
    payload: {
      structuredRuntimeEvent: buildForensicsStructuredRuntimeEvent(envelope),
    },
  }));
};