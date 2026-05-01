import { z } from "zod";

import { EvidencePacketRoundOutcomeSchema } from "./evidence-packet.js";

const RuntimeStatusSchema = z.enum([
  "idle",
  "running",
  "paused",
  "stopped",
  "completed",
  "failed",
  "review_required"
]);

const ReviewDispositionSchema = z.enum(["pending", "approve", "reject", "hold"]);

const TaskRunSchema = z.object({
  id: z.string().min(1),
  platformId: z.string().min(1),
  status: RuntimeStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  maxRounds: z.number().int().positive(),
  currentRoundIndex: z.number().int().nonnegative(),
  note: z.string().min(1).optional()
});

const AgentRoundStatusSchema = z.enum([
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

const AgentRoundSchema = z.object({
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

type RuntimeStatus = z.infer<typeof RuntimeStatusSchema>;
type ReviewDisposition = z.infer<typeof ReviewDispositionSchema>;
type TaskRun = z.infer<typeof TaskRunSchema>;
type AgentRoundStatus = z.infer<typeof AgentRoundStatusSchema>;
type AgentRound = z.infer<typeof AgentRoundSchema>;

export { RuntimeStatusSchema, ReviewDispositionSchema, TaskRunSchema, AgentRoundStatusSchema, AgentRoundSchema };
export type { RuntimeStatus, ReviewDisposition, TaskRun, AgentRoundStatus, AgentRound };
