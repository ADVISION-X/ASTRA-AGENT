import { resolveAiProductPresenceOutputSummary } from "../../capabilities/ai/index.js";
import { payloadDocumentToObject } from "./workbench-payload.js";
import {
  buildForensicsBaseInput,
  buildProductPresenceDecision,
  buildRoundStructuralDecision,
  requireString,
  resolvePayloadString,
  type WorkbenchForensicsEnvelope,
  type WorkbenchForensicsBrowseLedgerInput,
} from "./workbench-forensics-dispatch-support.js";

type ProductPresenceSummary = NonNullable<ReturnType<typeof resolveAiProductPresenceOutputSummary>>;

type BrowseLedgerContext = {
  envelope: WorkbenchForensicsEnvelope;
  productPresenceSummary: ProductPresenceSummary;
  roundId: string;
  videoVisitId: string;
  productPresenceAiResultRef: string;
  commentsClickActionRef: string | null;
  commentsOpenVerificationRef: string | null;
  packetId: string;
  roundLogId: string;
  actionLogRefs: string[];
  dataQualityFlags: string[];
};

const buildBrowseLedgerInputRefs = (context: BrowseLedgerContext) => [
  context.productPresenceAiResultRef,
  ...context.actionLogRefs,
  ...(context.commentsOpenVerificationRef ? [context.commentsOpenVerificationRef] : []),
];

const buildBrowseLedgerPayload = (context: BrowseLedgerContext) => ({
  browseLedgerEntry: {
    sessionId: context.envelope.sessionId,
    roundId: context.roundId,
    videoVisitId: context.videoVisitId,
    observedAt: context.productPresenceSummary.capturedAt,
    browseOutcome: "ordinary_scroll_next",
    productPresenceDecision: buildProductPresenceDecision(context.productPresenceSummary.output.decision, context.productPresenceSummary.output.mustReview),
    confidence: context.productPresenceSummary.output.confidence,
    skipReason: null,
    actionLogRefs: context.actionLogRefs,
    lightweightOnly: true,
  },
  roundStructuralLog: {
    logId: context.roundLogId,
    sessionId: context.envelope.sessionId,
    taskRunId: context.envelope.runId,
    roundId: context.roundId,
    videoVisitId: context.videoVisitId,
    packetId: context.packetId,
    finalArtifactKind: "browse_ledger",
    productPresenceDecision: buildRoundStructuralDecision(context.productPresenceSummary.output.decision, context.productPresenceSummary.output.mustReview),
    browseOutcome: "ordinary_scroll_next",
    roundOutcome: "browse_ledger_recorded",
    decisionReason: context.productPresenceSummary.output.reason,
    nextStep: "continue_discovery",
    startTime: context.productPresenceSummary.capturedAt,
    endTime: context.productPresenceSummary.capturedAt,
    evidenceRefs: [],
    actionLogRefs: context.actionLogRefs,
    aiResultRefs: [context.productPresenceSummary.aiResultRef],
    candidateId: null,
    dataQualityFlags: context.dataQualityFlags,
    exportIncluded: true,
    lightweightOnly: true,
  },
  rebuildSessionId: context.envelope.sessionId,
});

const resolveBrowseLedgerContext = (
  envelope: WorkbenchForensicsEnvelope,
  inputPayload: Parameters<typeof payloadDocumentToObject>[0],
): BrowseLedgerContext => {
  const payload = payloadDocumentToObject(inputPayload);
  const roundId = requireString(envelope.roundId, "roundId");
  const videoVisitId = requireString(envelope.videoVisitId, "videoVisitId");
  const productPresenceAiResultRef = requireString(resolvePayloadString(payload, "productPresenceAiResultRef"), "productPresenceAiResultRef");
  const commentsClickActionRef = resolvePayloadString(payload, "commentsClickActionRef");
  const commentsOpenVerificationRef = resolvePayloadString(payload, "commentsOpenVerificationRef");
  const productPresenceSummary = resolveAiProductPresenceOutputSummary(productPresenceAiResultRef);

  if (!productPresenceSummary) {
    throw new Error("Workbench forensics dispatch could not resolve product presence AI summary for browse ledger finalization.");
  }

  const actionLogRefs = commentsClickActionRef ? [commentsClickActionRef] : [];

  return {
    envelope,
    productPresenceSummary,
    roundId,
    videoVisitId,
    productPresenceAiResultRef,
    commentsClickActionRef,
    commentsOpenVerificationRef,
    packetId: `${envelope.sessionId}:${roundId}:${videoVisitId}:packet`,
    roundLogId: `${envelope.sessionId}:${roundId}:${videoVisitId}:round-log:browse-ledger`,
    actionLogRefs,
    dataQualityFlags: ["local_ai_ok", "richer_candidate"],
  };
};

export const buildForensicsBrowseLedgerInput = (
  envelope: WorkbenchForensicsEnvelope,
  inputPayload: Parameters<typeof payloadDocumentToObject>[0],
): WorkbenchForensicsBrowseLedgerInput => {
  const context = resolveBrowseLedgerContext(envelope, inputPayload);

  return JSON.parse(JSON.stringify({
    ...buildForensicsBaseInput({
      envelope,
      childCapabilityId: "finalize-browse-ledger",
      recordType: "browse_ledger_entry",
      inputRefs: buildBrowseLedgerInputRefs(context),
      promptContractId: context.productPresenceSummary.promptContractId,
      promptContractVersion: context.productPresenceSummary.promptContractVersion,
      promptCatalogVersion: context.productPresenceSummary.promptCatalogVersion,
      decisionRef: context.productPresenceSummary.aiProofRef,
      actionRef: context.commentsClickActionRef,
      postActionVerificationRef: context.commentsOpenVerificationRef,
      dataQualityFlags: context.dataQualityFlags,
    }),
    payload: buildBrowseLedgerPayload(context),
  }));
};