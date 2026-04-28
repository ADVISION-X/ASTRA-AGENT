import { createId } from "../../../../lib/local-runtime/ids.js";
import type { EvidenceRef, ImageEvidence, OcrTextResult } from "../../../../types/evidence.js";
import { BrowseLedgerEntrySchema, type BrowseLedgerOutcome, type EvidencePacketDataQualityFlag, type RoundStructuralDecision } from "../../../../types/evidence-packet.js";
import type { ProductOpportunityCandidate } from "../../../../types/product-opportunity.js";
import type { FinalizeRoundArtifactsInput, CommentSignalTaskResult, ProductPresenceTaskResult } from "./finalize-runtime-round.js";
import { buildEvidencePacketArtifactPayload } from "./finalize-runtime-round-packet-persistence.js";

const appendAiFlags = (flags: EvidencePacketDataQualityFlag[], input: { decision: RoundStructuralDecision; productPresenceResult: ProductPresenceTaskResult | null }) => {
  if (!input.productPresenceResult) return;
  flags.push("local_ai_ok");
  if (input.productPresenceResult.result.isProductVideo === null || input.productPresenceResult.result.confidence < 0.75) flags.push("local_ai_low_confidence");
  if (input.decision === "local_ai_unavailable") flags.push("local_ai_unavailable");
};

const appendCommentFlags = (flags: EvidencePacketDataQualityFlag[], input: { commentEvidence: ImageEvidence | null; commentEvidenceFailureReason: string | null; ocrResult: OcrTextResult | null }) => {
  if (input.commentEvidenceFailureReason) flags.push("comment_panel_failed");
  if (input.ocrResult) flags.push(input.ocrResult.confidence >= 0.7 ? "ocr_ok" : "ocr_low_quality");
};

const appendCandidateFlags = (flags: EvidencePacketDataQualityFlag[], input: { candidate: ProductOpportunityCandidate | null; commentEvidence: ImageEvidence | null; decision: RoundStructuralDecision }) => {
  if (input.candidate) flags.push(input.commentEvidence ? "richer_candidate" : "video_only_candidate");
  if (input.decision === "review_required") flags.push("review_required");
};

export function buildDataQualityFlags(input: {
  decision: RoundStructuralDecision;
  videoEvidence: ImageEvidence | null;
  productPresenceResult: ProductPresenceTaskResult | null;
  geometryStatus: string;
  commentEvidence: ImageEvidence | null;
  commentEvidenceFailureReason: string | null;
  ocrResult: OcrTextResult | null;
  candidate: ProductOpportunityCandidate | null;
  additionalDataQualityFlags: EvidencePacketDataQualityFlag[];
}): EvidencePacketDataQualityFlag[] {
  const flags: EvidencePacketDataQualityFlag[] = ["metrics_partially_unavailable", input.videoEvidence ? "video_screenshot_ok" : "video_screenshot_missing", input.commentEvidence ? "comment_screenshot_ok" : "comment_screenshot_missing", input.geometryStatus.toLowerCase().includes("mismatch") ? "geometry_mismatch" : "geometry_calibrated"];
  appendAiFlags(flags, { decision: input.decision, productPresenceResult: input.productPresenceResult });
  appendCommentFlags(flags, { commentEvidence: input.commentEvidence, commentEvidenceFailureReason: input.commentEvidenceFailureReason, ocrResult: input.ocrResult });
  appendCandidateFlags(flags, { candidate: input.candidate, commentEvidence: input.commentEvidence, decision: input.decision });
  flags.push(...input.additionalDataQualityFlags);
  return [...new Set(flags)];
}

function toBrowseDecision(decision: RoundStructuralDecision, productPresenceResult: ProductPresenceTaskResult | null) {
  if (!productPresenceResult || decision === "not_asked") return "not_asked";
  return decision === "product_yes_high_confidence" || decision === "product_no_high_confidence" || decision === "product_uncertain" ? decision : "review_required";
}

