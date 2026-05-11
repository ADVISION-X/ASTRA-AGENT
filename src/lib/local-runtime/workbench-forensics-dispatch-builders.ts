import { getActiveMapChain } from "./workbench-map-chain-support.js";
import type { WorkbenchForensicsEnvelope } from "./workbench-forensics-dispatch-types.js";

export const DEFAULT_EXPORT_VERSION = "product-discovery-evidence-packet.v1";

const FRAME_LABELS_BY_STRATEGY = {
  fixed_3_6: ["frame_3s", "frame_6s"],
  fixed_3_6_10: ["frame_3s", "frame_6s", "frame_10s"],
  adaptive_short_video: ["adaptive_first", "adaptive_mid", "adaptive_late"],
  route_plan_or_ability_owned_sampling: ["adaptive_first", "adaptive_mid", "adaptive_late"],
  single_frame_fallback: ["adaptive_first"],
} as const;

export const buildForensicsBaseInput = (input: {
  envelope: WorkbenchForensicsEnvelope;
  childCapabilityId: string;
  recordType: string;
  inputRefs: string[];
  promptContractId?: string | null;
  promptContractVersion?: string | null;
  promptCatalogVersion?: string | null;
  decisionRef?: string | null;
  actionRef?: string | null;
  postActionVerificationRef?: string | null;
  dataQualityFlags?: string[];
}) => {
  const mapChain = getActiveMapChain(input.envelope.mapId);
  return {
    abilityGroupId: "forensics-persistence" as const,
    childCapabilityId: input.childCapabilityId,
    recordType: input.recordType,
    requestedBy: "orchestration",
    sourceAbilityGroupId: "orchestration",
    sourceChildCapabilityId: input.envelope.commandName,
    missionId: input.envelope.missionId,
    runId: input.envelope.runId,
    sessionId: input.envelope.sessionId,
    roundId: input.envelope.roundId,
    videoVisitId: input.envelope.videoVisitId ?? null,
    stepId: input.envelope.stepId,
    bindingPackageId: mapChain.bindingPackageId,
    bindingPackageVersion: mapChain.bindingPackageVersion,
    selectedBindingId: input.envelope.mapId,
    bindingVersion: mapChain.bindingVersion,
    bindingActivationRef: mapChain.bindingActivationRef,
    bindingSnapshotRef: mapChain.bindingSnapshotRef,
    capabilityCallId: input.envelope.commandId,
    inputRefs: input.inputRefs,
    outputRefs: input.envelope.payloadRef,
    sourceRecordRefs: [],
    parentRefs: [],
    artifactRefs: [],
    persistencePolicy: { mode: "append" as const, allowPartialRefs: true },
    ...(input.promptContractId ? { promptContractId: input.promptContractId } : {}),
    ...(input.promptContractVersion ? { promptContractVersion: input.promptContractVersion } : {}),
    ...(input.promptCatalogVersion ? { promptCatalogVersion: input.promptCatalogVersion } : {}),
    ...(input.decisionRef ? { decisionRef: input.decisionRef } : {}),
    ...(input.actionRef ? { actionRef: input.actionRef } : {}),
    ...(input.postActionVerificationRef ? { postActionVerificationRef: input.postActionVerificationRef } : {}),
    dataQualityFlags: input.dataQualityFlags ?? [],
  };
};

export const buildEvidenceRef = (input: {
  id: string;
  kind: "video-screenshot" | "comment-screenshot" | "ai-result" | "action-log";
  summary: string;
  filePath?: string | null;
}) => ({
  id: input.id,
  kind: input.kind,
  summary: input.summary,
  ...(input.filePath ? { filePath: input.filePath } : {}),
});

export const buildProductPresenceDecision = (
  decision: "product_yes" | "product_no" | null,
  mustReview: boolean,
) => {
  if (mustReview) {
    return "review_required" as const;
  }
  if (decision === "product_yes") {
    return "product_yes_high_confidence" as const;
  }
  if (decision === "product_no") {
    return "product_no_high_confidence" as const;
  }
  return "not_asked" as const;
};

export const buildRoundStructuralDecision = (
  decision: "product_yes" | "product_no" | null,
  mustReview: boolean,
) => {
  if (mustReview) {
    return "review_required" as const;
  }
  if (decision === "product_yes") {
    return "product_yes_high_confidence" as const;
  }
  if (decision === "product_no") {
    return "product_no_high_confidence" as const;
  }
  return "not_asked" as const;
};

export const buildVideoFrames = (input: {
  frameEvidenceIds: string[];
  screenshotEvidenceId: string | null;
  samplingStrategy: keyof typeof FRAME_LABELS_BY_STRATEGY;
  capturedAt: string;
  width: number;
  height: number;
  storageRef: string | null;
}) => {
  const evidenceIds = input.frameEvidenceIds.length > 0
    ? input.frameEvidenceIds
    : input.screenshotEvidenceId ? [input.screenshotEvidenceId] : [];
  const labels = FRAME_LABELS_BY_STRATEGY[input.samplingStrategy] ?? FRAME_LABELS_BY_STRATEGY.route_plan_or_ability_owned_sampling;
  return evidenceIds.map((evidenceId, index) => ({
    label: labels[index] ?? "adaptive_late",
    targetTimestampSec: null,
    actualTimestampSec: null,
    screenshotEvidenceId: evidenceId,
    screenshotHash: null,
    storageRef: index === 0 ? input.storageRef : null,
    width: input.width,
    height: input.height,
    capturedAt: input.capturedAt,
    unavailableReason: null,
  }));
};