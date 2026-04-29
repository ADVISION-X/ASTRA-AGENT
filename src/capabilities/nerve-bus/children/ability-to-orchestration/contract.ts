import type { z } from "zod";

import { AbilityToOrchestrationEnvelopeSchema, AbilityToOrchestrationResultSchema } from "./schema.js";

export type AbilityToOrchestrationEnvelope = z.infer<typeof AbilityToOrchestrationEnvelopeSchema>;
export type AbilityToOrchestrationResult = z.infer<typeof AbilityToOrchestrationResultSchema>;
