import { z } from "zod";

export const NERVE_BUS_ABILITY_GROUP_ID = "nerve-bus";

export const GOVERNED_ABILITY_GROUP_IDS = [
  "commander-console",
  "orchestration",
  "nerve-bus",
  "ai",
  "open",
  "screenshot",
  "visual-target",
  "geometry-guard",
  "mouse-click",
  "text-input",
  "mouse-scroll",
  "post-action-verification",
  "forensics-persistence",
  "page-state",
] as const;

export const ABILITY_TARGET_IDS = [
  "open",
  "screenshot",
  "visual-target",
  "geometry-guard",
  "mouse-click",
  "text-input",
  "mouse-scroll",
  "post-action-verification",
  "forensics-persistence",
  "page-state",
] as const;

export const NERVE_BUS_CHANNEL_IDS = [
  "commander-to-orchestration",
  "orchestration-to-commander",
  "orchestration-to-ability",
  "ability-to-orchestration",
  "orchestration-to-ai",
  "ai-to-orchestration",
] as const;

export const NERVE_BUS_CHILD_IDS = NERVE_BUS_CHANNEL_IDS;
export const COMMANDER_TARGET_IDS = ["orchestration"] as const;
export const AI_TARGET_IDS = ["ai"] as const;
export const ROUTABLE_EXECUTION_TARGET_IDS = [...ABILITY_TARGET_IDS, ...AI_TARGET_IDS] as const;

export const GovernedAbilityGroupIdSchema = z.enum(GOVERNED_ABILITY_GROUP_IDS);
export const NerveBusAbilityGroupIdSchema = z.literal(NERVE_BUS_ABILITY_GROUP_ID);
export const NerveBusChannelIdSchema = z.enum(NERVE_BUS_CHANNEL_IDS);
export const NerveBusChildCapabilityIdSchema = z.enum(NERVE_BUS_CHILD_IDS);
export const AbilityTargetIdSchema = z.enum(ABILITY_TARGET_IDS);
export const CommanderTargetIdSchema = z.enum(COMMANDER_TARGET_IDS);
export const AiTargetIdSchema = z.enum(AI_TARGET_IDS);
export const RoutableExecutionTargetIdSchema = z.enum(ROUTABLE_EXECUTION_TARGET_IDS);
export const EnvelopeStatusSchema = z.enum(["success", "failed", "review_required"]);
export const TransportDecisionSchema = z.enum(["executed", "duplicate_skipped", "replay_rejected", "queue_rejected"]);
export const PolicyDecisionSchema = z.enum(["allowed", "forbidden_route"]);
export const QueueDecisionSchema = z.enum(["acquired", "queue_rejected", "not_started"]);
export const SequenceDecisionSchema = z.enum(["accepted", "out_of_order", "duplicate", "not_started"]);
export const IntegrityDecisionSchema = z.enum([
  "valid",
  "invalid_schema",
  "missing_payload_ref",
  "missing_input_ref",
  "stale",
  "expired",
  "out_of_order",
  "mismatched_result",
  "payload_ref_policy_failed",
]);
export const IdempotencyDecisionSchema = z.enum(["executed", "duplicate_skipped", "replay_rejected"]);
export const TimeoutDecisionSchema = z.enum(["within_timeout", "timed_out", "not_started"]);
export const HandlerDecisionSchema = z.enum(["executed", "missing_handler", "threw", "invalid_result", "timed_out", "aborted", "not_invoked"]);
export const CircuitBreakerStateSchema = z.enum(["closed"]);

export const IsoDateTimeSchema = z.string().datetime();
export const NonEmptyRefSchema = z.string().min(1);
export const PayloadRefListSchema = z.array(NonEmptyRefSchema).min(1).max(20);
export const EnvelopeIdSchema = z.string().min(1);
export const TraceIdSchema = z.string().min(1);
export const SpanIdSchema = z.string().min(1);
export const AttemptIdSchema = z.string().min(1);
export const IdempotencyKeySchema = z.string().min(1);
export const InputRefSchema = z.string().min(1);
export const OutputRefSchema = z.string().min(1);
export const MissionIdSchema = z.string().min(1);
export const MapIdSchema = z.string().min(1);
export const StepIdSchema = z.string().min(1);
export const SequenceNoSchema = z.number().int().min(0);

export const NerveBusPayloadAttributeValueSchema = z.union([z.string().min(1), z.number().finite(), z.boolean(), z.null()]);
export const NerveBusPayloadAttributeSchema = z.object({
  key: z.string().min(1),
  value: NerveBusPayloadAttributeValueSchema,
}).strict();

