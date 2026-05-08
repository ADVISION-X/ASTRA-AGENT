import { z, type RefinementCtx } from "zod";

const NERVE_BUS_ABILITY_GROUP_ID = "nerve-bus";

const GOVERNED_ABILITY_GROUP_IDS = [
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
  "forensics-persistence",
  "page-state",
  "post-action-verification",
] as const;

const ABILITY_TARGET_IDS = [
  "open",
  "screenshot",
  "visual-target",
  "geometry-guard",
  "mouse-click",
  "text-input",
  "mouse-scroll",
  "forensics-persistence",
  "page-state",
  "post-action-verification",
] as const;

const FORWARD_CHANNEL_IDS = [
  "commander-to-orchestration",
  "orchestration-to-ability",
  "orchestration-to-ai",
] as const;

const MIRRORED_CHANNEL_IDS = [
  "orchestration-to-commander",
  "ability-to-orchestration",
  "ai-to-orchestration",
] as const;

const NERVE_BUS_CHANNEL_IDS = [
  "commander-to-orchestration",
  "orchestration-to-commander",
  "orchestration-to-ability",
  "ability-to-orchestration",
  "orchestration-to-ai",
  "ai-to-orchestration",
] as const;

const NERVE_BUS_CHILD_IDS = NERVE_BUS_CHANNEL_IDS;
const NERVE_BUS_ENVELOPE_KINDS = [
  "human_command",
  "human_command_result",
  "ability_command",
  "ability_result",
  "ai_request",
  "ai_response",
] as const;
const COMMANDER_TARGET_IDS = ["orchestration"] as const;
const AI_TARGET_IDS = ["ai"] as const;
const ROUTABLE_EXECUTION_TARGET_IDS = [...ABILITY_TARGET_IDS, ...AI_TARGET_IDS] as const;

