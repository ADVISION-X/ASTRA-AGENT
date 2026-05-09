import type { loadBuiltinPackageRecords } from "./builtin-package-records.js";

type BuiltinPackageRecord = Awaited<ReturnType<typeof loadBuiltinPackageRecords>>[number];
type MapPackage = NonNullable<BuiltinPackageRecord["mapPackage"]>;
type MapStep = MapPackage["operationalMap"]["steps"][number];

type CommentsTargetCandidateInput = {
  analyzeComments: MapStep | undefined;
  locateComments: MapStep | undefined;
  normalizeComments: MapStep | undefined;
};

type CommentsPersistenceInput = {
  finalizeSeedingBrowseLedger: MapStep | undefined;
  finalizeSeedingPacket: MapStep | undefined;
  writeSeedingEvidence: MapStep | undefined;
};

const hasInputRefs = (step: MapStep | undefined, refs: readonly string[]): boolean =>
  refs.every((ref) => step?.inputRefs.includes(ref) === true);

const hasOutputRef = (step: MapStep | undefined, ref: string): boolean =>
  step?.outputRefPolicy.storeAs.includes(ref) === true;

const hasOutputRefs = (step: MapStep | undefined, refs: readonly string[]): boolean =>
  refs.every((ref) => hasOutputRef(step, ref));

export const hasCommentsObservationPageStateStep = (observeCommentsState: MapStep | undefined): boolean =>
  observeCommentsState?.targetAbilityGroupId === "page-state"
  && observeCommentsState.childCapabilityId === "observe-video-surface"
  && hasInputRefs(observeCommentsState, ["screenshotEvidenceRef", "targetUrl"])
  && hasOutputRef(observeCommentsState, "pageStateRef");

const hasAnalyzeCommentsStep = (analyzeComments: MapStep | undefined): boolean =>
  analyzeComments?.stepKind === "ai"
  && analyzeComments.promptContractId === "vision.commentsEntryTargetCandidate.v1"
  && hasInputRefs(analyzeComments, ["promptInputRef", "screenshotEvidenceRef"])
  && hasOutputRefs(analyzeComments, ["aiTargetCandidateRef", "sourceAiResultRef"]);

const hasLocateAndNormalizeSteps = (
  locateComments: MapStep | undefined,
  normalizeComments: MapStep | undefined,
): boolean => locateComments?.targetAbilityGroupId === "visual-target"
  && locateComments.childCapabilityId === "observe-comments-button"
  && hasInputRefs(locateComments, ["aiTargetCandidateRef", "pageStateRef", "screenshotEvidenceRef"])
  && hasOutputRef(locateComments, "visualTargetRef")
  && normalizeComments?.targetAbilityGroupId === "geometry-guard"
  && normalizeComments.childCapabilityId === "normalize-coordinate-geometry"
  && hasInputRefs(normalizeComments, ["visualTargetRef"]);

export const hasCommentsTargetCandidateSteps = (input: CommentsTargetCandidateInput): boolean =>
  hasAnalyzeCommentsStep(input.analyzeComments)
  && hasLocateAndNormalizeSteps(input.locateComments, input.normalizeComments);

export const hasCommentsClickStep = (clickComments: MapStep | undefined): boolean =>
  clickComments?.targetAbilityGroupId === "mouse-click"
  && clickComments.childCapabilityId === "click-browser-coordinate"
  && hasInputRefs(clickComments, ["visualTargetRef", "geometryProofRef"]);

export const hasCommentsCleanupStep = (extractVisibleComments: MapStep | undefined): boolean =>
  extractVisibleComments?.stepKind === "ai"
  && extractVisibleComments.childCapabilityId === "comment-text-cleanup"
  && extractVisibleComments.promptContractId === "comments.ocr_cleanup.v1"
  && hasInputRefs(extractVisibleComments, ["commentsEvidenceRef"])
  && hasOutputRef(extractVisibleComments, "commentCleanupAiResultRef");

const hasWriteSeedingEvidenceStep = (writeSeedingEvidence: MapStep | undefined): boolean =>
  writeSeedingEvidence?.targetAbilityGroupId === "forensics-persistence"
  && writeSeedingEvidence.childCapabilityId === "write-evidence-record"
  && hasInputRefs(writeSeedingEvidence, ["commentsEvidenceRef"]);

const hasFinalizeSeedingSteps = (
  finalizeSeedingPacket: MapStep | undefined,
  finalizeSeedingBrowseLedger: MapStep | undefined,
): boolean => finalizeSeedingPacket?.targetAbilityGroupId === "forensics-persistence"
  && finalizeSeedingPacket.childCapabilityId === "finalize-evidence-packet"
  && hasInputRefs(finalizeSeedingPacket, ["productPresenceAiResultRef", "commentCleanupAiResultRef"])
  && finalizeSeedingBrowseLedger?.targetAbilityGroupId === "forensics-persistence"
  && finalizeSeedingBrowseLedger.childCapabilityId === "finalize-browse-ledger"
  && hasInputRefs(finalizeSeedingBrowseLedger, ["productPresenceAiResultRef", "evidencePacketRecordRef"]);

export const hasCommentsPersistenceSteps = (input: CommentsPersistenceInput): boolean =>
  hasWriteSeedingEvidenceStep(input.writeSeedingEvidence)
  && hasFinalizeSeedingSteps(input.finalizeSeedingPacket, input.finalizeSeedingBrowseLedger);