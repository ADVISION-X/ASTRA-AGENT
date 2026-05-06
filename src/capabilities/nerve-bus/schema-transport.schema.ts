import { z } from "zod";

import {
  ActivationIdSchema,
  ActivationSnapshotRefSchema,
  AttemptIdSchema,
  CapabilityCallIdSchema,
  CircuitBreakerStateSchema,
  EnvelopeIdSchema,
  EnvelopeStatusSchema,
  GovernedAbilityGroupIdSchema,
  HandlerDecisionSchema,
  IdempotencyDecisionSchema,
  IdempotencyKeySchema,
  InputRefSchema,
  IntegrityDecisionSchema,
  IsoDateTimeSchema,
  MapPackageIdSchema,
  MapPackageVersionSchema,
  MirroredChannelIdSchema,
  MissionIdSchema,
  NerveBusAbilityGroupIdSchema,
  NerveBusChannelIdSchema,
  NerveBusEnvelopeKindSchema,
  NerveBusPayloadDocumentSchema,
  OutputRefSchema,
  OutputSchemaRefSchema,
  PayloadRefListSchema,
  PolicyDecisionSchema,
  QueueDecisionSchema,
  RoundIdSchema,
  RunIdSchema,
  SelectedMapIdSchema,
  SelectedMapVersionSchema,
  SemanticDecisionSchema,
  SequenceDecisionSchema,
  SequenceNoSchema,
  SessionIdSchema,
  SourceRefSchema,
  SpanIdSchema,
  StepIdSchema,
  TimeoutDecisionSchema,
  TraceIdSchema,
  TransportDecisionSchema,
  VideoVisitIdSchema,
} from "./schema-foundation.schema.js";
import {
  AbilityCommandEnvelopeSchema,
  AbilityResultEnvelopeSchema,
  AiRequestEnvelopeSchema,
  AiResponseEnvelopeSchema,
  HumanCommandEnvelopeSchema,
  HumanCommandResultEnvelopeSchema,
} from "./schema-envelope.schema.js";

const AbilityCommandDispatchInputSchema = z.object({
  envelope: AbilityCommandEnvelopeSchema,
  inputPayload: NerveBusPayloadDocumentSchema,
}).strict();

const AbilityResultDispatchInputSchema = z.object({
  envelope: AbilityResultEnvelopeSchema,
  inputPayload: NerveBusPayloadDocumentSchema,
}).strict();

const AiRequestDispatchInputSchema = z.object({
  envelope: AiRequestEnvelopeSchema,
  inputPayload: NerveBusPayloadDocumentSchema,
  signal: z.custom<AbortSignal>((value) => value instanceof AbortSignal).optional(),
}).strict();

const AiResponseDispatchInputSchema = z.object({
  envelope: AiResponseEnvelopeSchema,
  inputPayload: NerveBusPayloadDocumentSchema,
}).strict();

const HumanCommandDispatchInputSchema = z.object({
  envelope: HumanCommandEnvelopeSchema,
  inputPayload: NerveBusPayloadDocumentSchema,
}).strict();

const CommanderMessageDispatchInputSchema = z.object({
  envelope: HumanCommandResultEnvelopeSchema,
  inputPayload: NerveBusPayloadDocumentSchema,
}).strict();

const NerveBusTransportInputSchema = z.union([
  AbilityCommandDispatchInputSchema,
  AbilityResultDispatchInputSchema,
  AiRequestDispatchInputSchema,
  AiResponseDispatchInputSchema,
  HumanCommandDispatchInputSchema,
  CommanderMessageDispatchInputSchema,
]);

