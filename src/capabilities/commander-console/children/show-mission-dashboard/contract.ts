import type { z } from "zod";

import type { CommanderReadChildContract } from "../../contract.js";
import { CommanderEvidencePolicySchema } from "../../schema.js";
import { ShowMissionDashboardBoundaryPolicySchema, ShowMissionDashboardInputSchema, ShowMissionDashboardOutputSchema, ShowMissionDashboardProofPolicySchema, ShowMissionDashboardReadinessSchema } from "./schema.js";

export const SHOW_MISSION_DASHBOARD_CHILD_ID = "show-mission-dashboard";

export const SHOW_MISSION_DASHBOARD_CONTRACT: CommanderReadChildContract = {
  childCapabilityId: SHOW_MISSION_DASHBOARD_CHILD_ID,
  childKind: "read",
  purpose: "Return the Commander-owned dashboard view composed from governed read models.",
  allowedCaller: "commander-console",
  boundaryDecision: "read-port-only",
  ownedCommandType: null,
  readModelSource: "mission-read-model",
  requiresOperatorRef: true,
  hardStopPriority: null,
  maxDurationMs: 4000,
  idempotencyPolicy: "idempotent-read",
  boundaryPolicy: ShowMissionDashboardBoundaryPolicySchema.parse({
    allowedCaller: "commander-console",
    boundaryDecision: "read-port-only",
    ownedCommandType: null,
    readModelSource: "mission-read-model",
    requiresOperatorRef: true,
    hardStopPriority: null,
    maxDurationMs: 4000,
    idempotencyPolicy: "idempotent-read",
  }),
  evidencePolicy: CommanderEvidencePolicySchema.parse({
    sourceAbility: "commander-console",
    targetRecordRequired: false,
    proofRefRequired: false,
    recordTypes: ["mission", "candidate", "evidence-packet", "browse-ledger", "failed-record", "runtime-event"],
  }),
  proofPolicy: ShowMissionDashboardProofPolicySchema.parse({
    requiresRuntimeProof: true,
    requiresGovernedReceipt: false,
    requiresStructuredEvidenceRefs: true,
    requiresFailureReceipt: false,
    requiresTransportDecision: false,
    requiresReadDecision: true,
    requiresHardStopDecision: false,
  }),
  readiness: ShowMissionDashboardReadinessSchema.parse({
    requiresCommandTransport: false,
    requiresReadModel: true,
    requiresHardPath: false,
  }),
};

export type ShowMissionDashboardInput = z.infer<typeof ShowMissionDashboardInputSchema>;
export type ShowMissionDashboardOutput = z.infer<typeof ShowMissionDashboardOutputSchema>;