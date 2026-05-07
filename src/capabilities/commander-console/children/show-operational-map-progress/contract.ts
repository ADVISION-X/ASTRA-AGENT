import type { z } from "zod";

import type { CommanderReadChildContract } from "../../contract.js";
import { CommanderEvidencePolicySchema } from "../../schema.js";
import { ShowOperationalMapProgressBoundaryPolicySchema, ShowOperationalMapProgressInputSchema, ShowOperationalMapProgressOutputSchema, ShowOperationalMapProgressProofPolicySchema, ShowOperationalMapProgressReadinessSchema } from "./schema.js";

export const SHOW_OPERATIONAL_MAP_PROGRESS_CHILD_ID = "show-operational-map-progress";

export const SHOW_OPERATIONAL_MAP_PROGRESS_CONTRACT: CommanderReadChildContract = {
  childCapabilityId: SHOW_OPERATIONAL_MAP_PROGRESS_CHILD_ID,
  childKind: "read",
  purpose: "Return Commander-owned operational map progress sourced from the mission read model.",
  allowedCaller: "commander-console",
  boundaryDecision: "read-port-only",
  ownedCommandType: null,
  readModelSource: "mission-read-model",
  requiresOperatorRef: true,
  hardStopPriority: null,
  maxDurationMs: 60_000,
  idempotencyPolicy: "idempotent-read",
  boundaryPolicy: ShowOperationalMapProgressBoundaryPolicySchema.parse({
    allowedCaller: "commander-console",
    boundaryDecision: "read-port-only",
    ownedCommandType: null,
    readModelSource: "mission-read-model",
    requiresOperatorRef: true,
    hardStopPriority: null,
    maxDurationMs: 60_000,
    idempotencyPolicy: "idempotent-read",
  }),
  evidencePolicy: CommanderEvidencePolicySchema.parse({
    sourceAbility: "mission-read-model",
    targetRecordRequired: false,
    proofRefRequired: false,
    recordTypes: ["mission"],
  }),
  proofPolicy: ShowOperationalMapProgressProofPolicySchema.parse({
    requiresRuntimeProof: true,
    requiresGovernedReceipt: false,
    requiresStructuredEvidenceRefs: true,
    requiresFailureReceipt: false,
    requiresTransportDecision: false,
    requiresReadDecision: true,
    requiresHardStopDecision: false,
  }),
  readiness: ShowOperationalMapProgressReadinessSchema.parse({
    requiresCommandTransport: false,
    requiresReadModel: true,
    requiresHardPath: false,
  }),
};

export type ShowOperationalMapProgressInput = z.infer<typeof ShowOperationalMapProgressInputSchema>;
export type ShowOperationalMapProgressOutput = z.infer<typeof ShowOperationalMapProgressOutputSchema>;