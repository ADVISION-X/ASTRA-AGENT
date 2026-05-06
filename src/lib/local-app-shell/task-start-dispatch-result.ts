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

const resolveCommandIdFromRunId = (runId: string | null | undefined): string | null => {
  if (!runId?.startsWith("commander_command_")) {
    return null;
  }
  return runId.endsWith(":run") ? runId.slice(0, -":run".length) : runId;
};

const hasCommanderReceiptRef = (result: StartCommandResult): boolean => {
  const proof = result.runtimeProof;
  const commandId = resolveCommandIdFromRunId(proof?.runId);
  const receiptPrefix = commandId ? `commander_receipt:${commandId}` : "commander_receipt:";
  return [proof?.outputRef, proof?.resultEnvelopeRef].some((ref) => typeof ref === "string" && ref.startsWith(receiptPrefix));
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

const recordAcceptedObserverTimeout = async (input: {
  activeWorkbench: GrassEyeWorkbenchHandle;
  approval: StartApproval;
  result: StartCommandResult;
  context: DispatchResultContext;
}) => {
  await input.activeWorkbench.recordCommanderDebugEvent({
    eventType: "COMMAND_RECEIPT_TIMEOUT_AFTER_ACCEPTED",
    status: "review_required",
    traceId: input.result.runtimeProof?.runId ?? input.approval.traceId,
    spanId: "command-receipt-timeout-after-accepted",
    attemptId: input.approval.attemptId,
    missionId: input.context.targetMissionId,
    mapId: input.approval.binding.selectedMapId,
    taskTemplateId: input.approval.binding.taskTemplateId,
    failureReason: input.context.failureReason,
    actionableMessage: "Command was already accepted; continue tracking mission runtime events instead of treating this observer timeout as command rejection.",
    ownerResponsible: "Commander Console / Nerve Bus / Orchestration",
    runId: input.result.runtimeProof?.runId ?? input.approval.traceId,
    refs: input.context.refs,
    proofRefs: input.context.proofRefs,
  });
};

const wasAcceptedBeforeResult = (result: StartCommandResult): boolean => {
  const proof = result.runtimeProof;
  return Boolean((proof?.commandEnvelopeRef && proof?.resultEnvelopeRef) || hasCommanderReceiptRef(result));
};

const recordAcceptedDispatch = async (input: {
  activeWorkbench: GrassEyeWorkbenchHandle;
  approval: StartApproval;
  result: StartCommandResult;
  context: DispatchResultContext;
}) => {
  const runId = input.result.runtimeProof?.runId ?? input.approval.traceId;
  await input.activeWorkbench.recordCommanderDebugEvent({
    eventType: "COMMAND_RESPONSE_SENT",
    status: "success",
    traceId: runId,
    spanId: "command-response-sent",
    attemptId: input.approval.attemptId,
    missionId: input.context.targetMissionId,
    mapId: input.approval.binding.selectedMapId,
    taskTemplateId: input.approval.binding.taskTemplateId,
    reason: input.context.resultMessage,
    actionableMessage: "Follow the returned mission refs and persisted runtime proof for downstream audit.",
    ownerResponsible: "Commander Console / Nerve Bus / Orchestration",
    runId,
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
  } else if (context.failureReason.includes("timed out")) {
    await recordAcceptedObserverTimeout({ activeWorkbench, approval, result, context });
  }
  writeTaskJsonResponse(response, 409, { ...result, traceId: approval.traceId, attemptId: approval.attemptId });
}
