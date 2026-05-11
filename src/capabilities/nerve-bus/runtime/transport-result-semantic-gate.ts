import type { NerveBusPayloadDocument } from "../ports/nerve-bus-transport-port.js";
import type {
  ForwardTransportEnvelope,
  MirroredTransportEnvelope,
  SupportedEnvelope,
  SupportedResultEnvelope,
} from "../shared/nerve-bus-channel.js";

type SemanticGateInput = {
  envelope: SupportedEnvelope;
  resultEnvelope: SupportedResultEnvelope;
  outputPayload: NerveBusPayloadDocument | null;
};

type ForwardSemanticGateInput = SemanticGateInput & { envelope: ForwardTransportEnvelope };
type MirroredSemanticGateInput = SemanticGateInput & { envelope: MirroredTransportEnvelope };

type AbilityCommandEnvelope = Extract<SupportedEnvelope, { envelopeKind: "ability_command" }>;
type AiRequestEnvelope = Extract<SupportedEnvelope, { envelopeKind: "ai_request" }>;
type HumanCommandEnvelope = Extract<SupportedEnvelope, { envelopeKind: "human_command" }>;
type AbilityResultEnvelope = Extract<SupportedEnvelope, { envelopeKind: "ability_result" }>;
type AiResponseEnvelope = Extract<SupportedEnvelope, { envelopeKind: "ai_response" }>;
type HumanCommandResultEnvelope = Extract<SupportedEnvelope, { envelopeKind: "human_command_result" }>;

type GateRule<TInput extends SemanticGateInput = SemanticGateInput> = (input: TInput) => string | null;

const findFirstFailure = <TInput extends SemanticGateInput>(input: TInput, rules: Array<GateRule<TInput>>): string | null => {
  for (const rule of rules) {
    const failure = rule(input);
    if (failure) {
      return failure;
    }
  }
  return null;
};

const SHARED_CHAIN_RULES: Array<GateRule<SemanticGateInput>> = [
  (input) => input.resultEnvelope.missionId !== input.envelope.missionId ? "Result envelope missionId must match the request envelope." : null,
  (input) => input.resultEnvelope.runId !== input.envelope.runId ? "Result envelope runId must match the request envelope." : null,
  (input) => input.resultEnvelope.sessionId !== input.envelope.sessionId ? "Result envelope sessionId must match the request envelope." : null,
  (input) => input.resultEnvelope.roundId !== input.envelope.roundId ? "Result envelope roundId must match the request envelope." : null,
  (input) => input.resultEnvelope.videoVisitId !== input.envelope.videoVisitId ? "Result envelope videoVisitId must match the request envelope." : null,
  (input) => input.resultEnvelope.mapId !== input.envelope.mapId ? "Result envelope mapId must match the request envelope." : null,
  (input) => input.resultEnvelope.bindingPackageId !== input.envelope.bindingPackageId ? "Result envelope bindingPackageId must match the request envelope." : null,
  (input) => input.resultEnvelope.bindingPackageVersion !== input.envelope.bindingPackageVersion ? "Result envelope bindingPackageVersion must match the request envelope." : null,
  (input) => input.resultEnvelope.selectedBindingId !== input.envelope.selectedBindingId ? "Result envelope selectedBindingId must match the request envelope." : null,
  (input) => input.resultEnvelope.bindingVersion !== input.envelope.bindingVersion ? "Result envelope bindingVersion must match the request envelope." : null,
  (input) => input.resultEnvelope.bindingActivationRef !== input.envelope.bindingActivationRef ? "Result envelope bindingActivationRef must match the request envelope." : null,
  (input) => input.resultEnvelope.bindingSnapshotRef !== input.envelope.bindingSnapshotRef ? "Result envelope bindingSnapshotRef must match the request envelope." : null,
  (input) => input.resultEnvelope.stepId !== input.envelope.stepId ? "Result envelope stepId must match the request envelope." : null,
  (input) => input.resultEnvelope.transportId !== input.envelope.transportId ? "Result envelope transportId must match the request envelope." : null,
  (input) => input.resultEnvelope.traceId !== input.envelope.traceId ? "Result envelope traceId must match the request envelope." : null,
  (input) => input.resultEnvelope.attemptId !== input.envelope.attemptId ? "Result envelope attemptId must match the request envelope." : null,
  (input) => input.resultEnvelope.capabilityCallId !== input.envelope.capabilityCallId ? "Result envelope capabilityCallId must match the request envelope." : null,
  (input) => input.resultEnvelope.sourceRef !== input.envelope.sourceRef ? "Result envelope sourceRef must match the request envelope." : null,
  (input) => input.resultEnvelope.idempotencyKey !== input.envelope.idempotencyKey ? "Result envelope idempotencyKey must match the request envelope." : null,
  (input) => input.resultEnvelope.sequenceNo !== input.envelope.sequenceNo ? "Result envelope sequenceNo must match the request envelope." : null,
  (input) => input.resultEnvelope.inputRef !== input.envelope.inputRef ? "Result envelope inputRef must match the request envelope." : null,
];

