/**
 * Commander Console Schemas
 *
 * Governance:
 *   - Commander Console is the cockpit for humans, not the engine.
 *   - Commander receives initial human intent and emits governed HumanCommandEnvelope.
 *   - Commander does NOT own read-model universes, candidate disposition, or evidence/audit ledgers.
 *   - Active children: issue-human-command, pause/resume/stop/emergency-stop, mark-review-required, show-mission-status.
 */

import { z } from "zod";

// ─── Constants ────────────────────────────────────────────────────────────────

export const COMMANDER_CONSOLE_ABILITY_GROUP_ID = "commander-console" as const;

export const COMMANDER_CHILD_CAPABILITY_IDS = [
  "issue-human-command",
  "pause-mission",
  "resume-mission",
  "stop-mission",
  "emergency-stop",
  "mark-review-required",
  "show-mission-status",
] as const;

export type CommanderChildCapabilityId = (typeof COMMANDER_CHILD_CAPABILITY_IDS)[number];

// ─── Child capability ID schema ───────────────────────────────────────────────

export const CommanderChildCapabilityIdSchema = z.enum([
  "issue-human-command",
  "pause-mission",
  "resume-mission",
  "stop-mission",
  "emergency-stop",
  "mark-review-required",
  "show-mission-status",
]);

// ─── Status ───────────────────────────────────────────────────────────────────

export const CommanderStatusSchema = z.enum(["success", "failed", "review_required"]);
export type CommanderStatus = z.output<typeof CommanderStatusSchema>;

export const CommanderMissionStatusSchema = z.enum([
  "idle",
  "running",
  "paused",
  "stopped",
  "review_required",
  "completed",
  "unknown",
]);
export type CommanderMissionStatus = z.output<typeof CommanderMissionStatusSchema>;

// ─── Child input schemas (strict) ─────────────────────────────────────────────

/** issue-human-command: start-mission only */
export const IssueHumanCommandInputSchema = z.object({
  userRequirementText: z.string().min(1),
  selectedPlatforms: z.array(z.string().min(1)).min(1),
  requestedPlatformId: z.string().min(1).optional(),
  maxRounds: z.number().int().min(1).optional(),
  maxMinutes: z.number().int().min(1).optional(),
  operatorNote: z.string().optional(),
  initialPayload: z.record(z.unknown()).optional(),
}).strict();

export type IssueHumanCommandRawInput = z.input<typeof IssueHumanCommandInputSchema>;
export type IssueHumanCommandInput = z.output<typeof IssueHumanCommandInputSchema>;

/** Mission control: pause/resume/stop/emergency-stop */
export const MissionControlInputSchema = z.object({
  targetMissionId: z.string().optional(),
  reason: z.string().optional(),
}).strict();

export type MissionControlInput = z.output<typeof MissionControlInputSchema>;

/** mark-review-required */
export const MarkReviewRequiredInputSchema = z.object({
  targetMissionId: z.string().optional(),
  reviewRequiredReason: z.string().min(1),
}).strict();

export type MarkReviewRequiredInput = z.output<typeof MarkReviewRequiredInputSchema>;

/** show-mission-status: minimal read */
export const ShowMissionStatusInputSchema = z.object({}).strict();
export type ShowMissionStatusInput = z.output<typeof ShowMissionStatusInputSchema>;

// ─── Global Commander Console input ──────────────────────────────────────────

export const CommanderConsoleInputSchema = z.object({
  childCapabilityId: CommanderChildCapabilityIdSchema,
  operatorRef: z.string().min(1),
  input: z.record(z.unknown()),
}).strict();

export type CommanderConsoleInput = z.output<typeof CommanderConsoleInputSchema>;

// ─── Envelope ─────────────────────────────────────────────────────────────────

export const CommanderEnvelopeSchema = z.object({
  envelopeId: z.string().min(1),
  commandId: z.string().min(1),
  commandType: z.string().min(1),
  operatorRef: z.string().min(1),
  missionId: z.string().nullable(),
  userRequirementText: z.string().nullable(),
  selectedPlatforms: z.array(z.string()),
  requestedPlatformId: z.string().nullable(),
  maxRounds: z.number().int().min(1).nullable(),
  maxMinutes: z.number().int().min(1).nullable(),
  payload: z.record(z.unknown()),
  idempotencyKey: z.string().min(1),
  timeoutMs: z.number().int().min(1),
  createdAt: z.string().min(1),
}).strict();

export type CommanderEnvelope = z.output<typeof CommanderEnvelopeSchema>;

// ─── Proof ────────────────────────────────────────────────────────────────────

export const CommanderProofSchema = z.object({
  proofId: z.string().min(1),
  abilityGroupId: z.literal("commander-console"),
  childCapabilityId: CommanderChildCapabilityIdSchema,
  commandId: z.string().min(1),
  commandType: z.string().min(1),
  operatorRef: z.string().min(1),
  missionId: z.string().nullable(),
  status: CommanderStatusSchema,
  failureReason: z.string().nullable(),
  reviewRequiredReason: z.string().nullable(),
  envelopeId: z.string().nullable(),
  startedAt: z.string().min(1),
  endedAt: z.string().min(1),
  durationMs: z.number().int().min(0),
}).strict();

export type CommanderProof = z.output<typeof CommanderProofSchema>;

// ─── Mission status view ──────────────────────────────────────────────────────

export const CommanderMissionStatusViewSchema = z.object({
  missionId: z.string().nullable(),
  status: CommanderMissionStatusSchema,
  currentPlatform: z.string().nullable(),
  userRequirementSummary: z.string().nullable(),
  startedAt: z.string().nullable(),
  updatedAt: z.string().min(1),
  lastStopReason: z.string().nullable(),
  reviewRequiredReason: z.string().nullable(),
  matchedEvidenceCount: z.number().int().min(0),
  lastActionFailureCount: z.number().int().min(0),
}).strict();

export type CommanderMissionStatusView = z.output<typeof CommanderMissionStatusViewSchema>;

// ─── Global Commander Console result ─────────────────────────────────────────

export const CommanderConsoleResultSchema = z.object({
  status: CommanderStatusSchema,
  output: z.unknown().nullable(),
  runtimeProof: CommanderProofSchema.nullable(),
  failureReason: z.string().nullable(),
  reviewRequiredReason: z.string().nullable(),
}).strict();

export type CommanderConsoleResult = z.output<typeof CommanderConsoleResultSchema>;

// ─── Public schema re-exports from shared/ ───────────────────────────────────

export {
  CommanderConsoleStatusSchema,
  CommandTransportResultSchema,
  CommanderCommandReceiptSchema,
  CommanderTransportPayloadSchema,
  CommanderEvidencePolicySchema,
  EmergencyStopTransportPayloadSchema,
  PauseMissionTransportPayloadSchema,
  ResumeMissionTransportPayloadSchema,
  StopMissionTransportPayloadSchema,
  StartMissionTransportPayloadSchema,
  MarkReviewRequiredTransportPayloadSchema,
  HumanCommandInputSchema,
  RuntimeProofSchema,
  RequestedPlatformIdSchema,
  CommanderReadModelSourceSchema,
} from "./shared/commander-schema-base.js";