export const NerveBusPayloadMetadataSchema = z.object({
  summary: z.string().min(1).max(400).nullable().default(null),
  entityRefs: z.array(NonEmptyRefSchema).max(50).default([]),
  evidenceRefs: z.array(NonEmptyRefSchema).max(50).default([]),
  tags: z.array(NonEmptyRefSchema).max(50).default([]),
  attributes: z.array(NerveBusPayloadAttributeSchema).max(100).default([]),
}).strict();

export const NerveBusPayloadDocumentSchema = z.object({
  documentType: z.string().min(1),
  documentRef: z.string().min(1),
  summary: z.string().min(1).max(400),
  entityRefs: z.array(NonEmptyRefSchema).max(50).default([]),
  evidenceRefs: z.array(NonEmptyRefSchema).max(50).default([]),
  contentBlocks: z.array(
    z.object({
      key: z.string().min(1),
      value: z.union([z.string().min(1).max(5000), z.number().finite(), z.boolean(), z.null()]),
    }).strict(),
  ).max(100).default([]),
}).strict();

export const NerveBusEnvelopeBaseSchema = z.object({
  abilityGroupId: NerveBusAbilityGroupIdSchema,
  channelId: NerveBusChannelIdSchema,
  envelopeId: EnvelopeIdSchema,
  transportId: z.string().min(1),
  traceId: TraceIdSchema,
  spanId: SpanIdSchema,
  attemptId: AttemptIdSchema,
  missionId: MissionIdSchema,
  mapId: MapIdSchema,
  stepId: StepIdSchema,
  idempotencyKey: IdempotencyKeySchema,
  sequenceNo: SequenceNoSchema,
  inputRef: InputRefSchema,
  payloadRef: PayloadRefListSchema,
  payload: NerveBusPayloadMetadataSchema,
  createdAt: IsoDateTimeSchema,
  expiresAt: IsoDateTimeSchema,
}).strict();

export const AbilityCommandEnvelopeSchema = NerveBusEnvelopeBaseSchema.extend({
  envelopeKind: z.literal("ability_command"),
  channelId: z.literal("orchestration-to-ability"),
  commandId: z.string().min(1),
  from: z.literal("orchestration"),
  to: AbilityTargetIdSchema,
  commandName: z.string().min(1),
}).strict();

export const AbilityResultEnvelopeSchema = NerveBusEnvelopeBaseSchema.extend({
  envelopeKind: z.literal("ability_result"),
  channelId: z.literal("ability-to-orchestration"),
  resultId: z.string().min(1),
  from: AbilityTargetIdSchema,
  to: z.literal("orchestration"),
  abilityGroupId: z.literal(NERVE_BUS_ABILITY_GROUP_ID),
  status: EnvelopeStatusSchema,
  outputRef: OutputRefSchema.nullable(),
  diagnosticPayloadRef: OutputRefSchema.nullable().default(null),
  failureReason: z.string().min(1).nullable(),
  reviewRequiredReason: z.string().min(1).nullable(),
}).strict();

export const AiRequestEnvelopeSchema = NerveBusEnvelopeBaseSchema.extend({
  envelopeKind: z.literal("ai_request"),
  channelId: z.literal("orchestration-to-ai"),
  requestId: z.string().min(1),
  from: z.literal("orchestration"),
  to: z.literal("ai"),
  taskType: z.string().min(1),
  promptRef: z.string().min(1),
}).strict();

export const AiResponseEnvelopeSchema = NerveBusEnvelopeBaseSchema.extend({
  envelopeKind: z.literal("ai_response"),
  channelId: z.literal("ai-to-orchestration"),
  responseId: z.string().min(1),
  from: z.literal("ai"),
  to: z.literal("orchestration"),
  status: EnvelopeStatusSchema,
  decision: z.string().min(1),
  confidence: z.number().min(0).max(1).nullable(),
  outputRef: OutputRefSchema.nullable(),
  diagnosticPayloadRef: OutputRefSchema.nullable().default(null),
  failureReason: z.string().min(1).nullable(),
  reviewRequiredReason: z.string().min(1).nullable(),
}).strict();

export const HumanCommandEnvelopeSchema = NerveBusEnvelopeBaseSchema.extend({
  envelopeKind: z.literal("human_command"),
  channelId: z.literal("commander-to-orchestration"),
  commandId: z.string().min(1),
  from: z.literal("commander-console"),
  to: CommanderTargetIdSchema,
  commandType: z.string().min(1),
}).strict();

