type ResolvedDecisionFields = {
  status: "success" | "failed" | "review_required";
  decision: string;
  taskDecision: string | null;
  pageStateDecision: string | null;
  actionPlan?: Record<string, unknown> | null;
  nonExecutableSummary: string | null;
  reviewRequiredReason?: string | null;
};

type DiagnosticFields = {
  implementationStatus: string | null;
  runtimeCallId: string | null;
  rawOutputRef: string | null;
  rawOutputHash: string | null;
  schemaIssueCount: number | null;
  schemaDecision: string | null;
  schemaValidationStatus: string | null;
  qualityDecision: string | null;
  qualityDecisionReason: string | null;
  outputBoundaryDecision: string | null;
  dataQualityFlags: string[];
};

type OutputPayloadFields = {
  documentRef: string;
};

export function buildWorkbenchAiResponseEnvelopeFields(input: {
  aiTaskType: string;
  confidence: number | null;
  failureReason: string | null;
  minimumConfidence: number | null;
  resolvedDecision: ResolvedDecisionFields;
  outputPayload: OutputPayloadFields;
  diagnostics: DiagnosticFields;
}) {
  return {
    status: input.resolvedDecision.status,
    decision: input.resolvedDecision.decision,
    taskDecision: input.resolvedDecision.taskDecision,
    pageStateDecision: input.resolvedDecision.pageStateDecision,
    actionPlan: input.resolvedDecision.actionPlan ?? null,
    nonExecutableSummary: input.resolvedDecision.nonExecutableSummary,
    confidence: input.confidence,
    implementationStatus: input.diagnostics.implementationStatus,
    runtimeCallId: input.diagnostics.runtimeCallId,
    rawOutputRef: input.diagnostics.rawOutputRef,
    rawOutputHash: input.diagnostics.rawOutputHash,
    schemaIssueCount: input.diagnostics.schemaIssueCount,
    schemaDecision: input.diagnostics.schemaDecision,
    schemaValidationStatus: input.diagnostics.schemaValidationStatus,
    qualityDecision: input.diagnostics.qualityDecision,
    qualityDecisionReason: input.diagnostics.qualityDecisionReason,
    outputBoundaryDecision: input.diagnostics.outputBoundaryDecision,
    minimumConfidence: input.minimumConfidence,
    dataQualityFlags: input.diagnostics.dataQualityFlags,
    parsedDecision: input.resolvedDecision.decision,
    outputRef: input.resolvedDecision.status === "success" ? input.outputPayload.documentRef : null,
    diagnosticPayloadRef: input.resolvedDecision.status === "success" ? null : input.outputPayload.documentRef,
    failureReason: input.resolvedDecision.status === "failed" ? input.failureReason : null,
    reviewRequiredReason: input.resolvedDecision.status === "review_required" ? input.resolvedDecision.reviewRequiredReason : null,
  };
}