const GovernedAbilityGroupIdSchema = z.enum(GOVERNED_ABILITY_GROUP_IDS);
const NerveBusAbilityGroupIdSchema = z.literal(NERVE_BUS_ABILITY_GROUP_ID);
const ForwardChannelIdSchema = z.enum(FORWARD_CHANNEL_IDS);
const MirroredChannelIdSchema = z.enum(MIRRORED_CHANNEL_IDS);
const NerveBusChannelIdSchema = z.enum(NERVE_BUS_CHANNEL_IDS);
const NerveBusChildCapabilityIdSchema = z.enum(NERVE_BUS_CHILD_IDS);
const NerveBusEnvelopeKindSchema = z.enum(NERVE_BUS_ENVELOPE_KINDS);
const AbilityTargetIdSchema = z.enum(ABILITY_TARGET_IDS);
const CommanderTargetIdSchema = z.enum(COMMANDER_TARGET_IDS);
const AiTargetIdSchema = z.enum(AI_TARGET_IDS);
const RoutableExecutionTargetIdSchema = z.enum(ROUTABLE_EXECUTION_TARGET_IDS);
const EnvelopeStatusSchema = z.enum(["success", "failed", "review_required"]);
const TransportDecisionSchema = z.enum(["executed", "duplicate_skipped", "replay_rejected", "queue_rejected"]);
const PolicyDecisionSchema = z.enum(["allowed", "forbidden_route"]);
const QueueDecisionSchema = z.enum(["acquired", "queue_rejected", "not_started"]);
const SequenceDecisionSchema = z.enum(["accepted", "out_of_order", "duplicate", "not_started"]);
const IntegrityDecisionSchema = z.enum([
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
const IdempotencyDecisionSchema = z.enum(["executed", "duplicate_skipped", "replay_rejected"]);
const TimeoutDecisionSchema = z.enum(["within_timeout", "timed_out", "not_started"]);
const HandlerDecisionSchema = z.enum(["executed", "missing_handler", "threw", "invalid_result", "timed_out", "aborted", "not_invoked"]);
const CircuitBreakerStateSchema = z.enum(["closed"]);
const SemanticDecisionSchema = z.enum(["passed", "failed", "not_started"]);

const IsoDateTimeSchema = z.string().datetime();
const NonEmptyRefSchema = z.string().min(1);
const NullableRefSchema = NonEmptyRefSchema.nullable().default(null);
const PayloadRefListSchema = z.array(NonEmptyRefSchema).min(1).max(20);
const EnvelopeIdSchema = z.string().min(1);
const TraceIdSchema = z.string().min(1);
const SpanIdSchema = z.string().min(1);
const AttemptIdSchema = z.string().min(1);
const IdempotencyKeySchema = z.string().min(1);
const InputRefSchema = z.string().min(1);
const OutputRefSchema = z.string().min(1);
const ProofRefSchema = z.string().min(1);
const MissionIdSchema = z.string().min(1);
const RunIdSchema = z.string().min(1);
const SessionIdSchema = z.string().min(1);
const RoundIdSchema = NullableRefSchema;
const VideoVisitIdSchema = NullableRefSchema;
const MapIdSchema = z.string().min(1);
const MapPackageIdSchema = z.string().min(1);
const MapPackageVersionSchema = z.string().min(1);
const SelectedMapIdSchema = z.string().min(1);
const SelectedMapVersionSchema = z.string().min(1);
const ActivationIdSchema = z.string().min(1);
const ActivationSnapshotRefSchema = z.string().min(1);
const CapabilityCallIdSchema = z.string().min(1);
const SourceRefSchema = z.string().min(1);
const StepIdSchema = z.string().min(1);
const SequenceNoSchema = z.number().int().min(0);
const TargetChildCapabilityIdSchema = z.string().min(1);
const RequestedPlatformIdSchema = z.string().min(1).nullable().default(null);
const TargetRecordRefSchema = z.string().min(1).nullable().default(null);
const OutputSchemaRefSchema = z.string().min(1);
const PolicyRefSchema = z.string().min(1).nullable().default(null);
const AiInputRefsSchema = z.array(NonEmptyRefSchema).min(1).max(20);

const NerveBusPayloadAttributeValueSchema = z.union([z.string().min(1), z.number().finite(), z.boolean(), z.null()]);
const NerveBusPayloadAttributeSchema = z.object({
  key: z.string().min(1),
  value: NerveBusPayloadAttributeValueSchema,
}).strict();

const NerveBusPayloadMetadataSchema = z.object({
  summary: z.string().min(1).max(400).nullable().default(null),
  entityRefs: z.array(NonEmptyRefSchema).max(50).default([]),
  evidenceRefs: z.array(NonEmptyRefSchema).max(50).default([]),
  tags: z.array(NonEmptyRefSchema).max(50).default([]),
  attributes: z.array(NerveBusPayloadAttributeSchema).max(100).default([]),
}).strict();

const NerveBusPayloadContentBlockSchema = z.object({
  key: z.string().min(1),
  value: z.union([z.string().min(1).max(5000), z.number().finite(), z.boolean(), z.null()]),
}).strict();

const NerveBusPayloadDocumentSchema = z.object({
  documentType: z.string().min(1),
  documentRef: z.string().min(1),
  summary: z.string().min(1).max(400),
  entityRefs: z.array(NonEmptyRefSchema).max(50).default([]),
  evidenceRefs: z.array(NonEmptyRefSchema).max(50).default([]),
  contentBlocks: z.array(NerveBusPayloadContentBlockSchema).max(100).default([]),
}).strict();

const NerveBusEnvelopeBaseCoreSchema = z.object({
  abilityGroupId: NerveBusAbilityGroupIdSchema,
  channelId: NerveBusChannelIdSchema,
  envelopeKind: NerveBusEnvelopeKindSchema,
  envelopeId: EnvelopeIdSchema,
  nerveBusEnvelopeId: EnvelopeIdSchema,
  transportId: z.string().min(1),
  traceId: TraceIdSchema,
  spanId: SpanIdSchema,
  attemptId: AttemptIdSchema,
  missionId: MissionIdSchema,
  runId: RunIdSchema,
  sessionId: SessionIdSchema,
  roundId: RoundIdSchema,
  videoVisitId: VideoVisitIdSchema,
  mapId: MapIdSchema,
  mapPackageId: MapPackageIdSchema,
  mapPackageVersion: MapPackageVersionSchema,
  selectedMapId: SelectedMapIdSchema,
  selectedMapVersion: SelectedMapVersionSchema,
  activationId: ActivationIdSchema,
  activationSnapshotRef: ActivationSnapshotRefSchema,
  stepId: StepIdSchema,
  capabilityCallId: CapabilityCallIdSchema,
  sourceRef: SourceRefSchema,
  idempotencyKey: IdempotencyKeySchema,
  sequenceNo: SequenceNoSchema,
  inputRef: InputRefSchema,
  payloadRef: PayloadRefListSchema,
  payload: NerveBusPayloadMetadataSchema,
  createdAt: IsoDateTimeSchema,
  expiresAt: IsoDateTimeSchema,
}).strict();

function validateNerveBusEnvelopeBase(value: z.infer<typeof NerveBusEnvelopeBaseCoreSchema>, context: RefinementCtx) {
  if (value.nerveBusEnvelopeId !== value.envelopeId) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "nerveBusEnvelopeId must match envelopeId.", path: ["nerveBusEnvelopeId"] });
  }
  if (value.mapId !== value.selectedMapId) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "mapId must stay aligned with selectedMapId.", path: ["mapId"] });
  }
}

