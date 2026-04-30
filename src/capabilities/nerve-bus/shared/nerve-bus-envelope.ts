import type { z } from "zod";

import type {
  AbilityCommandEnvelopeSchema,
  AbilityResultEnvelopeSchema,
  AiRequestEnvelopeSchema,
  AiResponseEnvelopeSchema,
  HumanCommandEnvelopeSchema,
  HumanCommandResultEnvelopeSchema,
  NerveBusEnvelopeBaseSchema,
} from "../schema.js";

export type NerveBusEnvelopeBase = z.infer<typeof NerveBusEnvelopeBaseSchema>;
export type AbilityCommandEnvelope = z.infer<typeof AbilityCommandEnvelopeSchema>;
export type AbilityResultEnvelope = z.infer<typeof AbilityResultEnvelopeSchema>;
export type AiRequestEnvelope = z.infer<typeof AiRequestEnvelopeSchema>;
export type AiResponseEnvelope = z.infer<typeof AiResponseEnvelopeSchema>;
export type HumanCommandEnvelope = z.infer<typeof HumanCommandEnvelopeSchema>;
export type HumanCommandResultEnvelope = z.infer<typeof HumanCommandResultEnvelopeSchema>;
