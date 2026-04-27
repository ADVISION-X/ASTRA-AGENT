import { z } from "zod";

import { EvidencePacketRoundOutcomeSchema } from "./evidence-packet.js";

export const RuntimeStatusSchema = z.enum([
  "idle",
  "running",
  "paused",
  "stopped",
  "completed",
  "failed",
  "review_required"
]);

export const ReviewDispositionSchema = z.enum(["pending", "approve", "reject", "hold"]);

export const TaskRunSchema = z.object({
  id: z.string().min(1),
  platformId: z.string().min(1),
  status: RuntimeStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  maxRounds: z.number().int().positive(),
  currentRoundIndex: z.number().int().nonnegative(),
  note: z.string().min(1).optional()
});

export const AgentRoundStatusSchema = z.enum([
  "pending",
  "observed",
  "classified",
  "acted",
  "recorded",
  "skipped",
  "review_required",
  "completed",
  "failed"
]);

export const AgentRoundSchema = z.object({
  id: z.string().min(1),
  taskRunId: z.string().min(1),
  index: z.number().int().nonnegative(),
  status: AgentRoundStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  videoId: z.string().min(1).optional(),
  videoVisitId: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
  candidateId: z.string().min(1).optional(),
  packetId: z.string().min(1).optional(),
  roundOutcome: EvidencePacketRoundOutcomeSchema.optional(),
  decisionReason: z.string().min(1).optional(),
  nextStep: z.string().min(1).optional(),
  actionLogIds: z.array(z.string().min(1)).default([])
});

export type RuntimeStatus = z.infer<typeof RuntimeStatusSchema>;
export type ReviewDisposition = z.infer<typeof ReviewDispositionSchema>;
export type TaskRun = z.infer<typeof TaskRunSchema>;
export type AgentRoundStatus = z.infer<typeof AgentRoundStatusSchema>;
export type AgentRound = z.infer<typeof AgentRoundSchema>;