const NerveBusEnvelopeBaseSchema = NerveBusEnvelopeBaseCoreSchema.superRefine(validateNerveBusEnvelopeBase);

export {
  NERVE_BUS_ABILITY_GROUP_ID,
  GOVERNED_ABILITY_GROUP_IDS,
  ABILITY_TARGET_IDS,
  FORWARD_CHANNEL_IDS,
  MIRRORED_CHANNEL_IDS,
  NERVE_BUS_CHANNEL_IDS,
  NERVE_BUS_CHILD_IDS,
  NERVE_BUS_ENVELOPE_KINDS,
  COMMANDER_TARGET_IDS,
  AI_TARGET_IDS,
  ROUTABLE_EXECUTION_TARGET_IDS,
  GovernedAbilityGroupIdSchema,
  NerveBusAbilityGroupIdSchema,
  ForwardChannelIdSchema,
  MirroredChannelIdSchema,
  NerveBusChannelIdSchema,
  NerveBusChildCapabilityIdSchema,
  NerveBusEnvelopeKindSchema,
  AbilityTargetIdSchema,
  CommanderTargetIdSchema,
  AiTargetIdSchema,
  RoutableExecutionTargetIdSchema,
  EnvelopeStatusSchema,
  TransportDecisionSchema,
  PolicyDecisionSchema,
  QueueDecisionSchema,
  SequenceDecisionSchema,
  IntegrityDecisionSchema,
  IdempotencyDecisionSchema,
  TimeoutDecisionSchema,
  HandlerDecisionSchema,
  CircuitBreakerStateSchema,
  SemanticDecisionSchema,
  IsoDateTimeSchema,
  NonEmptyRefSchema,
  NullableRefSchema,
  PayloadRefListSchema,
  EnvelopeIdSchema,
  TraceIdSchema,
  SpanIdSchema,
  AttemptIdSchema,
  IdempotencyKeySchema,
  InputRefSchema,
  OutputRefSchema,
  ProofRefSchema,
  MissionIdSchema,
  RunIdSchema,
  SessionIdSchema,
  RoundIdSchema,
  VideoVisitIdSchema,
  MapIdSchema,
  MapPackageIdSchema,
  MapPackageVersionSchema,
  SelectedMapIdSchema,
  SelectedMapVersionSchema,
  ActivationIdSchema,
  ActivationSnapshotRefSchema,
  CapabilityCallIdSchema,
  SourceRefSchema,
  StepIdSchema,
  SequenceNoSchema,
  TargetChildCapabilityIdSchema,
  RequestedPlatformIdSchema,
  TargetRecordRefSchema,
  OutputSchemaRefSchema,
  PolicyRefSchema,
  AiInputRefsSchema,
  NerveBusPayloadAttributeValueSchema,
  NerveBusPayloadAttributeSchema,
  NerveBusPayloadMetadataSchema,
  NerveBusPayloadDocumentSchema,
  NerveBusEnvelopeBaseCoreSchema,
  validateNerveBusEnvelopeBase,
  NerveBusEnvelopeBaseSchema,
};
