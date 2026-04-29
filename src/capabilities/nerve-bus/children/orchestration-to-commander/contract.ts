import type { z } from "zod";

import { OrchestrationToCommanderEnvelopeSchema, OrchestrationToCommanderResultSchema } from "./schema.js";

export type OrchestrationToCommanderEnvelope = z.infer<typeof OrchestrationToCommanderEnvelopeSchema>;
export type OrchestrationToCommanderResult = z.infer<typeof OrchestrationToCommanderResultSchema>;
