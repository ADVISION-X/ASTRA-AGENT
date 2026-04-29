import type { z } from "zod";

import type {
  CommanderBoundaryPolicySchema,
  CommanderEvidencePolicySchema,
  CommanderProofPolicySchema,
  CommanderReadinessSchema,
} from "./commander-schema-base.js";

export type CommanderBoundaryPolicy = z.infer<typeof CommanderBoundaryPolicySchema>;
export type CommanderEvidencePolicy = z.infer<typeof CommanderEvidencePolicySchema>;
export type CommanderProofPolicy = z.infer<typeof CommanderProofPolicySchema>;
export type CommanderReadiness = z.infer<typeof CommanderReadinessSchema>;