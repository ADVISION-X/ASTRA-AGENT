import type { z } from "zod";

import { CommanderToOrchestrationEnvelopeSchema, CommanderToOrchestrationResultSchema } from "./schema.js";

export type CommanderToOrchestrationEnvelope = z.infer<typeof CommanderToOrchestrationEnvelopeSchema>;
export type CommanderToOrchestrationResult = z.infer<typeof CommanderToOrchestrationResultSchema>;
