import { z } from "zod";

import { EvidencePacketActionPurposeSchema } from "./evidence-packet.js";

const AgentSkillCategorySchema = z.enum([
  "browser_session",
  "video_perception",
  "screenshot",
  "multi_frame_evidence",
  "local_ai_decision",
  "visual_target_detection",
  "coordinate_action",
  "forensics_persistence",
]);

const AgentSkillStatusSchema = z.enum([
  "active",
  "ready",
  "blocked",
  "degraded",
  "not_implemented",
  "review_required",
  "disabled_by_policy",
]);

const VideoOrientationModeSchema = z.enum(["portrait", "landscape", "unknown"]);

const AgentSkillStructuredLogRequirementSchema = z.object({
  requiresRuntimeEvent: z.boolean(),
  requiresActionLog: z.boolean(),
  requiresSkillId: z.boolean(),
  requiresSnapshotUpdate: z.boolean(),
});

const AgentMechanicalSkillSchema = z.object({
  skillId: z.string().min(1),
  category: AgentSkillCategorySchema,
  displayName: z.string().min(1),
  purpose: z.string().min(1),
  requiredInputs: z.array(z.string().min(1)).default([]),
  producedOutputs: z.array(z.string().min(1)).default([]),
  requiredEvidence: z.array(z.string().min(1)).default([]),
  requiredVisualTargets: z.array(z.string().min(1)).default([]),
  orientationSupport: z.array(VideoOrientationModeSchema).min(1),
  actionPurpose: EvidencePacketActionPurposeSchema.nullable().default(null),
  successCriteria: z.array(z.string().min(1)).default([]),
  failureCriteria: z.array(z.string().min(1)).default([]),
  reviewPolicy: z.array(z.string().min(1)).default([]),
  structuredLogRequirement: AgentSkillStructuredLogRequirementSchema,
  lawOwner: z.string().min(1),
  implementationOwner: z.string().min(1),
  productionReadyStatus: AgentSkillStatusSchema,
});

const ActiveAgentSkillStateSchema = z.object({
  skillId: z.string().min(1),
  category: AgentSkillCategorySchema,
  status: AgentSkillStatusSchema,
  platformId: z.string().min(1),
  orientation: VideoOrientationModeSchema,
  targetType: z.string().min(1).nullable().default(null),
  lastConfidence: z.number().min(0).max(1).nullable().default(null),
  lastResult: z.string().min(1).nullable().default(null),
  successRate: z.number().min(0).max(1).nullable().default(null),
  failureReason: z.string().min(1).nullable().default(null),
  lastExecutedAt: z.string().datetime().nullable().default(null),
  lawOwner: z.string().min(1),
  implementationOwner: z.string().min(1),
  detailSource: z.enum(["initial", "runtime"]),
});

const AgentSkillMatrixSnapshotSchema = z.object({
  platformId: z.string().min(1),
  adapterId: z.string().min(1),
  visualTargetCatalogId: z.string().min(1),
  currentOrientation: VideoOrientationModeSchema,
  allSkills: z.array(ActiveAgentSkillStateSchema),
  activeSkills: z.array(ActiveAgentSkillStateSchema),
  blockedSkills: z.array(ActiveAgentSkillStateSchema),
  notImplementedSkills: z.array(ActiveAgentSkillStateSchema),
  generatedAt: z.string().datetime(),
  snapshotMode: z.enum(["initial", "live"]),
});

type AgentSkillCategory = z.infer<typeof AgentSkillCategorySchema>;
type AgentSkillStatus = z.infer<typeof AgentSkillStatusSchema>;
type VideoOrientationMode = z.infer<typeof VideoOrientationModeSchema>;
type AgentSkillStructuredLogRequirement = z.infer<typeof AgentSkillStructuredLogRequirementSchema>;
type AgentMechanicalSkill = z.infer<typeof AgentMechanicalSkillSchema>;
type ActiveAgentSkillState = z.infer<typeof ActiveAgentSkillStateSchema>;
type AgentSkillMatrixSnapshot = z.infer<typeof AgentSkillMatrixSnapshotSchema>;

export { AgentSkillCategorySchema, AgentSkillStatusSchema, VideoOrientationModeSchema, AgentSkillStructuredLogRequirementSchema, AgentMechanicalSkillSchema, ActiveAgentSkillStateSchema, AgentSkillMatrixSnapshotSchema };
export type { AgentSkillCategory, AgentSkillStatus, VideoOrientationMode, AgentSkillStructuredLogRequirement, AgentMechanicalSkill, ActiveAgentSkillState, AgentSkillMatrixSnapshot };
