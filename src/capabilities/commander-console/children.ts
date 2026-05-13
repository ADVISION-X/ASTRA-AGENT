/**
 * Commander Console Children — All 7 atomic children in one file.
 *
 * Active children:
 *   issue-human-command  — start-mission only
 *   pause-mission        — pause the running mission
 *   resume-mission       — resume the paused mission
 *   stop-mission         — graceful stop
 *   emergency-stop       — immediate hard stop
 *   mark-review-required — mark current mission as review_required
 *   show-mission-status  — minimal mission status read (not a dashboard universe)
 *
 * Governance:
 *   - No candidate dispose/approve/reject.
 *   - No read-model universe (evidence/audit/browse ledger/roster/health).
 *   - No AI/browser/action/Forensics writer imports.
 *   - Transport is the sole boundary to Nerve Bus.
 */

import { randomUUID } from "node:crypto";
import type { CommandTransportPort } from "./envelope.js";
import {
  IssueHumanCommandInputSchema,
  MissionControlInputSchema,
  MarkReviewRequiredInputSchema,
  ShowMissionStatusInputSchema,
  CommanderMissionStatusViewSchema,
  type CommanderChildCapabilityId,
  type CommanderConsoleResult,
} from "./schema.js";
import {
  buildCommanderProof,
  buildCommanderSuccessResult,
  buildCommanderFailureResult,
} from "./result.js";
import {
  checkAndReserveCommanderIdempotency,
  releaseCommanderIdempotency,
} from "./idempotency.js";

// ─── Payload builder: maps Commander input to Orchestration MissionCommandSchema ─

