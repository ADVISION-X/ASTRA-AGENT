import type { z, ZodType } from "zod";

import type {
  AbilityResultEnvelopeSchema,
  AiResponseEnvelopeSchema,
  EnvelopeStatusSchema,
  HumanCommandResultEnvelopeSchema,
  NerveBusChannelIdSchema,
} from "../schema.js";

export type NerveBusChannelId = z.infer<typeof NerveBusChannelIdSchema>;
export type ChannelResultEnvelope =
  | z.infer<typeof AbilityResultEnvelopeSchema>
  | z.infer<typeof AiResponseEnvelopeSchema>
  | z.infer<typeof HumanCommandResultEnvelopeSchema>;
export type SequenceDecision = "in_order" | "duplicate_sequence" | "out_of_order";
export type NerveBusEnvelopeStatus = z.infer<typeof EnvelopeStatusSchema>;

export type NerveBusChannelRegistryEntry<TEnvelope, TResult extends ChannelResultEnvelope> = {
  childCapabilityId: NerveBusChannelId;
  channelId: NerveBusChannelId;
  allowedFrom: readonly string[];
  allowedTo: readonly string[];
  envelopeSchema: ZodType<TEnvelope>;
  resultSchema: ZodType<TResult>;
  requiresPayloadRef: boolean;
  requiresIdempotencyKey: boolean;
  requiresExpiry: boolean;
  maxDurationMs: number;
  maxEnvelopeAgeMs: number;
  sequencePolicy: "strict_monotonic";
  retryPolicy: "none";
  timeoutPolicy: "fail_closed";
};