const FORWARD_CORRELATION_RULES: Array<GateRule<ForwardSemanticGateInput>> = [
  (input) => input.resultEnvelope.correlationEnvelopeId !== input.envelope.envelopeId ? "Result envelope correlationEnvelopeId must match the request envelopeId." : null,
  (input) => input.resultEnvelope.correlationCapabilityCallId !== input.envelope.capabilityCallId ? "Result envelope correlationCapabilityCallId must match the request capabilityCallId." : null,
  (input) => input.resultEnvelope.correlationInputRef !== input.envelope.inputRef ? "Result envelope correlationInputRef must match the request inputRef." : null,
  (input) => !input.resultEnvelope.proofRef ? "Result envelope proofRef is required." : null,
];

const MIRRORED_CORRELATION_RULES: Array<GateRule<MirroredSemanticGateInput>> = [
  (input) => input.resultEnvelope.correlationEnvelopeId !== input.envelope.correlationEnvelopeId ? "Mirrored result envelope correlationEnvelopeId must remain stable." : null,
  (input) => input.resultEnvelope.correlationCapabilityCallId !== input.envelope.correlationCapabilityCallId ? "Mirrored result envelope correlationCapabilityCallId must remain stable." : null,
  (input) => input.resultEnvelope.correlationInputRef !== input.envelope.correlationInputRef ? "Mirrored result envelope correlationInputRef must remain stable." : null,
  (input) => input.resultEnvelope.proofRef !== input.envelope.proofRef ? "Mirrored result envelope proofRef must remain stable." : null,
];

const STATUS_SHAPE_RULES: Array<GateRule<SemanticGateInput>> = [
  (input) => input.resultEnvelope.status === "success" && !input.resultEnvelope.outputRef ? "Successful result envelopes must carry outputRef." : null,
  (input) => input.resultEnvelope.status === "failed" && !input.resultEnvelope.failureReason ? "Failed result envelopes must carry failureReason." : null,
  (input) => input.resultEnvelope.status === "review_required" && !input.resultEnvelope.reviewRequiredReason ? "Review-required result envelopes must carry reviewRequiredReason." : null,
  (input) => input.resultEnvelope.status !== "success" && !input.resultEnvelope.diagnosticPayloadRef ? "Non-success result envelopes must carry diagnosticPayloadRef." : null,
  (input) => input.resultEnvelope.outputRef && !input.resultEnvelope.payloadRef.includes(input.resultEnvelope.outputRef) ? "Result envelope outputRef must remain traceable through payloadRef." : null,
  (input) => input.resultEnvelope.diagnosticPayloadRef && !input.resultEnvelope.payloadRef.includes(input.resultEnvelope.diagnosticPayloadRef) ? "Result envelope diagnosticPayloadRef must remain traceable through payloadRef." : null,
  (input) => input.resultEnvelope.status === "success" && input.outputPayload && input.resultEnvelope.outputRef !== input.outputPayload.documentRef ? "Successful result envelope outputRef must match the produced output payload documentRef." : null,
  (input) => input.resultEnvelope.status !== "success" && input.outputPayload && input.resultEnvelope.diagnosticPayloadRef !== input.outputPayload.documentRef ? "Non-success result envelope diagnosticPayloadRef must match the produced diagnostic payload documentRef." : null,
  (input) => !input.outputPayload && input.resultEnvelope.status === "success" ? "Successful transport results must produce governed output payload." : null,
];

