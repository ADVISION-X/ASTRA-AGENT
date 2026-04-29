import type { z } from "zod";

import type {
  AbilityTransportResultSchema,
  AiTransportResultSchema,
  EnvelopeStatusSchema,
  HumanCommandTransportResultSchema,
  TransportDecisionSchema,
} from "../schema.js";

export type NerveBusTransportStatus = z.infer<typeof EnvelopeStatusSchema>;
export type NerveBusTransportDecision = z.infer<typeof TransportDecisionSchema>;
export type AbilityTransportResult = z.infer<typeof AbilityTransportResultSchema>;
export type AiTransportResult = z.infer<typeof AiTransportResultSchema>;
export type HumanCommandTransportResult = z.infer<typeof HumanCommandTransportResultSchema>;
