import { AbilityResultEnvelopeSchema, AiResponseEnvelopeSchema, HumanCommandResultEnvelopeSchema } from "./schema.js";
import { ABILITY_TO_ORCHESTRATION_CHILD } from "./children/ability-to-orchestration/implementation.js";
import { AI_TO_ORCHESTRATION_CHILD } from "./children/ai-to-orchestration/implementation.js";
import { COMMANDER_TO_ORCHESTRATION_CHILD } from "./children/commander-to-orchestration/implementation.js";
import { ORCHESTRATION_TO_ABILITY_CHILD } from "./children/orchestration-to-ability/implementation.js";
import { ORCHESTRATION_TO_AI_CHILD } from "./children/orchestration-to-ai/implementation.js";
import { ORCHESTRATION_TO_COMMANDER_CHILD } from "./children/orchestration-to-commander/implementation.js";
import type { NerveBusChildDefinition, SupportedEnvelope, SupportedResultEnvelope } from "./shared/nerve-bus-channel.js";
import type { NerveBusChannelRegistryEntry } from "./shared/nerve-bus-policy.js";

const DEFAULT_MAX_DURATION_MS = 15_000;
const DEFAULT_MAX_ENVELOPE_AGE_MS = 120_000;

export const NERVE_BUS_CHANNEL_REGISTRY = Object.freeze({
  "commander-to-orchestration": Object.freeze({
    childCapabilityId: "commander-to-orchestration",
    channelId: "commander-to-orchestration",
    allowedFrom: ["commander-console"],
    allowedTo: ["orchestration"],
    envelopeSchema: COMMANDER_TO_ORCHESTRATION_CHILD.inputSchema,
    resultSchema: HumanCommandResultEnvelopeSchema,
    requiresPayloadRef: true,
    requiresIdempotencyKey: true,
    requiresExpiry: true,
    maxDurationMs: DEFAULT_MAX_DURATION_MS,
    maxEnvelopeAgeMs: DEFAULT_MAX_ENVELOPE_AGE_MS,
    sequencePolicy: "strict_monotonic",
    retryPolicy: "none",
    timeoutPolicy: "fail_closed",
  }),
  "orchestration-to-commander": Object.freeze({
    childCapabilityId: "orchestration-to-commander",
    channelId: "orchestration-to-commander",
    allowedFrom: ["orchestration"],
    allowedTo: ["commander-console"],
    envelopeSchema: ORCHESTRATION_TO_COMMANDER_CHILD.inputSchema,
    resultSchema: HumanCommandResultEnvelopeSchema,
    requiresPayloadRef: true,
    requiresIdempotencyKey: true,
    requiresExpiry: true,
    maxDurationMs: DEFAULT_MAX_DURATION_MS,
    maxEnvelopeAgeMs: DEFAULT_MAX_ENVELOPE_AGE_MS,
    sequencePolicy: "strict_monotonic",
    retryPolicy: "none",
    timeoutPolicy: "fail_closed",
  }),
  "orchestration-to-ability": Object.freeze({
    childCapabilityId: "orchestration-to-ability",
    channelId: "orchestration-to-ability",
    allowedFrom: ["orchestration"],
    allowedTo: ["open", "screenshot", "visual-target", "geometry-guard", "mouse-click", "mouse-scroll", "post-action-verification", "forensics-persistence", "page-state"],
    envelopeSchema: ORCHESTRATION_TO_ABILITY_CHILD.inputSchema,
    resultSchema: AbilityResultEnvelopeSchema,
    requiresPayloadRef: true,
    requiresIdempotencyKey: true,
    requiresExpiry: true,
    maxDurationMs: DEFAULT_MAX_DURATION_MS,
    maxEnvelopeAgeMs: DEFAULT_MAX_ENVELOPE_AGE_MS,
    sequencePolicy: "strict_monotonic",
    retryPolicy: "none",
    timeoutPolicy: "fail_closed",
  }),
  "ability-to-orchestration": Object.freeze({
    childCapabilityId: "ability-to-orchestration",
    channelId: "ability-to-orchestration",
    allowedFrom: ["open", "screenshot", "visual-target", "geometry-guard", "mouse-click", "mouse-scroll", "post-action-verification", "forensics-persistence", "page-state"],
    allowedTo: ["orchestration"],
    envelopeSchema: ABILITY_TO_ORCHESTRATION_CHILD.inputSchema,
    resultSchema: AbilityResultEnvelopeSchema,
    requiresPayloadRef: true,
    requiresIdempotencyKey: true,
    requiresExpiry: true,
    maxDurationMs: DEFAULT_MAX_DURATION_MS,
    maxEnvelopeAgeMs: DEFAULT_MAX_ENVELOPE_AGE_MS,
    sequencePolicy: "strict_monotonic",
    retryPolicy: "none",
    timeoutPolicy: "fail_closed",
  }),
  "orchestration-to-ai": Object.freeze({
    childCapabilityId: "orchestration-to-ai",
    channelId: "orchestration-to-ai",
    allowedFrom: ["orchestration"],
    allowedTo: ["ai"],
    envelopeSchema: ORCHESTRATION_TO_AI_CHILD.inputSchema,
    resultSchema: AiResponseEnvelopeSchema,
    requiresPayloadRef: true,
    requiresIdempotencyKey: true,
    requiresExpiry: true,
    maxDurationMs: DEFAULT_MAX_DURATION_MS,
    maxEnvelopeAgeMs: DEFAULT_MAX_ENVELOPE_AGE_MS,
    sequencePolicy: "strict_monotonic",
    retryPolicy: "none",
    timeoutPolicy: "fail_closed",
  }),
  "ai-to-orchestration": Object.freeze({
    childCapabilityId: "ai-to-orchestration",
    channelId: "ai-to-orchestration",
    allowedFrom: ["ai"],
    allowedTo: ["orchestration"],
    envelopeSchema: AI_TO_ORCHESTRATION_CHILD.inputSchema,
    resultSchema: AiResponseEnvelopeSchema,
    requiresPayloadRef: true,
    requiresIdempotencyKey: true,
    requiresExpiry: true,
    maxDurationMs: DEFAULT_MAX_DURATION_MS,
    maxEnvelopeAgeMs: DEFAULT_MAX_ENVELOPE_AGE_MS,
    sequencePolicy: "strict_monotonic",
    retryPolicy: "none",
    timeoutPolicy: "fail_closed",
  }),
});

const CHILDREN = Object.freeze({
  "commander-to-orchestration": COMMANDER_TO_ORCHESTRATION_CHILD,
  "orchestration-to-commander": ORCHESTRATION_TO_COMMANDER_CHILD,
  "orchestration-to-ability": ORCHESTRATION_TO_ABILITY_CHILD,
  "ability-to-orchestration": ABILITY_TO_ORCHESTRATION_CHILD,
  "orchestration-to-ai": ORCHESTRATION_TO_AI_CHILD,
  "ai-to-orchestration": AI_TO_ORCHESTRATION_CHILD,
});

export function listNerveBusChildren(): string[] {
  return Object.keys(CHILDREN);
}

export function getNerveBusChild(channelId: keyof typeof CHILDREN): NerveBusChildDefinition<SupportedEnvelope, SupportedResultEnvelope> {
  return CHILDREN[channelId];
}

export function getNerveBusChannelRegistryEntry(channelId: keyof typeof NERVE_BUS_CHANNEL_REGISTRY): NerveBusChannelRegistryEntry<SupportedEnvelope, SupportedResultEnvelope> {
  return NERVE_BUS_CHANNEL_REGISTRY[channelId];
}