const isForwardEnvelope = (envelope: SupportedEnvelope): envelope is ForwardTransportEnvelope => (
  envelope.envelopeKind === "ability_command"
  || envelope.envelopeKind === "ai_request"
  || envelope.envelopeKind === "human_command"
);

const validateSharedChain = (input: SemanticGateInput): string | null => {
  return findFirstFailure(input, SHARED_CHAIN_RULES);
};

const validateStatusShape = (input: SemanticGateInput): string | null => {
  return findFirstFailure(input, STATUS_SHAPE_RULES);
};

const hasReversedRoute = (input: SemanticGateInput): boolean =>
  input.resultEnvelope.from === input.envelope.to && input.resultEnvelope.to === input.envelope.from;

const validateForwardCorrelation = (input: ForwardSemanticGateInput): string | null => {
  return findFirstFailure(input, FORWARD_CORRELATION_RULES);
};

const validateMirroredCorrelation = (input: MirroredSemanticGateInput): string | null => {
  return findFirstFailure(input, MIRRORED_CORRELATION_RULES);
};

const validateAbilityEnvelopePairing = (input: SemanticGateInput & { envelope: AbilityCommandEnvelope }): string | null => {
  if (input.resultEnvelope.envelopeKind !== "ability_result") {
    return "Ability command transport must return an ability_result envelope.";
  }
  if (input.resultEnvelope.channelId !== "ability-to-orchestration") {
    return "Ability command transport must return on ability-to-orchestration.";
  }
  if (!hasReversedRoute(input)) {
    return "Ability result envelope must reverse from/to relative to the request envelope.";
  }
  return input.resultEnvelope.resultId !== `${input.envelope.commandId}:result`
    ? "Ability result envelope must remain traceable to the request commandId."
    : null;
};

const validateAiEnvelopePairing = (input: SemanticGateInput & { envelope: AiRequestEnvelope }): string | null => {
  if (input.resultEnvelope.envelopeKind !== "ai_response") {
    return "AI request transport must return an ai_response envelope.";
  }
  if (input.resultEnvelope.channelId !== "ai-to-orchestration") {
    return "AI request transport must return on ai-to-orchestration.";
  }
  if (!hasReversedRoute(input)) {
    return "AI response envelope must reverse from/to relative to the request envelope.";
  }
  return input.resultEnvelope.responseId !== `${input.envelope.requestId}:response`
    ? "AI response envelope must remain traceable to the requestId."
    : null;
};

const validateHumanEnvelopePairing = (input: SemanticGateInput & { envelope: HumanCommandEnvelope }): string | null => {
  if (input.resultEnvelope.envelopeKind !== "human_command_result") {
    return "Human command transport must return a human_command_result envelope.";
  }
  if (input.resultEnvelope.channelId !== "orchestration-to-commander") {
    return "Human command transport must return on orchestration-to-commander.";
  }
  if (!hasReversedRoute(input)) {
    return "Human command result envelope must reverse from/to relative to the request envelope.";
  }
  return input.resultEnvelope.resultId !== `${input.envelope.commandId}:result`
    ? "Human command result envelope must remain traceable to the commandId."
    : null;
};

