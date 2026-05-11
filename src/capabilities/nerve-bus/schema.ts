/**
 * Nerve Bus — schema constants and Zod schema foundation.
 * Law: No directional channel children. Only governed envelope transport.
 * No infra systems beyond direct handlerPort calls.
 */

import { z } from "zod";

export const NERVE_BUS_ABILITY_GROUP_ID = "nerve-bus" as const;

export const NERVE_BUS_CHILD_IDS = [
  "dispatch-governed-envelope",
  "return-governed-result",
] as const;

export type NerveBusChildId = (typeof NERVE_BUS_CHILD_IDS)[number];

export const GOVERNED_ABILITY_GROUP_IDS: readonly string[] = [
  "orchestration",
  "ai",
  "commander-console",
  "screenshot",
  "visual-target",
  "geometry-guard",
  "mouse-click",
  "mouse-scroll",
  "text-input",
  "open",
  "forensics-persistence",
] as const;

export const NERVE_BUS_DEFAULT_TIMEOUT_MS = 30_000;

export const NerveBusPayloadDocumentSchema = z.record(z.string(), z.unknown());
export type NerveBusPayloadDocument = z.infer<typeof NerveBusPayloadDocumentSchema>;

const EnvelopeBaseSchema = z.object({
  envelopeId: z.string(),
  missionId: z.string(),
  runId: z.string(),
  sessionId: z.string().nullable(),
  roundId: z.string().nullable(),
  issuedAt: z.string(),
});

export const AbilityCommandEnvelopeSchema = EnvelopeBaseSchema.extend({
  kind: z.literal("ability-command"),
  abilityGroupId: z.string(),
  childCapabilityId: z.string(),
  inputOverrides: z.record(z.string(), z.unknown()),
});
export type AbilityCommandEnvelope = z.infer<typeof AbilityCommandEnvelopeSchema>;

export const AbilityResultEnvelopeSchema = EnvelopeBaseSchema.extend({
  kind: z.literal("ability-result"),
  commandEnvelopeId: z.string(),
  abilityGroupId: z.string(),
  childCapabilityId: z.string(),
  status: z.enum(["success", "failed", "review_required"]),
  failureReason: z.string().nullable(),
  receivedAt: z.string(),
});
export type AbilityResultEnvelope = z.infer<typeof AbilityResultEnvelopeSchema>;

export const AiRequestEnvelopeSchema = EnvelopeBaseSchema.extend({
  kind: z.literal("ai-request"),
  requestType: z.string(),
});
export type AiRequestEnvelope = z.infer<typeof AiRequestEnvelopeSchema>;

export const AiResponseEnvelopeSchema = EnvelopeBaseSchema.extend({
  kind: z.literal("ai-response"),
  requestEnvelopeId: z.string(),
  status: z.enum(["success", "failed"]),
  failureReason: z.string().nullable(),
  receivedAt: z.string(),
});
export type AiResponseEnvelope = z.infer<typeof AiResponseEnvelopeSchema>;

export const HumanCommandEnvelopeSchema = EnvelopeBaseSchema.extend({
  kind: z.literal("human-command"),
  commandType: z.string(),
});
export type HumanCommandEnvelope = z.infer<typeof HumanCommandEnvelopeSchema>;

export const HumanCommandResultEnvelopeSchema = EnvelopeBaseSchema.extend({
  kind: z.literal("human-command-result"),
  commandEnvelopeId: z.string(),
  status: z.enum(["success", "failed"]),
  failureReason: z.string().nullable(),
  receivedAt: z.string(),
});
export type HumanCommandResultEnvelope = z.infer<typeof HumanCommandResultEnvelopeSchema>;