function buildEvidenceRefs(input: {
  evidenceStore: FinalizeRoundArtifactsInput["evidenceStore"];
  videoEvidence: ImageEvidence | null;
  commentEvidence: ImageEvidence | null;
  candidate: ProductOpportunityCandidate | null;
}): EvidenceRef[] {
  const evidenceRefs: EvidenceRef[] = [];
  if (input.videoEvidence) evidenceRefs.push(input.evidenceStore.toEvidenceRef(input.videoEvidence));
  if (input.commentEvidence) evidenceRefs.push(input.evidenceStore.toEvidenceRef(input.commentEvidence));
  if (input.candidate) evidenceRefs.push(input.evidenceStore.toCandidateEvidenceRef(input.candidate));
  return evidenceRefs;
}

export function buildBrowseLedgerEntryArtifact(input: {
  finalizerInput: FinalizeRoundArtifactsInput;
  actionLogRefs: string[];
  productPresenceResult: ProductPresenceTaskResult | null;
}) {
  return BrowseLedgerEntrySchema.parse({
    sessionId: input.finalizerInput.taskRunId,
    roundId: input.finalizerInput.round.id,
    videoVisitId: input.finalizerInput.round.videoVisitId,
    observedAt: new Date().toISOString(),
    browseOutcome: input.finalizerInput.browseOutcome,
    productPresenceDecision: toBrowseDecision(input.finalizerInput.decision, input.productPresenceResult),
    confidence: input.productPresenceResult?.result.confidence ?? null,
    skipReason: input.finalizerInput.decisionReason,
    actionLogRefs: input.actionLogRefs,
    lightweightOnly: true,
  });
}

export async function persistRoundArtifact(input: {
  finalizerInput: FinalizeRoundArtifactsInput;
  videoEvidence: ImageEvidence | null;
  productPresenceResult: ProductPresenceTaskResult | null;
  commentEvidence: ImageEvidence | null;
  ocrResult: OcrTextResult | null;
  candidate: ProductOpportunityCandidate | null;
  commentSignalResult: CommentSignalTaskResult | null;
  dataQualityFlags: EvidencePacketDataQualityFlag[];
}) {
  const createsPacketArtifact = input.finalizerInput.artifactKind === "evidence_packet" || input.finalizerInput.artifactKind === "failed_packet";
  const packetId = input.finalizerInput.artifactKind === "browse_ledger" ? null : createId("packet");
  const evidenceRefs = buildEvidenceRefs({ evidenceStore: input.finalizerInput.evidenceStore, videoEvidence: input.videoEvidence, commentEvidence: input.commentEvidence, candidate: input.candidate });
  const actionLogRefs = input.finalizerInput.actionLogs.map((item) => item.id);
  const aiResultRefs = [...(input.productPresenceResult ? [input.productPresenceResult.id] : []), ...(input.commentSignalResult ? [input.commentSignalResult.id] : [])];

  if (!createsPacketArtifact) {
    buildBrowseLedgerEntryArtifact({ finalizerInput: input.finalizerInput, actionLogRefs, productPresenceResult: input.productPresenceResult });
    return { packetId, evidenceRefs, actionLogRefs, aiResultRefs };
  }

  if (!input.videoEvidence || !input.productPresenceResult || !packetId) {
    throw new Error("evidence packet finalization requires video evidence, AI result, and packet id");
  }

  await buildEvidencePacketArtifactPayload({ finalizerInput: input.finalizerInput, packetId, videoEvidence: input.videoEvidence, productPresenceResult: input.productPresenceResult, commentEvidence: input.commentEvidence, commentSignalResult: input.commentSignalResult, ocrResult: input.ocrResult, candidate: input.candidate, evidenceRefs, actionLogRefs, aiResultRefs, dataQualityFlags: input.dataQualityFlags, allowedUse: ["advanced_product_research"], forbiddenUse: ["automatic_procurement", "automatic_ad_decision", "treat_like_as_purchase_intent"] });
  return { packetId, evidenceRefs, actionLogRefs, aiResultRefs };
}