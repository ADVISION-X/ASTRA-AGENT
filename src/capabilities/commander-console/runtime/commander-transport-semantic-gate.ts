import type { CommanderHumanCommand, HumanCommandTransportResult } from "../ports/command-transport-port.js";
import { CommandTransportResultSchema } from "../schema.js";
import { commanderFlag, type CommanderDataQualityFlag } from "../shared/commander-proof.js";

export type CommanderTransportSemanticResult = {
  status: "accepted" | "failed" | "review_required";
  runId: string;
  envelopeRef: string | null;
  resultEnvelopeRef: string | null;
  failureReason: string | null;
  reviewRequiredReason: string | null;
  message: string;
  dataQualityFlags: CommanderDataQualityFlag[];
};

const resolveCommandRunId = (command: CommanderHumanCommand) => `${command.commandId}:run`;

function buildSemanticFailure(command: CommanderHumanCommand, reason: string): CommanderTransportSemanticResult {
  return {
    status: "failed",
    runId: resolveCommandRunId(command),
    envelopeRef: null,
    resultEnvelopeRef: null,
    failureReason: reason,
    reviewRequiredReason: null,
    message: reason,
    dataQualityFlags: [commanderFlag("transport_semantic_guarded", "fatal", reason)],
  };
}

function buildSemanticReviewRequired(input: {
  runId: string;
  envelopeRef: string | null;
  message: string;
  reason: string;
}): CommanderTransportSemanticResult {
  return {
    status: "review_required",
    runId: input.runId,
    envelopeRef: input.envelopeRef,
    resultEnvelopeRef: null,
    failureReason: null,
    reviewRequiredReason: input.reason,
    message: input.message,
    dataQualityFlags: [commanderFlag("transport_semantic_guarded", "warn", input.reason)],
  };
}

const parseTransportResult = (command: CommanderHumanCommand, transport: HumanCommandTransportResult) => {
  const parsed = CommandTransportResultSchema.safeParse(transport);
  return parsed.success
    ? { ok: true as const, result: parsed.data }
    : { ok: false as const, failure: buildSemanticFailure(command, parsed.error.issues[0]?.message ?? "Commander transport result failed schema validation.") };
};

const getCommandIdFailureReason = (input: {
  command: CommanderHumanCommand;
  result: HumanCommandTransportResult;
}) => input.result.commandId !== input.command.commandId
  ? "transport result commandId does not match the dispatched commandId."
  : null;

const getRunIdFailureReason = (result: HumanCommandTransportResult) => !result.runId
  ? "transport result requires runId."
  : null;

const getAcceptedTransportFailureReason = (result: HumanCommandTransportResult) =>
  result.status === "accepted" && !result.envelopeRef
    ? "accepted transport result requires envelopeRef."
    : null;

const getFailedTransportFailureReason = (result: HumanCommandTransportResult) =>
  result.status === "failed" && !result.failureReason
    ? "failed transport result requires failureReason."
    : null;

const getReviewRequiredFailureReason = (result: HumanCommandTransportResult) =>
  result.status === "review_required" && !result.reviewRequiredReason
    ? "review_required transport result requires reviewRequiredReason."
    : null;

const getTransportSemanticFailureReason = (input: {
  command: CommanderHumanCommand;
  result: HumanCommandTransportResult;
}) => getCommandIdFailureReason(input)
  ?? getRunIdFailureReason(input.result)
  ?? getAcceptedTransportFailureReason(input.result)
  ?? getFailedTransportFailureReason(input.result)
  ?? getReviewRequiredFailureReason(input.result);

const getAcceptedTransportReview = (result: HumanCommandTransportResult) => {
  if (result.status !== "accepted" || result.resultEnvelopeRef) {
    return null;
  }
  return buildSemanticReviewRequired({
    runId: result.runId,
    envelopeRef: result.envelopeRef,
    message: result.message,
    reason: "accepted transport result requires resultEnvelopeRef for governed success handling.",
  });
};

const buildSemanticSuccess = (result: HumanCommandTransportResult): CommanderTransportSemanticResult => ({
  status: result.status,
  runId: result.runId,
  envelopeRef: result.envelopeRef,
  resultEnvelopeRef: result.resultEnvelopeRef,
  failureReason: result.failureReason,
  reviewRequiredReason: result.reviewRequiredReason,
  message: result.message,
  dataQualityFlags: [],
});

export function applyCommanderTransportSemanticGate(input: {
  command: CommanderHumanCommand;
  transport: HumanCommandTransportResult;
}): CommanderTransportSemanticResult {
  const parsed = parseTransportResult(input.command, input.transport);
  if (!parsed.ok) {
    return parsed.failure;
  }

  const failureReason = getTransportSemanticFailureReason({ command: input.command, result: parsed.result });
  if (failureReason) {
    return buildSemanticFailure(input.command, failureReason);
  }

  const acceptedReview = getAcceptedTransportReview(parsed.result);
  if (acceptedReview) {
    return acceptedReview;
  }

  return buildSemanticSuccess(parsed.result);
}
