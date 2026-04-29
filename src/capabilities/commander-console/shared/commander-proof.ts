import type { z } from "zod";

import type { CommanderBoundaryDecisionSchema, CommanderCommandPrioritySchema, RuntimeProofSchema } from "../schema.js";

export type CommanderBoundaryDecision = z.infer<typeof CommanderBoundaryDecisionSchema>;
export type CommanderCommandPriority = z.infer<typeof CommanderCommandPrioritySchema>;
export type CommanderRuntimeProof = z.infer<typeof RuntimeProofSchema>;