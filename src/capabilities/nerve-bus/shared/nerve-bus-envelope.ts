import type { z } from "zod";

import type {
  AbilityCommandEnvelopeSchema,
  AbilityCommandDispatchInputSchema,
  AbilityResultEnvelopeSchema,
  AiRequestDispatchInputSchema,
  AiRequestEnvelopeSchema,
  AiResponseEnvelopeSchema,
  HumanCommandDispatchInputSchema,
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
export type AbilityCommandDispatchInput = z.infer<typeof AbilityCommandDispatchInputSchema>;
export type AiRequestDispatchInput = z.infer<typeof AiRequestDispatchInputSchema>;
export type HumanCommandDispatchInput = z.infer<typeof HumanCommandDispatchInputSchema>;