export const HumanCommandResultEnvelopeSchema = NerveBusEnvelopeBaseSchema.extend({
  envelopeKind: z.literal("human_command_result"),
  channelId: z.literal("orchestration-to-commander"),
  resultId: z.string().min(1),
  from: z.literal("orchestration"),
  to: z.literal("commander-console"),
  status: EnvelopeStatusSchema,
  outputRef: OutputRefSchema.nullable(),
  diagnosticPayloadRef: OutputRefSchema.nullable().default(null),
  failureReason: z.string().min(1).nullable(),
  reviewRequiredReason: z.string().min(1).nullable(),
}).strict();

export const AbilityCommandDispatchInputSchema = z.object({
  envelope: AbilityCommandEnvelopeSchema,
  inputPayload: NerveBusPayloadDocumentSchema,
}).strict();

export const AiRequestDispatchInputSchema = z.object({
  envelope: AiRequestEnvelopeSchema,
  inputPayload: NerveBusPayloadDocumentSchema,
}).strict();

export const HumanCommandDispatchInputSchema = z.object({
  envelope: HumanCommandEnvelopeSchema,
  inputPayload: NerveBusPayloadDocumentSchema,
}).strict();

export const NerveBusTransportProofSchema = z.object({
  proofId: z.string().min(1),
  transportId: z.string().min(1),
  traceId: TraceIdSchema,
  spanId: SpanIdSchema,
  missionId: MissionIdSchema,
  mapId: MapIdSchema,
  stepId: StepIdSchema,
  channelId: NerveBusChannelIdSchema,
  from: GovernedAbilityGroupIdSchema,
  to: GovernedAbilityGroupIdSchema,
  envelopeId: EnvelopeIdSchema,
  attemptId: AttemptIdSchema,
  idempotencyKey: IdempotencyKeySchema,
  sequenceNo: SequenceNoSchema,
  payloadRef: PayloadRefListSchema,
  inputRef: InputRefSchema,
  outputRef: OutputRefSchema.nullable(),
  diagnosticPayloadRef: OutputRefSchema.nullable(),
  startedAt: IsoDateTimeSchema,
  endedAt: IsoDateTimeSchema,
  durationMs: z.number().int().min(0),
  status: EnvelopeStatusSchema,
  failureReason: z.string().min(1).nullable(),
  reviewRequiredReason: z.string().min(1).nullable(),
  policyDecision: PolicyDecisionSchema,
  integrityDecision: IntegrityDecisionSchema,
  idempotencyDecision: IdempotencyDecisionSchema,
  sequenceDecision: SequenceDecisionSchema,
  queueDecision: QueueDecisionSchema,
  timeoutDecision: TimeoutDecisionSchema,
  handlerDecision: HandlerDecisionSchema,
  handlerCallId: z.string().min(1),
  handlerStartedAt: IsoDateTimeSchema,
  handlerEndedAt: IsoDateTimeSchema,
  handlerDurationMs: z.number().int().min(0),
  circuitBreakerState: CircuitBreakerStateSchema,
  dataQualityFlags: z.array(z.string().min(1)),
}).strict();

export const AbilityTransportResultSchema = z.object({
  abilityGroupId: NerveBusAbilityGroupIdSchema,
  channelId: z.literal("orchestration-to-ability"),
  status: EnvelopeStatusSchema,
  transportDecision: TransportDecisionSchema,
  commandEnvelope: AbilityCommandEnvelopeSchema,
  resultEnvelope: AbilityResultEnvelopeSchema,
  proof: NerveBusTransportProofSchema,
  failureReason: z.string().min(1).nullable(),
  reviewRequiredReason: z.string().min(1).nullable(),
}).strict();

export const AiTransportResultSchema = z.object({
  abilityGroupId: NerveBusAbilityGroupIdSchema,
  channelId: z.literal("orchestration-to-ai"),
  status: EnvelopeStatusSchema,
  transportDecision: TransportDecisionSchema,
  requestEnvelope: AiRequestEnvelopeSchema,
  responseEnvelope: AiResponseEnvelopeSchema,
  proof: NerveBusTransportProofSchema,
  failureReason: z.string().min(1).nullable(),
  reviewRequiredReason: z.string().min(1).nullable(),
}).strict();

export const HumanCommandTransportResultSchema = z.object({
  abilityGroupId: NerveBusAbilityGroupIdSchema,
  channelId: z.literal("commander-to-orchestration"),
  status: EnvelopeStatusSchema,
  transportDecision: TransportDecisionSchema,
  commandEnvelope: HumanCommandEnvelopeSchema,
  resultEnvelope: HumanCommandResultEnvelopeSchema,
  proof: NerveBusTransportProofSchema,
  failureReason: z.string().min(1).nullable(),
  reviewRequiredReason: z.string().min(1).nullable(),
}).strict();