function buildStartMissionOrchestrationPayload(opts: {
  userRequirementText: string;
  selectedPlatforms: string[];
  requestedPlatformId: string | null;
  maxRounds: number | null;
  maxMinutes: number | null;
  operatorNote: string | null;
  initialPayload: Record<string, unknown> | null;
}): Record<string, unknown> {
  // Build a clean initialPayload containing only the fields accepted by
  // MissionCommandSchema.initialPayload.strict() inside Orchestration.
  const rawIp = opts.initialPayload;
  const cleanedInitialPayload: Record<string, unknown> = {
    requestedBy: (rawIp?.["requestedBy"] as string | undefined) ?? "commander-console",
  };
  if (rawIp?.["userRequirementRef"] != null) cleanedInitialPayload["userRequirementRef"] = rawIp["userRequirementRef"];
  if (rawIp?.["primaryPlatformId"] != null) cleanedInitialPayload["primaryPlatformId"] = rawIp["primaryPlatformId"];
  if (Array.isArray(rawIp?.["selectedPlatforms"])) cleanedInitialPayload["selectedPlatforms"] = rawIp!["selectedPlatforms"];
  cleanedInitialPayload["operatorNote"] = rawIp?.["operatorNote"] ?? opts.operatorNote ?? null;
  if (rawIp?.["targetUrl"] != null) cleanedInitialPayload["targetUrl"] = rawIp["targetUrl"];
  if (rawIp?.["targetTitle"] != null) cleanedInitialPayload["targetTitle"] = rawIp["targetTitle"];
  if (rawIp?.["targetProfileRef"] != null) cleanedInitialPayload["targetProfileRef"] = rawIp["targetProfileRef"];
  if (rawIp?.["sourceEvidenceRef"] != null) cleanedInitialPayload["sourceEvidenceRef"] = rawIp["sourceEvidenceRef"];
  if (rawIp?.["sourceTargetRef"] != null) cleanedInitialPayload["sourceTargetRef"] = rawIp["sourceTargetRef"];
  if (rawIp?.["promptInputRef"] != null) cleanedInitialPayload["promptInputRef"] = rawIp["promptInputRef"];
  if (rawIp?.["commandInputRef"] != null) cleanedInitialPayload["commandInputRef"] = rawIp["commandInputRef"];

  return {
    // Top-level fields required by MissionCommandSchema (missionId + runId injected by dispatcher)
    humanGoal: opts.userRequirementText,
    requestedPlatform: opts.requestedPlatformId ?? opts.selectedPlatforms[0] ?? "",
    selectedPlatforms: opts.selectedPlatforms,
    ...(opts.maxRounds != null ? { maxRounds: opts.maxRounds } : {}),
    ...(opts.maxMinutes != null ? { maxMinutes: opts.maxMinutes } : {}),
    initialPayload: cleanedInitialPayload,
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────

export type CommanderChildContext = {
  commandTransport: CommandTransportPort;
  getMissionStatus: () => CommanderMissionStatusSnapshot;
};

type CommanderMissionStatusSnapshot = {
  missionId: string | null;
  status: "idle" | "running" | "paused" | "stopped" | "review_required" | "completed" | "unknown";
  currentPlatform: string | null;
  userRequirementSummary: string | null;
  startedAt: string | null;
  updatedAt: string;
  lastStopReason: string | null;
  reviewRequiredReason: string | null;
  matchedEvidenceCount: number;
  lastActionFailureCount: number;
};

// ─── Helper: build and send envelope ─────────────────────────────────────────

const sendCommandEnvelope = async (
  options: {
    childCapabilityId: CommanderChildCapabilityId;
    commandId: string;
    commandType: string;
    operatorRef: string;
    missionId: string | null;
    userRequirementText: string | null;
    selectedPlatforms: string[];
    requestedPlatformId: string | null;
    maxRounds: number | null;
    maxMinutes: number | null;
    payload: Record<string, unknown>;
    idempotencyKey: string;
    timeoutMs: number;
  },
  transport: CommandTransportPort,
): Promise<CommanderConsoleResult> => {
  const startedAt = new Date().toISOString();
  const envelopeId = randomUUID();
  const createdAt = startedAt;

  const envelope = {
    envelopeId,
    commandId: options.commandId,
    commandType: options.commandType,
    operatorRef: options.operatorRef,
    missionId: options.missionId,
    userRequirementText: options.userRequirementText,
    selectedPlatforms: options.selectedPlatforms,
    requestedPlatformId: options.requestedPlatformId,
    maxRounds: options.maxRounds ?? null,
    maxMinutes: options.maxMinutes ?? null,
    payload: options.payload,
    idempotencyKey: options.idempotencyKey,
    timeoutMs: options.timeoutMs,
    createdAt,
  };

  let transportResult: Awaited<ReturnType<CommandTransportPort["sendHumanCommandEnvelope"]>>;
  try {
    transportResult = await transport.sendHumanCommandEnvelope(envelope);
  } catch (err) {
    const endedAt = new Date().toISOString();
    const reason = err instanceof Error ? err.message : "Transport threw unknown error";
    const proof = buildCommanderProof({
      childCapabilityId: options.childCapabilityId,
      commandId: options.commandId,
      commandType: options.commandType,
      operatorRef: options.operatorRef,
      missionId: options.missionId,
      status: "failed",
      failureReason: reason,
      reviewRequiredReason: null,
      envelopeId: null,
      startedAt,
      endedAt,
    });
    return buildCommanderFailureResult(reason, proof);
  }

  const endedAt = new Date().toISOString();
  if (!transportResult.ok) {
    const reason = transportResult.failureReason ?? "Transport returned not-ok";
    const proof = buildCommanderProof({
      childCapabilityId: options.childCapabilityId,
      commandId: options.commandId,
      commandType: options.commandType,
      operatorRef: options.operatorRef,
      missionId: options.missionId,
      status: "failed",
      failureReason: reason,
      reviewRequiredReason: null,
      envelopeId: envelopeId,
      startedAt,
      endedAt,
    });
    return buildCommanderFailureResult(reason, proof);
  }

  const proof = buildCommanderProof({
    childCapabilityId: options.childCapabilityId,
    commandId: options.commandId,
    commandType: options.commandType,
    operatorRef: options.operatorRef,
    missionId: options.missionId,
    status: "success",
    failureReason: null,
    reviewRequiredReason: null,
    envelopeId: envelopeId,
    startedAt,
    endedAt,
  });

  return buildCommanderSuccessResult({ envelopeId, transportRef: transportResult.transportRef }, proof);
};

// ─── issue-human-command ──────────────────────────────────────────────────────

export const executeIssueHumanCommand = async (
  rawInput: Record<string, unknown>,
  operatorRef: string,
  context: CommanderChildContext,
): Promise<CommanderConsoleResult> => {
  const parsed = IssueHumanCommandInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const startedAt = new Date().toISOString();
    const proof = buildCommanderProof({
      childCapabilityId: "issue-human-command",
      commandId: randomUUID(),
      commandType: "start-mission",
      operatorRef,
      missionId: null,
      status: "failed",
      failureReason: `input_schema_invalid: ${parsed.error.message}`,
      reviewRequiredReason: null,
      envelopeId: null,
      startedAt,
      endedAt: startedAt,
    });
    return buildCommanderFailureResult(`input_schema_invalid: ${parsed.error.message}`, proof);
  }

  const { userRequirementText, selectedPlatforms, requestedPlatformId, maxRounds, maxMinutes, operatorNote, initialPayload } = parsed.data;
  const commandId = randomUUID();
  const idempotencyKey = `issue-human-command:${userRequirementText.slice(0, 40)}:${commandId}`;

  if (!checkAndReserveCommanderIdempotency(idempotencyKey)) {
    const startedAt = new Date().toISOString();
    const proof = buildCommanderProof({
      childCapabilityId: "issue-human-command",
      commandId,
      commandType: "start-mission",
      operatorRef,
      missionId: null,
      status: "failed",
      failureReason: "idempotency_replay",
      reviewRequiredReason: null,
      envelopeId: null,
      startedAt,
      endedAt: startedAt,
    });
    return buildCommanderFailureResult("idempotency_replay", proof);
  }

  const result = await sendCommandEnvelope({
    childCapabilityId: "issue-human-command",
    commandId,
    commandType: "start-mission",
    operatorRef,
    missionId: null,
    userRequirementText,
    selectedPlatforms,
    requestedPlatformId: requestedPlatformId ?? null,
    maxRounds: maxRounds ?? null,
    maxMinutes: maxMinutes ?? null,
    payload: buildStartMissionOrchestrationPayload({
      userRequirementText,
      selectedPlatforms,
      requestedPlatformId: requestedPlatformId ?? null,
      maxRounds: maxRounds ?? null,
      maxMinutes: maxMinutes ?? null,
      operatorNote: operatorNote ?? null,
      initialPayload: initialPayload ?? null,
    }),
    idempotencyKey,
    timeoutMs: 30_000,
  }, context.commandTransport);

  if (result.status !== "success") {
    releaseCommanderIdempotency(idempotencyKey);
  }

  return result;
};

// ─── Mission control commands ──────────────────────────────────────────────────

const executeMissionControl = async (
  childCapabilityId: Exclude<CommanderChildCapabilityId, "issue-human-command" | "mark-review-required" | "show-mission-status">,
  commandType: string,
  rawInput: Record<string, unknown>,
  operatorRef: string,
  context: CommanderChildContext,
): Promise<CommanderConsoleResult> => {
  const parsed = MissionControlInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const startedAt = new Date().toISOString();
    const proof = buildCommanderProof({
      childCapabilityId,
      commandId: randomUUID(),
      commandType,
      operatorRef,
      missionId: null,
      status: "failed",
      failureReason: `input_schema_invalid: ${parsed.error.message}`,
      reviewRequiredReason: null,
      envelopeId: null,
      startedAt,
      endedAt: startedAt,
    });
    return buildCommanderFailureResult(`input_schema_invalid: ${parsed.error.message}`, proof);
  }

  const commandId = randomUUID();
  return sendCommandEnvelope({
    childCapabilityId,
    commandId,
    commandType,
    operatorRef,
    missionId: parsed.data.targetMissionId ?? null,
    userRequirementText: null,
    selectedPlatforms: [],
    requestedPlatformId: null,
    maxRounds: null,
    maxMinutes: null,
    payload: { reason: parsed.data.reason ?? null },
    idempotencyKey: `${commandType}:${commandId}`,
    timeoutMs: 15_000,
  }, context.commandTransport);
};

