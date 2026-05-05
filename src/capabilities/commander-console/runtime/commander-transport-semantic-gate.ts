import type { CommanderHumanCommand, HumanCommandTransportResult } from "../ports/command-transport-port.js";
import { CommandTransportResultSchema } from "../schema.js";
import { commanderFlag, type CommanderDataQualityFlag } from "../shared/commander-proof.js";

export type CommanderTransportSemanticResult = {
  status: "accepted" | "failed" | "review_required";
  runId: string | null;
  envelopeRef: string | null;
  resultEnvelopeRef: string | null;
  failureReason: string | null;
  reviewRequiredReason: string | null;
  message: string;
  dataQualityFlags: CommanderDataQualityFlag[];
};

function buildSemanticFailure(reason: string): CommanderTransportSemanticResult {
  return {
    status: "failed",
    runId: null,
    envelopeRef: null,
    resultEnvelopeRef: null,
    failureReason: reason,
    reviewRequiredReason: null,
    message: reason,
    dataQualityFlags: [commanderFlag("transport_semantic_guarded", "fatal", reason)],
  };
}

function buildSemanticReviewRequired(input: {
  envelopeRef: string | null;
  message: string;
  reason: string;
}): CommanderTransportSemanticResult {
  return {
    status: "review_required",
    runId: null,
    envelopeRef: input.envelopeRef,
    resultEnvelopeRef: null,
    failureReason: null,
    reviewRequiredReason: input.reason,
    message: input.message,
    dataQualityFlags: [commanderFlag("transport_semantic_guarded", "warn", input.reason)],
  };
}

const parseTransportResult = (transport: HumanCommandTransportResult) => {
  const parsed = CommandTransportResultSchema.safeParse(transport);
  return parsed.success
    ? { ok: true as const, result: parsed.data }
    : { ok: false as const, failure: buildSemanticFailure(parsed.error.issues[0]?.message ?? "Commander transport result failed schema validation.") };
};

const getTransportSemanticFailureReason = (input: {
  command: CommanderHumanCommand;
  result: HumanCommandTransportResult;
}) => {
  if (input.result.commandId !== input.command.commandId) {
    return "transport result commandId does not match the dispatched commandId.";
  }
  if (!input.result.runId) {
    return "transport result requires runId.";
  }
  if (input.result.status === "accepted" && !input.result.envelopeRef) {
    return "accepted transport result requires envelopeRef.";
  }
  if (input.result.status === "failed" && !input.result.failureReason) {
    return "failed transport result requires failureReason.";
  }
  if (input.result.status === "review_required" && !input.result.reviewRequiredReason) {
    return "review_required transport result requires reviewRequiredReason.";
  }
  return null;
};

const getAcceptedTransportReview = (result: HumanCommandTransportResult) => {
  if (result.status !== "accepted" || result.resultEnvelopeRef) {
    return null;
  }
  return buildSemanticReviewRequired({
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
  const parsed = parseTransportResult(input.transport);
  if (!parsed.ok) {
    return parsed.failure;
  }

  const failureReason = getTransportSemanticFailureReason({ command: input.command, result: parsed.result });
  if (failureReason) {
    return buildSemanticFailure(failureReason);
  }

  const acceptedReview = getAcceptedTransportReview(parsed.result);
  if (acceptedReview) {
    return acceptedReview;
  }

  return buildSemanticSuccess(parsed.result);
}
