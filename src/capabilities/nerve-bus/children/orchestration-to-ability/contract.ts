import type { z } from "zod";

import { OrchestrationToAbilityEnvelopeSchema, OrchestrationToAbilityResultSchema } from "./schema.js";

export type OrchestrationToAbilityEnvelope = z.infer<typeof OrchestrationToAbilityEnvelopeSchema>;
export type OrchestrationToAbilityResult = z.infer<typeof OrchestrationToAbilityResultSchema>;