export const executePauseMission = (
  rawInput: Record<string, unknown>,
  operatorRef: string,
  context: CommanderChildContext,
) => executeMissionControl("pause-mission", "pause-mission", rawInput, operatorRef, context);

export const executeResumeMission = (
  rawInput: Record<string, unknown>,
  operatorRef: string,
  context: CommanderChildContext,
) => executeMissionControl("resume-mission", "resume-mission", rawInput, operatorRef, context);

export const executeStopMission = (
  rawInput: Record<string, unknown>,
  operatorRef: string,
  context: CommanderChildContext,
) => executeMissionControl("stop-mission", "stop-mission", rawInput, operatorRef, context);

export const executeEmergencyStop = (
  rawInput: Record<string, unknown>,
  operatorRef: string,
  context: CommanderChildContext,
) => executeMissionControl("emergency-stop", "emergency-stop", rawInput, operatorRef, context);

// ─── mark-review-required ─────────────────────────────────────────────────────

export const executeMarkReviewRequired = async (
  rawInput: Record<string, unknown>,
  operatorRef: string,
  context: CommanderChildContext,
): Promise<CommanderConsoleResult> => {
  const parsed = MarkReviewRequiredInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const startedAt = new Date().toISOString();
    const proof = buildCommanderProof({
      childCapabilityId: "mark-review-required",
      commandId: randomUUID(),
      commandType: "mark-review-required",
      operatorRef,
      missionId: null,
      status: "failed",
      failureReason: `input_schema_invalid: ${parsed.error.message}`,
      reviewRequiredReason: null,
      envelopeId: null,
      startedAt,
      endedAt: startedAt,
    });
    return buildCommanderFailureResult(`input_schema_invalid: ${parsed.error.message}`, proof);
  }

  const commandId = randomUUID();
  return sendCommandEnvelope({
    childCapabilityId: "mark-review-required",
    commandId,
    commandType: "mark-review-required",
    operatorRef,
    missionId: parsed.data.targetMissionId ?? null,
    userRequirementText: null,
    selectedPlatforms: [],
    requestedPlatformId: null,
    maxRounds: null,
    maxMinutes: null,
    payload: { reviewRequiredReason: parsed.data.reviewRequiredReason },
    idempotencyKey: `mark-review-required:${commandId}`,
    timeoutMs: 10_000,
  }, context.commandTransport);
};

