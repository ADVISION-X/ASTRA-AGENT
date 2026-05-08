import type { AbilityCommandEnvelope } from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import type { WorkbenchRuntime } from "./workbench-contract.js";
import { payloadDocumentToObject } from "./workbench-payload.js";
import { buildForensicsStructuredRuntimeEvent } from "./workbench-forensics-runtime-event-support.js";
import { resolveScreenshotSourceHandoff } from "./workbench-screenshot-source-handoff.js";
import {
  buildForensicsBrowseLedgerInput,
  buildForensicsEvidencePacketInput,
} from "./workbench-forensics-finalization-dispatch.js";
import {
  buildForensicsBaseInput,
  isRecord,
  readNumber,
  readString,
  requirePositiveInt,
  requireString,
  resolvePayloadString,
  type WorkbenchForensicsImageEvidenceInput,
  type WorkbenchForensicsRuntimeEventInput,
} from "./workbench-forensics-dispatch-support.js";

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