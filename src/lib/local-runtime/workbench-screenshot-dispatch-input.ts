import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";

import type { WorkbenchPayloadDocument as NerveBusPayloadDocument } from "./workbench-payload.js";
import { payloadDocumentToObject, payloadValueToString } from "./workbench-payload.js";
import { resolveScreenshotSourceHandoff } from "./workbench-screenshot-source-handoff.js";

const BOOTSTRAP_CAPTURE_SAMPLE_DELAY_MS = 5_000;
const PRODUCT_PRESENCE_LIGHTWEIGHT_CAPTURE_TIMEOUT_MS = 1_500;
const PRODUCT_PRESENCE_LIGHTWEIGHT_CAPTURE_MAX_AI_WIDTH = 720;
const ROUTE_PLAN_CAPTURE_SAMPLE_DELAY_MS_BY_STEP_ID: Readonly<Record<string, number>> = {
  "capture-current-video-viewport": 250,
};
const PREPARE_AI_INPUT_SOURCE_KEYS_BY_STEP_ID: Readonly<Record<string, readonly string[]>> = {
  "prepare-current-video-ai-input": ["screenshotEvidenceRef"],
};

function isCurrentVideoLightweightCaptureStep(stepId: string) {
  return stepId === "capture-current-video-viewport";
}

function isCurrentVideoLightweightPrepareStep(stepId: string) {
  return stepId === "prepare-current-video-ai-input";
}

function resolveLightweightScreenshotTimeoutMs(envelope: AbilityCommandEnvelope) {
  return Math.min(resolveTransportTimeoutMs(envelope), PRODUCT_PRESENCE_LIGHTWEIGHT_CAPTURE_TIMEOUT_MS);
}

function buildCurrentVideoLightweightCapturePolicy() {
  return {
    allowMissingRoundId: false,
    allowMissingVideoVisitId: false,
    allowFirstCaptureWithoutPageStateProof: false,
    maxContentLines: 8,
    contentLineMaxLength: 160,
    maxAiWidth: PRODUCT_PRESENCE_LIGHTWEIGHT_CAPTURE_MAX_AI_WIDTH,
    preservePixels: false,
    evidencePolicy: "ai_input" as const,
    maxDurationMs: PRODUCT_PRESENCE_LIGHTWEIGHT_CAPTURE_TIMEOUT_MS,
    onTimeoutStatus: "failed" as const,
  };
}

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

function resolveCaptureSampleDelayMs(
  envelope: AbilityCommandEnvelope,
  capturePolicy: ReturnType<typeof buildBootstrapCapturePolicy>,
) {
  return ROUTE_PLAN_CAPTURE_SAMPLE_DELAY_MS_BY_STEP_ID[envelope.stepId]
    ?? (capturePolicy ? BOOTSTRAP_CAPTURE_SAMPLE_DELAY_MS : null);
}

function resolvePrepareAiInputSource(
  envelope: AbilityCommandEnvelope,
  payload: Record<string, string | number | boolean | null>,
) {
  const sourceKeys = PREPARE_AI_INPUT_SOURCE_KEYS_BY_STEP_ID[envelope.stepId] ?? ["screenshotEvidenceRef"];
  return resolveScreenshotSourceHandoff([
    ...sourceKeys.map((key) => payloadValueToString(payload[key])),
    payloadValueToString(payload.abilityResultRef),
    envelope.inputRef,
  ]);
}

function buildCaptureBrowserViewportCommand(
  envelope: AbilityCommandEnvelope,
  inputPayload: NerveBusPayloadDocument,
  payload: Record<string, string | number | boolean | null>,
) {
  const pageStateProof = buildScreenshotPageStateProof(envelope, payload);
  const capturePolicy = isCurrentVideoLightweightCaptureStep(envelope.stepId)
    ? buildCurrentVideoLightweightCapturePolicy()
    : buildBootstrapCapturePolicy({ envelope, payload, pageStateProof });
  const timeoutMs = isCurrentVideoLightweightCaptureStep(envelope.stepId)
    ? resolveLightweightScreenshotTimeoutMs(envelope)
    : resolveTransportTimeoutMs(envelope);

  return {
    ...buildScreenshotCommonFields(envelope, inputPayload),
    timeoutMs,
    childCapabilityId: "capture-browser-viewport",
    sampleDelayMs: resolveCaptureSampleDelayMs(envelope, capturePolicy),
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
  const source = resolvePrepareAiInputSource(envelope, payload);
  const isLightweightPrepare = isCurrentVideoLightweightPrepareStep(envelope.stepId);

  return {
    ...buildScreenshotCommonFields(envelope, inputPayload),
    timeoutMs: isLightweightPrepare ? resolveLightweightScreenshotTimeoutMs(envelope) : resolveTransportTimeoutMs(envelope),
    childCapabilityId: "prepare-ai-input",
    ...(isLightweightPrepare
      ? {
          maxAiWidth: PRODUCT_PRESENCE_LIGHTWEIGHT_CAPTURE_MAX_AI_WIDTH,
          preservePixels: false,
          evidencePolicy: "ai_input" as const,
        }
      : {}),
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
