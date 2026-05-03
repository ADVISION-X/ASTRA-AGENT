import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import { StructuredRuntimeEventSchema } from "../../types/structured-log.js";

import { createId } from "./ids.js";

export const buildForensicsStructuredRuntimeEvent = (envelope: AbilityCommandEnvelope) => {
  return StructuredRuntimeEventSchema.parse({
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
};