// ─── show-mission-status ──────────────────────────────────────────────────────

export const executeShowMissionStatus = async (
  rawInput: Record<string, unknown>,
  operatorRef: string,
  context: CommanderChildContext,
): Promise<CommanderConsoleResult> => {
  const parsed = ShowMissionStatusInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const startedAt = new Date().toISOString();
    const proof = buildCommanderProof({
      childCapabilityId: "show-mission-status",
      commandId: randomUUID(),
      commandType: "show-mission-status",
      operatorRef,
      missionId: null,
      status: "failed",
      failureReason: `input_schema_invalid: ${parsed.error.message}`,
      reviewRequiredReason: null,
      envelopeId: null,
      startedAt,
      endedAt: startedAt,
    });
    return buildCommanderFailureResult(`input_schema_invalid: ${parsed.error.message}`, proof);
  }

  const startedAt = new Date().toISOString();
  const snapshot = context.getMissionStatus();

  let statusView: ReturnType<typeof CommanderMissionStatusViewSchema.parse>;
  try {
    statusView = CommanderMissionStatusViewSchema.parse(snapshot);
  } catch (err) {
    const endedAt = new Date().toISOString();
    const reason = err instanceof Error ? err.message : "Failed to read mission status";
    const proof = buildCommanderProof({
      childCapabilityId: "show-mission-status",
      commandId: randomUUID(),
      commandType: "show-mission-status",
      operatorRef,
      missionId: snapshot.missionId,
      status: "failed",
      failureReason: reason,
      reviewRequiredReason: null,
      envelopeId: null,
      startedAt,
      endedAt,
    });
    return buildCommanderFailureResult(reason, proof);
  }

  const endedAt = new Date().toISOString();
  const proof = buildCommanderProof({
    childCapabilityId: "show-mission-status",
    commandId: randomUUID(),
    commandType: "show-mission-status",
    operatorRef,
    missionId: snapshot.missionId,
    status: "success",
    failureReason: null,
    reviewRequiredReason: null,
    envelopeId: null,
    startedAt,
    endedAt,
  });

  return buildCommanderSuccessResult(statusView, proof);
};
