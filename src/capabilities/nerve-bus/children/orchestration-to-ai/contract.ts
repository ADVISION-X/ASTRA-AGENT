import type { z } from "zod";

import { OrchestrationToAiEnvelopeSchema, OrchestrationToAiResultSchema } from "./schema.js";

export type OrchestrationToAiEnvelope = z.infer<typeof OrchestrationToAiEnvelopeSchema>;
export type OrchestrationToAiResult = z.infer<typeof OrchestrationToAiResultSchema>;
