import type {
  AbilityCommandEnvelope,
  AbilityResultEnvelope,
} from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import type { NerveBusHandledResult } from "../../capabilities/nerve-bus/ports/nerve-bus-handler-port.js";
import type { WorkbenchAbilityExecutionResult } from "./workbench-contract.js";
import { buildPayloadDocument, buildTransportEnvelopeBase } from "./workbench-payload.js";

const describeAbilityFailure = (
  failure: WorkbenchAbilityExecutionResult["failureReason"],
): string | null => {
  if (!failure) {
    return null;
  }
  return typeof failure === "string" ? failure : failure.message ?? failure.code ?? "Ability dispatch failed.";
};

const buildAbilityResultSummary = (input: {
  envelope: AbilityCommandEnvelope;
  result: WorkbenchAbilityExecutionResult;
  failureReason: string | null;
}): string => input.result.status === "success"
  ? `${input.envelope.to} executed ${input.envelope.commandName}.`
  : input.failureReason ?? input.result.reviewRequiredReason ?? `${input.envelope.to} failed ${input.envelope.commandName}.`;

const buildAbilityResultPayload = (input: {
  envelope: AbilityCommandEnvelope;
  result: WorkbenchAbilityExecutionResult;
  summary: string;
  failureReason: string | null;
}) => buildPayloadDocument({
  documentType: "ability.result",
  documentRef: `${input.envelope.commandId}:result:payload`,
  summary: input.summary,
  content: {
    abilityGroupId: input.result.abilityGroupId,
    childCapabilityId: input.result.childCapabilityId ?? input.envelope.commandName,
    status: input.result.status,
    failureReason: input.failureReason,
    reviewRequiredReason: input.result.reviewRequiredReason ?? null,
  },
});

const buildAbilityResultEnvelope = (input: {
  envelope: AbilityCommandEnvelope;
  result: WorkbenchAbilityExecutionResult;
  outputPayload: ReturnType<typeof buildPayloadDocument>;
  summary: string;
  failureReason: string | null;
}): AbilityResultEnvelope => ({
  ...buildTransportEnvelopeBase({
    channelId: "ability-to-orchestration",
    envelopeId: `${input.envelope.envelopeId}:result`,
    missionId: input.envelope.missionId,
    mapId: input.envelope.mapId,
    stepId: input.envelope.stepId,
    inputRef: input.envelope.inputRef,
    payloadRefs: { output: input.outputPayload.documentRef },
    summary: input.summary,
    tags: [input.envelope.to, input.envelope.commandName, input.result.status],
  }),
  envelopeKind: "ability_result",
  resultId: `${input.envelope.commandId}:result`,
  from: input.envelope.to,
  to: "orchestration",
  status: input.result.status,
  outputRef: input.result.status === "success" ? input.outputPayload.documentRef : null,
  diagnosticPayloadRef: input.result.status === "success" ? null : input.outputPayload.documentRef,
  failureReason: input.result.status === "failed" ? input.failureReason ?? "Ability dispatch failed." : null,
  reviewRequiredReason: input.result.status === "review_required"
    ? input.result.reviewRequiredReason ?? input.failureReason ?? "Ability dispatch requires review."
    : null,
});

export const buildAbilityCommandResultEnvelope = (input: {
  envelope: AbilityCommandEnvelope;
  result: WorkbenchAbilityExecutionResult;
}): NerveBusHandledResult<AbilityResultEnvelope> => {
  const failureReason = describeAbilityFailure(input.result.failureReason);
  const summary = buildAbilityResultSummary({ envelope: input.envelope, result: input.result, failureReason });
  const outputPayload = buildAbilityResultPayload({ envelope: input.envelope, result: input.result, summary, failureReason });

  return {
    envelope: buildAbilityResultEnvelope({ envelope: input.envelope, result: input.result, outputPayload, summary, failureReason }),
    outputPayload,
  };
};