import { resolveAiProductPresenceOutputSummary } from "../../capabilities/ai/index.js";
import { payloadDocumentToObject } from "./workbench-payload.js";
import {
  buildForensicsBaseInput,
  buildProductPresenceDecision,
  buildRoundStructuralDecision,
} from "./workbench-forensics-dispatch-builders.js";
import {
  requireString,
  resolvePayloadString,
} from "./workbench-forensics-dispatch-values.js";
import {
  type WorkbenchForensicsEnvelope,
  type WorkbenchForensicsBrowseLedgerInput,
} from "./workbench-forensics-dispatch-types.js";

type ProductPresenceSummary = NonNullable<ReturnType<typeof resolveAiProductPresenceOutputSummary>>;

type BrowseLedgerContext = {
  envelope: WorkbenchForensicsEnvelope;
  productPresenceSummary: ProductPresenceSummary;
  roundId: string;
  videoVisitId: string;
  productPresenceAiResultRef: string;
  clickResultRef: string | null;
  postActionVerificationResultRef: string | null;
  packetId: string;
  roundLogId: string;
  actionLogRefs: string[];
  dataQualityFlags: string[];
};

const resolveBinaryDecision = (summary: ProductPresenceSummary) =>
  summary.output.isProductVideo === true ? "product_yes" : "product_no";

const buildBrowseLedgerInputRefs = (context: BrowseLedgerContext) => [
  context.productPresenceAiResultRef,
  ...context.actionLogRefs,
  ...(context.postActionVerificationResultRef ? [context.postActionVerificationResultRef] : []),
];

const buildBrowseLedgerPayload = (context: BrowseLedgerContext) => ({
  browseLedgerEntry: {
    sessionId: context.envelope.sessionId,
    roundId: context.roundId,
    videoVisitId: context.videoVisitId,
    observedAt: context.productPresenceSummary.capturedAt,
    browseOutcome: "ordinary_scroll_next",
    productPresenceDecision: buildProductPresenceDecision(resolveBinaryDecision(context.productPresenceSummary), context.productPresenceSummary.output.mustReview),
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
    productPresenceDecision: buildRoundStructuralDecision(resolveBinaryDecision(context.productPresenceSummary), context.productPresenceSummary.output.mustReview),
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
  const clickResultRef = resolvePayloadString(payload, "clickResultRef");
  const postActionVerificationResultRef = resolvePayloadString(payload, "postActionVerificationResultRef");
  const productPresenceSummary = resolveAiProductPresenceOutputSummary(productPresenceAiResultRef);

  if (!productPresenceSummary) {
    throw new Error("Workbench forensics dispatch could not resolve product presence AI summary for browse ledger finalization.");
  }

  const actionLogRefs = clickResultRef ? [clickResultRef] : [];

  return {
    envelope,
    productPresenceSummary,
    roundId,
    videoVisitId,
    productPresenceAiResultRef,
    clickResultRef,
    postActionVerificationResultRef,
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
      actionRef: context.clickResultRef,
      postActionVerificationRef: context.postActionVerificationResultRef,
      dataQualityFlags: context.dataQualityFlags,
    }),
    payload: buildBrowseLedgerPayload(context),
  }));
};