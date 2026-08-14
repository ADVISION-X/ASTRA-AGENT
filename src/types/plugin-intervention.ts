import { z } from "zod";

const PluginInterventionActionSchema = z.enum(["pause", "cancel", "takeover", "resume"]);
export type PluginInterventionAction = z.infer<typeof PluginInterventionActionSchema>;

const PluginInterventionStateSchema = z.enum([
  "running",
  "pause_requested",
  "paused",
  "cancel_requested",
  "cancelled",
  "takeover_requested",
  "taken_over",
  "review_required",
]);
export const PluginInterventionRequestSchema = z.object({
  taskId: z.string().trim().min(1).max(180),
  expectedRevision: z.number().int().nonnegative(),
  reason: z.string().trim().min(1).max(500),
  requestId: z.string().trim().min(1).max(180),
}).strict();
export type PluginInterventionRequest = z.infer<typeof PluginInterventionRequestSchema>;

const PluginInterventionSnapshotSchema = z.object({
  revision: z.number().int().nonnegative(),
  state: PluginInterventionStateSchema,
  reason: z.string().nullable(),
  checkpoint: z.string().min(1),
  pending: PluginInterventionRequestSchema.extend({
    action: PluginInterventionActionSchema,
    requestedAt: z.string().min(1),
  }).nullable(),
  updatedAt: z.string().min(1),
}).strict();

export type PluginInterventionSnapshot = z.infer<typeof PluginInterventionSnapshotSchema>;
