import type { z } from "zod";

import type { CommanderReadChildContract } from "../../contract.js";
import { CommanderEvidencePolicySchema } from "../../schema.js";
import { ShowAuditSummaryBoundaryPolicySchema, ShowAuditSummaryInputSchema, ShowAuditSummaryOutputSchema, ShowAuditSummaryProofPolicySchema, ShowAuditSummaryReadinessSchema } from "./schema.js";

export const SHOW_AUDIT_SUMMARY_CHILD_ID = "show-audit-summary";

export const SHOW_AUDIT_SUMMARY_CONTRACT: CommanderReadChildContract = {
  childCapabilityId: SHOW_AUDIT_SUMMARY_CHILD_ID,
  childKind: "read",
  purpose: "Return the governed audit summary used by Commander Console.",
  allowedCaller: "commander-console",
  boundaryDecision: "read-port-only",
  ownedCommandType: null,
  readModelSource: "audit-read-model",
  requiresOperatorRef: true,
  hardStopPriority: null,
  maxDurationMs: 60_000,
  idempotencyPolicy: "idempotent-read",
  boundaryPolicy: ShowAuditSummaryBoundaryPolicySchema.parse({
    allowedCaller: "commander-console",
    boundaryDecision: "read-port-only",
    ownedCommandType: null,
    readModelSource: "audit-read-model",
    requiresOperatorRef: true,
    hardStopPriority: null,
    maxDurationMs: 60_000,
    idempotencyPolicy: "idempotent-read",
  }),
  evidencePolicy: CommanderEvidencePolicySchema.parse({
    sourceAbility: "audit-read-model",
    targetRecordRequired: false,
    proofRefRequired: false,
    recordTypes: ["runtime-event"],
  }),
  proofPolicy: ShowAuditSummaryProofPolicySchema.parse({
    requiresRuntimeProof: true,
    requiresGovernedReceipt: false,
    requiresStructuredEvidenceRefs: true,
    requiresFailureReceipt: false,
    requiresTransportDecision: false,
    requiresReadDecision: true,
    requiresHardStopDecision: false,
  }),
  readiness: ShowAuditSummaryReadinessSchema.parse({
    requiresCommandTransport: false,
    requiresReadModel: true,
    requiresHardPath: false,
  }),
};

export type ShowAuditSummaryInput = z.infer<typeof ShowAuditSummaryInputSchema>;
export type ShowAuditSummaryOutput = z.infer<typeof ShowAuditSummaryOutputSchema>;