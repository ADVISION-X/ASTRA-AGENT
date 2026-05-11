/**
 * schema.ts — Open Ability Group canonical schema.
 *
 * Open opens governed targets. That is its only job.
 * It does not own page readiness, page meaning, or semantic success.
 */

import { z } from "zod";

// ─── Governed Identity ─────────────────────────────────────────────────────

export const OPEN_ABILITY_GROUP_ID = "open" as const;

export const OpenChildCapabilityIdSchema = z.enum([
  "open-platform-entry-once",
  "open-local-workbench-once",
]);

export type OpenChildCapabilityId = z.infer<typeof OpenChildCapabilityIdSchema>;

export const OpenStatusSchema = z.enum(["success", "failed", "review_required"]);
export type OpenStatus = z.infer<typeof OpenStatusSchema>;

// ─── Target Identity ────────────────────────────────────────────────────────

/** Source of the target URL — must be declared, no silent fallback allowed. */
export const OpenTargetUrlSourceSchema = z.enum([
  "user",
  "platformRegistry",
  "system",
]);
export type OpenTargetUrlSource = z.infer<typeof OpenTargetUrlSourceSchema>;

// ─── Raw Open Observation ───────────────────────────────────────────────────

/**
 * RawOpenObservation — raw browser state snapshot after navigation attempt.
 *
 * Contains only factual browser state. No semantic judgment.
 * AI owns readiness, page-kind, login, captcha, feed, safety interpretation.
 */
export const RawOpenObservationSchema = z.object({
  currentUrl: z.string().optional(),
  currentTitle: z.string().optional(),
  browserSessionRef: z.string().optional(),
  navigationStartedAt: z.string().datetime().optional(),
  navigationEndedAt: z.string().datetime().optional(),
  rawRuntimeSignals: z.record(z.unknown()).optional(),
}).strict();

export type RawOpenObservation = z.infer<typeof RawOpenObservationSchema>;

// ─── Input ──────────────────────────────────────────────────────────────────

const OpenInputBaseSchema = z.object({
  missionId: z.string().min(1),
  runId: z.string().min(1),
  sessionId: z.string().min(1).optional(),
  roundId: z.string().min(1).optional(),
  stepId: z.string().min(1),
  capabilityCallId: z.string().min(1),
  nerveBusEnvelopeId: z.string().min(1),
  requestedBy: z.string().min(1),
  inputRef: z.string().min(1),
  idempotencyKey: z.string().min(1),
  timeoutMs: z.number().int().positive().optional(),
});

export const OpenPlatformEntryInputSchema = OpenInputBaseSchema.extend({
  childCapabilityId: z.literal("open-platform-entry-once"),
  /** Reference to a governed platform target (e.g. "facebook", "tiktok"). */
  targetProfileRef: z.string().min(1).optional(),
  /** Explicit URL — only allowed when targetUrlSource is declared. */
  targetUrl: z.string().url().optional(),
  targetUrlSource: OpenTargetUrlSourceSchema.optional(),
}).strict();

export const OpenLocalWorkbenchInputSchema = OpenInputBaseSchema.extend({
  childCapabilityId: z.literal("open-local-workbench-once"),
  workbenchUrl: z.string().url(),
}).strict();

export const OpenInputSchema = z.discriminatedUnion("childCapabilityId", [
  OpenPlatformEntryInputSchema,
  OpenLocalWorkbenchInputSchema,
]);

export type OpenPlatformEntryInput = z.infer<typeof OpenPlatformEntryInputSchema>;
export type OpenLocalWorkbenchInput = z.infer<typeof OpenLocalWorkbenchInputSchema>;
export type OpenInput = z.infer<typeof OpenInputSchema>;

// ─── Proof ──────────────────────────────────────────────────────────────────

/**
 * OpenNavigationAttemptProof — proves a navigation attempt happened or failed.
 *
 * Does NOT prove page readiness, login success, feed loaded, or any semantic truth.
 */
export const OpenNavigationAttemptProofSchema = z.object({
  proofId: z.string().min(1),
  abilityGroupId: z.literal("open"),
  childCapabilityId: OpenChildCapabilityIdSchema,
  missionId: z.string().min(1),
  runId: z.string().min(1),
  sessionId: z.string().min(1).optional(),
  roundId: z.string().min(1).optional(),
  stepId: z.string().min(1),
  capabilityCallId: z.string().min(1),
  nerveBusEnvelopeId: z.string().min(1),
  requestedBy: z.string().min(1),
  targetProfileRef: z.string().optional(),
  targetUrlSource: OpenTargetUrlSourceSchema.optional(),
  /** SHA-256 hash of the target URL — not the URL itself. */
  targetUrlHash: z.string().optional(),
  status: OpenStatusSchema,
  openResultRef: z.string().optional(),
  rawBrowserObservationRef: z.string().optional(),
  postOpenObservationRef: z.string().optional(),
  failureReason: z.string().optional(),
  reviewRequiredReason: z.string().optional(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
}).strict();

export type OpenNavigationAttemptProof = z.infer<typeof OpenNavigationAttemptProofSchema>;

// ─── Result ─────────────────────────────────────────────────────────────────

export const OpenResultSchema = z.object({
  status: OpenStatusSchema,
  childCapabilityId: OpenChildCapabilityIdSchema,
  openResultRef: z.string().min(1),
  navigationAttemptProofRef: z.string().min(1),
  rawOpenObservation: RawOpenObservationSchema.optional(),
  rawBrowserObservationRef: z.string().optional(),
  postOpenObservationRef: z.string().optional(),
  targetProfileRef: z.string().optional(),
  targetUrlSource: OpenTargetUrlSourceSchema.optional(),
  failureReason: z.string().optional(),
  reviewRequiredReason: z.string().optional(),
}).strict();

export type OpenResult = z.infer<typeof OpenResultSchema>;
