import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import type { WorkbenchPayloadDocument as NerveBusPayloadDocument } from "./workbench-payload.js";
import { payloadDocumentToObject, payloadValueToString } from "./workbench-payload.js";

export const buildOpenAbilityInput = (
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const payload = payloadDocumentToObject(inputPayload);
  return {
    abilityGroupId: "open",
    childCapabilityId: "open-tiktok",
    platformId: "tiktok-web",
    targetKind: "platform-feed",
    requestedBy: "orchestration",
    sourceAbilityGroupId: "orchestration",
    sourceChildCapabilityId: envelope.commandName,
    missionId: envelope.missionId,
    runId: envelope.mapId,
    sessionId: envelope.missionId,
    roundId: envelope.stepId,
    videoVisitId: null,
    reason: inputPayload.summary,
    targetUrl: payloadValueToString(payload.targetUrl),
    targetTitle: payloadValueToString(payload.targetTitle),
    targetProfileRef: null,
    sourceRef: payloadValueToString(payload.sourceEvidenceRef),
  };
};