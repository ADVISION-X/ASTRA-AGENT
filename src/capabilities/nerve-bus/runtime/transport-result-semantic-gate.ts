import type { NerveBusPayloadDocument } from "../ports/nerve-bus-transport-port.js";
import type { SupportedEnvelope, SupportedResultEnvelope } from "../shared/nerve-bus-channel.js";

type SemanticGateInput = {
  envelope: SupportedEnvelope;
  resultEnvelope: SupportedResultEnvelope;
  outputPayload: NerveBusPayloadDocument | null;
};

type AbilityCommandEnvelope = Extract<SupportedEnvelope, { envelopeKind: "ability_command" }>;
type AiRequestEnvelope = Extract<SupportedEnvelope, { envelopeKind: "ai_request" }>;
type HumanCommandEnvelope = Extract<SupportedEnvelope, { envelopeKind: "human_command" }>;

type GateRule = (input: SemanticGateInput) => string | null;

const findFirstFailure = (input: SemanticGateInput, rules: GateRule[]): string | null => {
  for (const rule of rules) {
    const failure = rule(input);
    if (failure) {
      return failure;
    }
  }
  return null;
};

const SHARED_CORRELATION_RULES: GateRule[] = [
  (input) => input.resultEnvelope.missionId !== input.envelope.missionId ? "Result envelope missionId must match the request envelope." : null,
  (input) => input.resultEnvelope.mapId !== input.envelope.mapId ? "Result envelope mapId must match the request envelope." : null,
  (input) => input.resultEnvelope.stepId !== input.envelope.stepId ? "Result envelope stepId must match the request envelope." : null,
  (input) => input.resultEnvelope.traceId !== input.envelope.traceId ? "Result envelope traceId must match the request envelope." : null,
  (input) => input.resultEnvelope.inputRef !== input.envelope.inputRef ? "Result envelope inputRef must match the request envelope." : null,
];

const STATUS_SHAPE_RULES: GateRule[] = [
  (input) => input.resultEnvelope.status === "success" && !input.resultEnvelope.outputRef ? "Successful result envelopes must carry outputRef." : null,
  (input) => input.resultEnvelope.status === "failed" && !input.resultEnvelope.failureReason ? "Failed result envelopes must carry failureReason." : null,
  (input) => input.resultEnvelope.status === "review_required" && !input.resultEnvelope.reviewRequiredReason ? "Review-required result envelopes must carry reviewRequiredReason." : null,
  (input) => input.resultEnvelope.outputRef && !input.resultEnvelope.payloadRef.includes(input.resultEnvelope.outputRef) ? "Result envelope outputRef must remain traceable through payloadRef." : null,
  (input) => input.outputPayload && input.resultEnvelope.outputRef !== input.outputPayload.documentRef ? "Result envelope outputRef must match the produced output payload documentRef." : null,
  (input) => !input.outputPayload && input.resultEnvelope.status === "success" ? "Successful transport results must produce governed output payload." : null,
];

const validateSharedCorrelation = (input: SemanticGateInput): string | null => {
  return findFirstFailure(input, SHARED_CORRELATION_RULES);
};

const validateStatusShape = (input: SemanticGateInput): string | null => {
  return findFirstFailure(input, STATUS_SHAPE_RULES);
};

const hasReversedRoute = (input: SemanticGateInput): boolean =>
  input.resultEnvelope.from === input.envelope.to && input.resultEnvelope.to === input.envelope.from;

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

const validateEnvelopePairing = (input: SemanticGateInput): string | null => {
  if (input.envelope.envelopeKind === "ability_command") {
    return validateAbilityEnvelopePairing({ ...input, envelope: input.envelope });
  }

  if (input.envelope.envelopeKind === "ai_request") {
    return validateAiEnvelopePairing({ ...input, envelope: input.envelope });
  }

  return validateHumanEnvelopePairing({ ...input, envelope: input.envelope });
};

export function enforceTransportResultSemanticGate(input: SemanticGateInput): { ok: true } | { ok: false; reason: string } {
  const failureReason = validateEnvelopePairing(input)
    ?? validateSharedCorrelation(input)
    ?? validateStatusShape(input);

  return failureReason ? { ok: false, reason: failureReason } : { ok: true };
}