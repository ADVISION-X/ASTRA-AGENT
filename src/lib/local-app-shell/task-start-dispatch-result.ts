import type { ServerResponse } from "node:http";

import type { GrassEyeWorkbenchHandle } from "../local-runtime/workbench-handle.js";
import { writeTaskJsonResponse } from "./task-http-helpers.js";
import type { StartApproval, StartCommandResult } from "./task-start-types.js";

type DispatchResultContext = {
  resultMessage: string;
  targetMissionId: string | null;
  failureReason: string;
  refs: string[];
  proofRefs: string[];
};

const resolveResultMessage = (output: unknown): string => {
  return output !== null && typeof output === "object" && "message" in output && typeof output.message === "string"
    ? output.message
    : "Commander Console completed the governed human command dispatch.";
};

const resolveTargetMissionId = (output: unknown): string | null => {
  return output !== null && typeof output === "object" && "targetMissionId" in output && typeof output.targetMissionId === "string"
    ? output.targetMissionId
    : null;
};

export const collectDispatchResultRefs = (result: StartCommandResult): string[] => {
  const proof = result.runtimeProof;
  return [
    proof?.runId ? `runId=${proof.runId}` : null,
    proof?.commandEnvelopeRef ? `commandEnvelopeRef=${proof.commandEnvelopeRef}` : null,
    proof?.resultEnvelopeRef ? `resultEnvelopeRef=${proof.resultEnvelopeRef}` : null,
    proof?.proofId ? `runtimeProofRef=${proof.proofId}` : null,
    proof?.inputRef ? `inputRef=${proof.inputRef}` : null,
    proof?.outputRef ? `outputRef=${proof.outputRef}` : null,
  ].filter((value): value is string => Boolean(value));
};

const collectDispatchProofRefs = (result: StartCommandResult): string[] => {
  const proofId = result.runtimeProof?.proofId;
  return proofId ? [proofId] : [];
};

const buildDispatchResultContext = (result: StartCommandResult): DispatchResultContext => {
  const resultMessage = resolveResultMessage(result.output);
  return {
    resultMessage,
    targetMissionId: resolveTargetMissionId(result.output),
    failureReason: result.failureReason ?? result.reviewRequiredReason ?? resultMessage,
    refs: collectDispatchResultRefs(result),
    proofRefs: collectDispatchProofRefs(result),
  };
};

const recordRejectedDispatch = async (input: {
  activeWorkbench: GrassEyeWorkbenchHandle;
  approval: StartApproval;
  result: StartCommandResult;
  context: DispatchResultContext;
}) => {
  await input.activeWorkbench.recordCommanderDebugEvent({
    eventType: "COMMAND_REJECTED",
    status: input.result.status === "review_required" ? "review_required" : "failed",
    traceId: input.approval.traceId,
    spanId: "command-rejected",
    attemptId: input.approval.attemptId,
    missionId: input.context.targetMissionId,
    mapId: input.approval.binding.selectedMapId,
    taskTemplateId: input.approval.binding.taskTemplateId,
    failureReason: input.context.failureReason,
    actionableMessage: input.result.reviewRequiredReason
      ? "Open the review queue and inspect the guarded command result before retrying."
      : "Inspect the latest debug bundle and fix the blocking dependency before retrying.",
    ownerResponsible: "Commander Console / Nerve Bus / Orchestration",
    runId: input.result.runtimeProof?.runId ?? input.approval.traceId,
    refs: input.context.refs,
    proofRefs: input.context.proofRefs,
  });
};

const wasAcceptedBeforeResult = (result: StartCommandResult): boolean => {
  const proof = result.runtimeProof;
  return Boolean(proof?.commandEnvelopeRef && proof?.resultEnvelopeRef);
};

const recordAcceptedDispatch = async (input: {
  activeWorkbench: GrassEyeWorkbenchHandle;
  approval: StartApproval;
  result: StartCommandResult;
  context: DispatchResultContext;
}) => {
  await input.activeWorkbench.recordCommanderDebugEvent({
    eventType: "COMMAND_ACCEPTED",
    status: "success",
    traceId: input.approval.traceId,
    spanId: "command-accepted",
    attemptId: input.approval.attemptId,
    missionId: input.context.targetMissionId,
    mapId: input.approval.binding.selectedMapId,
    taskTemplateId: input.approval.binding.taskTemplateId,
    reason: input.context.resultMessage,
    actionableMessage: "Follow the returned mission refs and persisted runtime proof for downstream audit.",
    ownerResponsible: "Commander Console / Nerve Bus / Orchestration",
    runId: input.result.runtimeProof?.runId ?? input.approval.traceId,
    refs: input.context.refs,
    proofRefs: input.context.proofRefs,
  });
};

export async function writeTaskStartDispatchResult(
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  approval: StartApproval,
  result: StartCommandResult,
) {
  const context = buildDispatchResultContext(result);
  if (result.status === "success") {
    await recordAcceptedDispatch({ activeWorkbench, approval, result, context });
    writeTaskJsonResponse(response, 200, result);
    return;
  }

  if (!wasAcceptedBeforeResult(result)) {
    await recordRejectedDispatch({ activeWorkbench, approval, result, context });
  }
  writeTaskJsonResponse(response, 409, { ...result, traceId: approval.traceId, attemptId: approval.attemptId });
}
