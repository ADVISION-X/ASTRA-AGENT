import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import type { WorkbenchPayloadDocument as NerveBusPayloadDocument } from "./workbench-payload.js";
import { payloadDocumentToObject, payloadValueToString } from "./workbench-payload.js";

function resolveRequestedPlatform(payload: Record<string, string | number | boolean | null>) {
  const requestedPlatformId = payloadValueToString(payload.requestedPlatformId);
  if (requestedPlatformId === "macos-local" || requestedPlatformId === "iphone-mirroring-facebook-app" || requestedPlatformId === "iphone-mirroring-tiktok-app") {
    return {
      childCapabilityId: "open-local-program",
      platformId: "macos-local",
      targetKind: "local-program",
    } as const;
  }
  if (requestedPlatformId === "facebook-web") {
    return {
      childCapabilityId: "open-facebook",
      platformId: "facebook-web",
      targetKind: "platform-feed",
    } as const;
  }

  return {
    childCapabilityId: "open-tiktok",
    platformId: "tiktok-web",
    targetKind: "platform-feed",
  } as const;
}

function resolveTimeoutMs(envelope: AbilityCommandEnvelope) {
  const startedAt = Date.parse(envelope.createdAt);
  const expiresAt = Date.parse(envelope.expiresAt);
  if (Number.isFinite(startedAt) && Number.isFinite(expiresAt) && expiresAt > startedAt) {
    return expiresAt - startedAt;
  }

  return 10_000;
}

export const buildOpenAbilityInput = (
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) => {
  const payload = payloadDocumentToObject(inputPayload);
  const targetPlatform = resolveRequestedPlatform(payload);
  return {
    abilityGroupId: "open",
    childCapabilityId: targetPlatform.childCapabilityId,
    missionId: envelope.missionId,
    runId: envelope.runId,
    sessionId: envelope.sessionId,
    roundId: envelope.roundId,
    videoVisitId: envelope.videoVisitId,
    stepId: envelope.stepId,
    mapPackageId: envelope.mapPackageId,
    mapPackageVersion: envelope.mapPackageVersion,
    selectedMapId: envelope.selectedMapId,
    selectedMapVersion: envelope.selectedMapVersion,
    activationSnapshotRef: envelope.activationSnapshotRef,
    capabilityCallId: envelope.capabilityCallId,
    nerveBusEnvelopeId: envelope.nerveBusEnvelopeId,
    platformId: targetPlatform.platformId,
    targetKind: targetPlatform.targetKind,
    requestedBy: "orchestration",
    sourceAbilityGroupId: "orchestration",
    sourceChildCapabilityId: envelope.commandName,
    reason: inputPayload.summary,
    targetUrl: payloadValueToString(payload.targetUrl),
    targetTitle: payloadValueToString(payload.targetTitle),
    targetProfileRef: payloadValueToString(payload.targetProfileRef),
    sourceRef: payloadValueToString(payload.sourceEvidenceRef) ?? envelope.sourceRef,
    inputRef: envelope.inputRef,
    idempotencyKey: envelope.idempotencyKey,
    timeoutMs: resolveTimeoutMs(envelope),
  };
};