const NerveBusTransportProofSchema = z.object({
  proofId: z.string().min(1),
  abilityGroupId: NerveBusAbilityGroupIdSchema,
  channelId: NerveBusChannelIdSchema,
  envelopeKind: NerveBusEnvelopeKindSchema,
  envelopeId: EnvelopeIdSchema,
  nerveBusEnvelopeId: EnvelopeIdSchema,
  correlationEnvelopeId: EnvelopeIdSchema.nullable().default(null),
  transportId: z.string().min(1),
  traceId: TraceIdSchema,
  spanId: SpanIdSchema,
  attemptId: AttemptIdSchema,
  missionId: MissionIdSchema,
  runId: RunIdSchema,
  sessionId: SessionIdSchema,
  roundId: RoundIdSchema,
  videoVisitId: VideoVisitIdSchema,
  stepId: StepIdSchema,
  mapPackageId: MapPackageIdSchema,
  mapPackageVersion: MapPackageVersionSchema,
  selectedMapId: SelectedMapIdSchema,
  selectedMapVersion: SelectedMapVersionSchema,
  activationId: ActivationIdSchema,
  activationSnapshotRef: ActivationSnapshotRefSchema,
  capabilityCallId: CapabilityCallIdSchema,
  sourceRef: SourceRefSchema,
  inputRef: InputRefSchema,
  payloadRef: PayloadRefListSchema,
  outputRef: OutputRefSchema.nullable().default(null),
  diagnosticPayloadRef: OutputRefSchema.nullable().default(null),
  from: GovernedAbilityGroupIdSchema,
  to: GovernedAbilityGroupIdSchema,
  targetAbilityGroupId: GovernedAbilityGroupIdSchema.nullable().default(null),
  targetChildCapabilityId: z.string().min(1).nullable().default(null),
  promptContractId: z.string().min(1).nullable().default(null),
  promptContractVersion: z.string().min(1).nullable().default(null),
  outputSchemaRef: OutputSchemaRefSchema.nullable().default(null),
  idempotencyKey: IdempotencyKeySchema,
  sequenceNo: SequenceNoSchema,
  policyDecision: PolicyDecisionSchema,
  integrityDecision: IntegrityDecisionSchema,
  idempotencyDecision: IdempotencyDecisionSchema,
  sequenceDecision: SequenceDecisionSchema,
  queueDecision: QueueDecisionSchema,
  timeoutDecision: TimeoutDecisionSchema,
  handlerDecision: HandlerDecisionSchema,
  semanticDecision: SemanticDecisionSchema,
  handlerCallId: z.string().min(1),
  handlerStartedAt: IsoDateTimeSchema,
  handlerEndedAt: IsoDateTimeSchema,
  handlerDurationMs: z.number().int().min(0),
  circuitBreakerState: CircuitBreakerStateSchema,
  startedAt: IsoDateTimeSchema,
  endedAt: IsoDateTimeSchema,
  durationMs: z.number().int().min(0),
  status: EnvelopeStatusSchema,
  failureReason: z.string().min(1).nullable().default(null),
  reviewRequiredReason: z.string().min(1).nullable().default(null),
  dataQualityFlags: z.array(z.string().min(1)).default([]),
}).strict();

const AbilityTransportResultSchema = z.object({
  abilityGroupId: NerveBusAbilityGroupIdSchema,
  channelId: z.literal("orchestration-to-ability"),
  status: EnvelopeStatusSchema,
  transportDecision: TransportDecisionSchema,
  commandEnvelope: AbilityCommandEnvelopeSchema,
  resultEnvelope: AbilityResultEnvelopeSchema,
  proof: NerveBusTransportProofSchema,
  failureReason: z.string().min(1).nullable().default(null),
  reviewRequiredReason: z.string().min(1).nullable().default(null),
}).strict();

const AiTransportResultSchema = z.object({
  abilityGroupId: NerveBusAbilityGroupIdSchema,
  channelId: z.literal("orchestration-to-ai"),
  status: EnvelopeStatusSchema,
  transportDecision: TransportDecisionSchema,
  requestEnvelope: AiRequestEnvelopeSchema,
  responseEnvelope: AiResponseEnvelopeSchema,
  proof: NerveBusTransportProofSchema,
  failureReason: z.string().min(1).nullable().default(null),
  reviewRequiredReason: z.string().min(1).nullable().default(null),
}).strict();

const HumanCommandTransportResultSchema = z.object({
  abilityGroupId: NerveBusAbilityGroupIdSchema,
  channelId: z.literal("commander-to-orchestration"),
  status: EnvelopeStatusSchema,
  transportDecision: TransportDecisionSchema,
  commandEnvelope: HumanCommandEnvelopeSchema,
  resultEnvelope: HumanCommandResultEnvelopeSchema,
  proof: NerveBusTransportProofSchema,
  failureReason: z.string().min(1).nullable().default(null),
  reviewRequiredReason: z.string().min(1).nullable().default(null),
}).strict();

const NerveBusMirroredTransportResultSchema = z.object({
  abilityGroupId: NerveBusAbilityGroupIdSchema,
  channelId: MirroredChannelIdSchema,
  status: EnvelopeStatusSchema,
  transportDecision: TransportDecisionSchema,
  transportedEnvelope: z.union([
    AbilityResultEnvelopeSchema,
    AiResponseEnvelopeSchema,
    HumanCommandResultEnvelopeSchema,
  ]),
  proof: NerveBusTransportProofSchema,
  failureReason: z.string().min(1).nullable().default(null),
  reviewRequiredReason: z.string().min(1).nullable().default(null),
}).strict();

const NerveBusTransportResultSchema = z.union([
  AbilityTransportResultSchema,
  AiTransportResultSchema,
  HumanCommandTransportResultSchema,
  NerveBusMirroredTransportResultSchema,
]);

export {
  AbilityCommandDispatchInputSchema,
  AbilityResultDispatchInputSchema,
  AiRequestDispatchInputSchema,
  AiResponseDispatchInputSchema,
  HumanCommandDispatchInputSchema,
  CommanderMessageDispatchInputSchema,
  NerveBusTransportInputSchema,
  NerveBusTransportProofSchema,
  AbilityTransportResultSchema,
  AiTransportResultSchema,
  HumanCommandTransportResultSchema,
  NerveBusMirroredTransportResultSchema,
  NerveBusTransportResultSchema,
};
