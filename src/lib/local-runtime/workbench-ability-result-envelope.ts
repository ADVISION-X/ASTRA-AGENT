import type {
  AbilityCommandEnvelope,
  AbilityResultEnvelope,
} from "../../capabilities/nerve-bus/shared/nerve-bus-envelope.js";
import type { WorkbenchNerveBusHandledResult as NerveBusHandledResult } from "./workbench-nerve-bus-types.js";
import type { WorkbenchAbilityExecutionResult } from "./workbench-contract.js";
import { buildAbilityResultProofSummary } from "./workbench-ability-result-proof-summary.js";
import { recordAbilityResultContractSnapshot } from "../../capabilities/orchestration/index.js";
import { buildMirroredEnvelopeBase, buildPayloadDocument } from "./workbench-payload.js";
import { recordScreenshotSourceHandoff } from "./workbench-screenshot-source-handoff.js";

const MAX_FAILURE_DETAIL_LENGTH = 240;

const describeAbilityFailure = (
  failure: WorkbenchAbilityExecutionResult["failureReason"],
): string | null => {
  if (!failure) {
    return null;
  }
  return typeof failure === "string" ? failure : failure.message ?? failure.code ?? "Ability dispatch failed.";
};

const clampFailureDetail = (detail: string): string =>
  detail.length <= MAX_FAILURE_DETAIL_LENGTH
    ? detail
    : `${detail.slice(0, MAX_FAILURE_DETAIL_LENGTH - 3).trimEnd()}...`;

const readResultStatusMessage = (result: WorkbenchAbilityExecutionResult): string | null => {
  const candidate = (result as { statusMessage?: unknown }).statusMessage;
  return typeof candidate === "string" && candidate.length > 0 ? clampFailureDetail(candidate) : null;
};

const resolveAbilityFailureDetail = (input: {
  result: WorkbenchAbilityExecutionResult;
  failureReason: string | null;
}): string | null => {
  const statusMessage = readResultStatusMessage(input.result);
  if (statusMessage && input.failureReason && !statusMessage.includes(input.failureReason)) {
    return clampFailureDetail(`${input.failureReason}: ${statusMessage}`);
  }
  return statusMessage ?? input.failureReason;
};

const buildAbilityResultSummary = (input: {
  envelope: AbilityCommandEnvelope;
  result: WorkbenchAbilityExecutionResult;
  failureDetail: string | null;
}): string => input.result.status === "success"
  ? `${input.envelope.to} executed ${input.envelope.commandName}.`
  : input.failureDetail ?? input.result.reviewRequiredReason ?? `${input.envelope.to} failed ${input.envelope.commandName}.`;

const buildAbilityResultPayload = (input: {
  envelope: AbilityCommandEnvelope;
  result: WorkbenchAbilityExecutionResult;
  summary: string;
  failureReason: string | null;
  failureDetail: string | null;
}) => buildPayloadDocument({
  documentType: "ability.result",
  documentRef: `${input.envelope.commandId}:result:payload`,
  summary: input.summary,
  content: {
    abilityGroupId: input.result.abilityGroupId,
    childCapabilityId: input.result.childCapabilityId ?? input.envelope.commandName,
    status: input.result.status,
    failureReason: input.failureReason,
    failureDetail: input.failureDetail,
    reviewRequiredReason: input.result.reviewRequiredReason ?? null,
    statusMessage: readResultStatusMessage(input.result),
    ...buildAbilityResultProofSummary({
      outputRef: `${input.envelope.commandId}:result:payload`,
      result: input.result,
    }),
  },
});

const buildAbilityResultEnvelope = (input: {
  envelope: AbilityCommandEnvelope;
  result: WorkbenchAbilityExecutionResult;
  outputPayload: ReturnType<typeof buildPayloadDocument>;
  summary: string;
  failureReason: string | null;
  failureDetail: string | null;
}): AbilityResultEnvelope => ({
  ...buildMirroredEnvelopeBase({
    channelId: "ability-to-orchestration",
    envelopeId: `${input.envelope.envelopeId}:result`,
    requestEnvelope: input.envelope,
    payloadRefs: { output: input.outputPayload.documentRef },
    summary: input.summary,
    tags: [input.envelope.to, input.envelope.commandName, input.result.status],
  }),
  envelopeKind: "ability_result",
  resultId: `${input.envelope.commandId}:result`,
  from: input.envelope.to,
  to: "orchestration",
  correlationEnvelopeId: input.envelope.envelopeId,
  correlationCapabilityCallId: input.envelope.capabilityCallId,
  correlationInputRef: input.envelope.inputRef,
  proofRef: `${input.envelope.envelopeId}:result:proof`,
  targetAbilityGroupId: input.envelope.targetAbilityGroupId,
  targetChildCapabilityId: input.envelope.targetChildCapabilityId,
  status: input.result.status,
  outputRef: input.result.status === "success" ? input.outputPayload.documentRef : null,
  diagnosticPayloadRef: input.result.status === "success" ? null : input.outputPayload.documentRef,
  failureReason: input.result.status === "failed" ? input.failureDetail ?? "Ability dispatch failed." : null,
  reviewRequiredReason: input.result.status === "review_required"
    ? input.result.reviewRequiredReason ?? input.failureDetail ?? "Ability dispatch requires review."
    : null,
});

export const buildAbilityCommandResultEnvelope = (input: {
  envelope: AbilityCommandEnvelope;
  result: WorkbenchAbilityExecutionResult;
}): NerveBusHandledResult<AbilityResultEnvelope> => {
  const failureReason = describeAbilityFailure(input.result.failureReason);
  const failureDetail = resolveAbilityFailureDetail({ result: input.result, failureReason });
  const summary = buildAbilityResultSummary({ envelope: input.envelope, result: input.result, failureDetail });
  const outputPayload = buildAbilityResultPayload({ envelope: input.envelope, result: input.result, summary, failureReason, failureDetail });
  recordAbilityResultContractSnapshot(outputPayload.documentRef, {
    abilityGroupId: input.result.abilityGroupId,
    childCapabilityId: input.result.childCapabilityId ?? input.envelope.commandName,
    status: input.result.status,
    output: input.result.output ?? null,
    runtimeProof: input.result.runtimeProof ?? null,
    failureReason: input.result.failureReason ?? null,
    reviewRequiredReason: input.result.reviewRequiredReason ?? null,
  });
  recordScreenshotSourceHandoff({ outputRef: outputPayload.documentRef, result: input.result });

  return {
    envelope: buildAbilityResultEnvelope({ envelope: input.envelope, result: input.result, outputPayload, summary, failureReason, failureDetail }),
    outputPayload,
  };
};