const validateMirroredAbilityPairing = (input: SemanticGateInput & { envelope: AbilityResultEnvelope }): string | null => {
  if (input.resultEnvelope.envelopeKind !== "ability_result") {
    return "Mirrored ability transport must keep ability_result envelope kind.";
  }
  if (input.resultEnvelope.channelId !== input.envelope.channelId) {
    return "Mirrored ability transport must stay on ability-to-orchestration.";
  }
  if (input.resultEnvelope.envelopeId !== input.envelope.envelopeId) {
    return "Mirrored ability transport must preserve envelopeId.";
  }
  return input.resultEnvelope.resultId !== input.envelope.resultId
    ? "Mirrored ability transport must preserve resultId."
    : null;
};

const validateMirroredAiPairing = (input: SemanticGateInput & { envelope: AiResponseEnvelope }): string | null => {
  if (input.resultEnvelope.envelopeKind !== "ai_response") {
    return "Mirrored AI transport must keep ai_response envelope kind.";
  }
  if (input.resultEnvelope.channelId !== input.envelope.channelId) {
    return "Mirrored AI transport must stay on ai-to-orchestration.";
  }
  if (input.resultEnvelope.envelopeId !== input.envelope.envelopeId) {
    return "Mirrored AI transport must preserve envelopeId.";
  }
  return input.resultEnvelope.responseId !== input.envelope.responseId
    ? "Mirrored AI transport must preserve responseId."
    : null;
};

const validateMirroredHumanPairing = (input: SemanticGateInput & { envelope: HumanCommandResultEnvelope }): string | null => {
  if (input.resultEnvelope.envelopeKind !== "human_command_result") {
    return "Mirrored commander transport must keep human_command_result envelope kind.";
  }
  if (input.resultEnvelope.channelId !== input.envelope.channelId) {
    return "Mirrored commander transport must stay on orchestration-to-commander.";
  }
  if (input.resultEnvelope.envelopeId !== input.envelope.envelopeId) {
    return "Mirrored commander transport must preserve envelopeId.";
  }
  return input.resultEnvelope.resultId !== input.envelope.resultId
    ? "Mirrored commander transport must preserve resultId."
    : null;
};

const ENVELOPE_PAIRING_VALIDATORS = {
  ability_command: (input: SemanticGateInput) => validateAbilityEnvelopePairing({ ...input, envelope: input.envelope as AbilityCommandEnvelope }),
  ai_request: (input: SemanticGateInput) => validateAiEnvelopePairing({ ...input, envelope: input.envelope as AiRequestEnvelope }),
  human_command: (input: SemanticGateInput) => validateHumanEnvelopePairing({ ...input, envelope: input.envelope as HumanCommandEnvelope }),
  ability_result: (input: SemanticGateInput) => validateMirroredAbilityPairing({ ...input, envelope: input.envelope as AbilityResultEnvelope }),
  ai_response: (input: SemanticGateInput) => validateMirroredAiPairing({ ...input, envelope: input.envelope as AiResponseEnvelope }),
  human_command_result: (input: SemanticGateInput) => validateMirroredHumanPairing({ ...input, envelope: input.envelope as HumanCommandResultEnvelope }),
} as const;

const validateEnvelopePairing = (input: SemanticGateInput): string | null => {
  return ENVELOPE_PAIRING_VALIDATORS[input.envelope.envelopeKind](input);
};

export function enforceTransportResultSemanticGate(input: SemanticGateInput): { ok: true } | { ok: false; reason: string } {
  const failureReason = validateEnvelopePairing(input)
    ?? validateSharedChain(input)
    ?? (isForwardEnvelope(input.envelope)
      ? validateForwardCorrelation({ ...input, envelope: input.envelope })
      : validateMirroredCorrelation({ ...input, envelope: input.envelope }))
    ?? validateStatusShape(input);

  return failureReason ? { ok: false, reason: failureReason } : { ok: true };
}