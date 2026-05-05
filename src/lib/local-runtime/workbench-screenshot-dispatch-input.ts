import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";

import type { WorkbenchPayloadDocument as NerveBusPayloadDocument } from "./workbench-payload.js";
import { payloadDocumentToObject, payloadValueToString } from "./workbench-payload.js";

function resolveTransportTimeoutMs(envelope: AbilityCommandEnvelope) {
  const startedAt = Date.parse(envelope.createdAt);
  const expiresAt = Date.parse(envelope.expiresAt);
  if (Number.isFinite(startedAt) && Number.isFinite(expiresAt) && expiresAt > startedAt) {
    return expiresAt - startedAt;
  }

  return 10_000;
}

function buildScreenshotCommonFields(envelope: AbilityCommandEnvelope, inputPayload: NerveBusPayloadDocument) {
  return {
    abilityGroupId: "screenshot",
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
    requestedBy: "orchestration",
    purpose: inputPayload.summary,
    sourceAbilityGroupId: "orchestration",
    sourceChildCapabilityId: envelope.commandName,
    inputRef: envelope.inputRef,
    idempotencyKey: envelope.idempotencyKey,
    timeoutMs: resolveTransportTimeoutMs(envelope),
  };
}

function buildScreenshotPageStateProof(
  envelope: AbilityCommandEnvelope,
  payload: Record<string, string | number | boolean | null>,
) {
  const proofRef = payloadValueToString(payload.pageStateRef);
  if (!proofRef) {
    return null;
  }

  return {
    proofRef,
    status: "approved",
    pageUrl: payloadValueToString(payload.targetUrl),
    pageTitle: payloadValueToString(payload.targetTitle),
    sessionId: envelope.sessionId,
    roundId: envelope.roundId,
    videoVisitId: envelope.videoVisitId,
    observedAt: envelope.createdAt,
  };
}

function buildCaptureBrowserViewportCommand(
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
  payload: Record<string, string | number | boolean | null>,
) {
  return {
    ...buildScreenshotCommonFields(envelope, inputPayload),
    childCapabilityId: "capture-browser-viewport",
    source: {
      kind: "browser_viewport",
      pageUrl: payloadValueToString(payload.targetUrl),
      pageTitle: payloadValueToString(payload.targetTitle),
      browserSessionRef: null,
    },
    pageStateProof: buildScreenshotPageStateProof(envelope, payload),
  };
}

function buildPrepareAiInputCommand(envelope: AbilityCommandEnvelope, inputPayload: NerveBusPayloadDocument) {
  return {
    ...buildScreenshotCommonFields(envelope, inputPayload),
    childCapabilityId: "prepare-ai-input",
  };
}

export function buildScreenshotCommand(
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) {
  const payload = payloadDocumentToObject(inputPayload);
  const command = envelope.commandName === "prepare-ai-input"
    ? buildPrepareAiInputCommand(envelope, inputPayload)
    : buildCaptureBrowserViewportCommand(envelope, inputPayload, payload);

  return JSON.parse(JSON.stringify(command));
}