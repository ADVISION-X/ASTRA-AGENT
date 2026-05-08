import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";

import type { WorkbenchPayloadDocument as NerveBusPayloadDocument } from "./workbench-payload.js";
import { payloadDocumentToObject, payloadValueToString } from "./workbench-payload.js";
import { resolveScreenshotSourceHandoff } from "./workbench-screenshot-source-handoff.js";

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

function buildBootstrapCapturePolicy(input: {
  envelope: AbilityCommandEnvelope;
  payload: Record<string, string | number | boolean | null>;
  pageStateProof: ReturnType<typeof buildScreenshotPageStateProof>;
}) {
  if (input.pageStateProof) {
    return undefined;
  }

  const hasOpenHandoff = Boolean(
    payloadValueToString(input.payload.sourceEvidenceRef)
    ?? payloadValueToString(input.payload.abilityResultRef)
    ?? input.envelope.inputRef,
  );
  if (!hasOpenHandoff) {
    return undefined;
  }

  return {
    allowMissingRoundId: true,
    allowMissingVideoVisitId: true,
    allowFirstCaptureWithoutPageStateProof: true,
    maxContentLines: 12,
    contentLineMaxLength: 200,
    maxAiWidth: 1440,
    preservePixels: true,
    evidencePolicy: "evidence_original",
    maxDurationMs: 60000,
    onTimeoutStatus: "failed",
  };
}

function buildCaptureBrowserViewportCommand(
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
  payload: Record<string, string | number | boolean | null>,
) {
  const pageStateProof = buildScreenshotPageStateProof(envelope, payload);
  const capturePolicy = buildBootstrapCapturePolicy({ envelope, payload, pageStateProof });

  return {
    ...buildScreenshotCommonFields(envelope, inputPayload),
    childCapabilityId: "capture-browser-viewport",
    source: {
      kind: "browser_viewport",
      pageUrl: payloadValueToString(payload.targetUrl),
      pageTitle: payloadValueToString(payload.targetTitle),
      browserSessionRef: null,
    },
    pageStateProof,
    ...(capturePolicy ? { capturePolicy } : {}),
  };
}

function buildPrepareAiInputCommand(
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
  payload: Record<string, string | number | boolean | null>,
) {
  const source = resolveScreenshotSourceHandoff([
    payloadValueToString(payload.screenshotEvidenceRef),
    payloadValueToString(payload.abilityResultRef),
    envelope.inputRef,
  ]);

  return {
    ...buildScreenshotCommonFields(envelope, inputPayload),
    childCapabilityId: "prepare-ai-input",
    ...(source ? { source } : {}),
  };
}

export function buildScreenshotCommand(
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
) {
  const payload = payloadDocumentToObject(inputPayload);
  const command = envelope.commandName === "prepare-ai-input"
    ? buildPrepareAiInputCommand(envelope, inputPayload, payload)
    : buildCaptureBrowserViewportCommand(envelope, inputPayload, payload);

  return JSON.parse(JSON.stringify(command));
}
