import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import { resolveAiProductPresenceOutputSummary } from "../../capabilities/ai/index.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";
import { getActiveMapChain } from "./workbench-map-chain-support.js";
import { payloadDocumentToObject } from "./workbench-payload.js";
import { buildForensicsStructuredRuntimeEvent } from "./workbench-forensics-runtime-event-support.js";
import { resolveScreenshotSourceHandoff } from "./workbench-screenshot-source-handoff.js";
import {
  buildForensicsBrowseLedgerInput,
  buildForensicsEvidencePacketInput,
} from "./workbench-forensics-finalization-dispatch.js";
import {
  buildForensicsBaseInput,
} from "./workbench-forensics-dispatch-builders.js";
import {
  isRecord,
  readNumber,
  readString,
  requirePositiveInt,
  requireString,
  resolvePayloadString,
} from "./workbench-forensics-dispatch-values.js";
import {
  type WorkbenchForensicsImageEvidenceInput,
  type WorkbenchForensicsProductLeadRecordInput,
  type WorkbenchForensicsRuntimeEventInput,
} from "./workbench-forensics-dispatch-types.js";

type ProductLeadDispatchRequest = {
  requestedPlatformId: string;
  targetUrl: string;
  targetTitle: string;
  screenshotEvidenceRef: string;
  productPresenceAiResultRef: string;
};

type ProductPresenceSummary = NonNullable<ReturnType<typeof resolveAiProductPresenceOutputSummary>>;

export const buildForensicsRuntimeEventInput = (
  envelope: AbilityCommandEnvelope,
): WorkbenchForensicsRuntimeEventInput => {
  const mapChain = getActiveMapChain(envelope.mapId);
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

export const buildForensicsEvidenceRecordInput = (
  envelope: AbilityCommandEnvelope,
  inputPayload: Parameters<typeof payloadDocumentToObject>[0],
): WorkbenchForensicsImageEvidenceInput => {
  const payload = payloadDocumentToObject(inputPayload);
  const requestedPlatformId = requireString(resolvePayloadString(payload, "requestedPlatformId"), "requestedPlatformId");
  const targetUrl = requireString(resolvePayloadString(payload, "targetUrl"), "targetUrl");
  const commentsEvidenceRef = requireString(resolvePayloadString(payload, "commentsEvidenceRef"), "commentsEvidenceRef");
  const commentsHandoff = resolveScreenshotSourceHandoff([commentsEvidenceRef]);
  if (!commentsHandoff) {
    throw new Error("Workbench forensics dispatch could not resolve comments screenshot handoff.");
  }

  const sourceProof = isRecord(commentsHandoff.sourceProof) ? commentsHandoff.sourceProof : null;
  return JSON.parse(JSON.stringify({
    ...buildForensicsBaseInput({
      envelope,
      childCapabilityId: "write-evidence-record",
      recordType: "evidence_record",
      inputRefs: [commentsEvidenceRef],
      dataQualityFlags: ["comment_screenshot_ok"],
    }),
    payload: {
      imageEvidenceInput: {
        kind: "comment-screenshot",
        taskRunId: envelope.runId,
        roundId: requireString(envelope.roundId, "roundId"),
        platformId: requestedPlatformId,
        sourceId: readString(sourceProof, "sourceScreenshotEvidenceId") ?? commentsEvidenceRef,
        sourceUrl: targetUrl,
        regionLabel: "comments-panel",
        regionType: "comment_panel",
        summary: "Comments panel screenshot evidence for seeding candidate review.",
        width: requirePositiveInt(readNumber(sourceProof, "sourceWidth"), "comments screenshot width"),
        height: requirePositiveInt(readNumber(sourceProof, "sourceHeight"), "comments screenshot height"),
        sourceFilePath: commentsHandoff.sourceStorageRef,
      },
    },
  }));
};

const readProductLeadDispatchRequest = (
  inputPayload: Parameters<typeof payloadDocumentToObject>[0],
): ProductLeadDispatchRequest => {
  const payload = payloadDocumentToObject(inputPayload);
  return {
    requestedPlatformId: requireString(resolvePayloadString(payload, "requestedPlatformId"), "requestedPlatformId"),
    targetUrl: requireString(resolvePayloadString(payload, "targetUrl"), "targetUrl"),
    targetTitle: requireString(resolvePayloadString(payload, "targetTitle"), "targetTitle"),
    screenshotEvidenceRef: requireString(resolvePayloadString(payload, "screenshotEvidenceRef"), "screenshotEvidenceRef"),
    productPresenceAiResultRef: requireString(resolvePayloadString(payload, "productPresenceAiResultRef"), "productPresenceAiResultRef"),
  };
};

const resolveProductLeadSummary = (request: ProductLeadDispatchRequest): ProductPresenceSummary => {
  const productPresenceSummary = resolveAiProductPresenceOutputSummary(request.productPresenceAiResultRef);
  if (!productPresenceSummary) {
    throw new Error("Workbench forensics dispatch could not resolve product presence AI summary for product lead record.");
  }
  if (!resolveScreenshotSourceHandoff([request.screenshotEvidenceRef])) {
    throw new Error("Workbench forensics dispatch could not resolve video screenshot handoff for product lead record.");
  }
  return productPresenceSummary;
};

const buildProductLeadRecordPayload = (
  envelope: AbilityCommandEnvelope,
  request: ProductLeadDispatchRequest,
  productPresenceSummary: ProductPresenceSummary,
) => ({
  productLeadRecord: {
    platformId: request.requestedPlatformId,
    targetUrl: request.targetUrl,
    targetTitle: request.targetTitle,
    screenshotEvidenceRef: request.screenshotEvidenceRef,
    productPresenceAiResultRef: request.productPresenceAiResultRef,
    decision: productPresenceSummary.output.decision === "product_yes" ? "product_yes" : "product_no",
    routeLabel: productPresenceSummary.output.routeLabel,
    confidence: productPresenceSummary.output.confidence,
    visibleProductTypes: productPresenceSummary.output.visibleProductTypes,
    reason: productPresenceSummary.output.reason,
    capturedAt: productPresenceSummary.capturedAt,
    createdAt: new Date().toISOString(),
    runId: envelope.runId,
    missionId: envelope.missionId,
  },
});

export const buildForensicsProductLeadRecordInput = (
  envelope: AbilityCommandEnvelope,
  inputPayload: Parameters<typeof payloadDocumentToObject>[0],
): WorkbenchForensicsProductLeadRecordInput => {
  const request = readProductLeadDispatchRequest(inputPayload);
  const productPresenceSummary = resolveProductLeadSummary(request);

  return JSON.parse(JSON.stringify({
    ...buildForensicsBaseInput({
      envelope,
      childCapabilityId: "write-product-lead-record",
      recordType: "product_lead_record",
      inputRefs: [request.screenshotEvidenceRef, request.productPresenceAiResultRef],
      promptContractId: productPresenceSummary.promptContractId,
      promptContractVersion: productPresenceSummary.promptContractVersion,
      promptCatalogVersion: productPresenceSummary.promptCatalogVersion,
      decisionRef: productPresenceSummary.aiProofRef,
      dataQualityFlags: ["video_screenshot_ok", "local_ai_ok", "product_lead_record_v1"],
    }),
    payload: buildProductLeadRecordPayload(envelope, request, productPresenceSummary),
  }));
};

export {
  buildForensicsBrowseLedgerInput,
  buildForensicsEvidencePacketInput,
};