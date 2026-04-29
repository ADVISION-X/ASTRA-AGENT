import type { z } from "zod";

import { AiToOrchestrationEnvelopeSchema, AiToOrchestrationResultSchema } from "./schema.js";

export type AiToOrchestrationEnvelope = z.infer<typeof AiToOrchestrationEnvelopeSchema>;
export type AiToOrchestrationResult = z.infer<typeof AiToOrchestrationResultSchema>;
