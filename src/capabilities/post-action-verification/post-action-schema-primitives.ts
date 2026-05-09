import { z } from "zod";

import { POST_ACTION_EVIDENCE_KINDS } from "./shared/post-action-evidence.js";
import {
  POST_ACTION_OBSERVATION_KINDS,
  POST_ACTION_OBSERVATION_SOURCE_ABILITY_GROUP_IDS,
} from "./shared/post-action-observation.js";

const POST_ACTION_MAX_SUMMARY_LENGTH = 500;
const POST_ACTION_MAX_STATUS_MESSAGE_LENGTH = 500;
const POST_ACTION_MAX_EVIDENCE_REFS = 12;
const POST_ACTION_MAX_OBSERVATIONS = 12;
const POST_ACTION_MAX_SOURCE_PROOF_REFS = 12;
const POST_ACTION_MAX_TARGET_TYPE_LENGTH = 120;

const requiredString = z.string().min(1);
const nullableString = requiredString.nullable().optional().default(null);
const nullableLimitedString = z.string().min(1).max(POST_ACTION_MAX_SUMMARY_LENGTH).nullable().optional().default(null);
const nonNegativeInt = z.number().int().nonnegative();
const dataQualityFlagsSchema = z.array(requiredString).max(30).default([]);

const PostActionEvidenceKindSchema = z.enum(POST_ACTION_EVIDENCE_KINDS);
const PostActionObservationKindSchema = z.enum(POST_ACTION_OBSERVATION_KINDS);
const PostActionObservationSourceAbilityGroupIdSchema = z.enum(POST_ACTION_OBSERVATION_SOURCE_ABILITY_GROUP_IDS);

const PostActionObservationSourceSchema = z.object({
  sourceAbilityGroupId: PostActionObservationSourceAbilityGroupIdSchema,
  sourceChildCapabilityId: requiredString,
  sourceProofRef: requiredString,
}).strict();

const PostActionEvidenceRefSchema = z.object({
  evidenceRef: requiredString,
  evidenceKind: PostActionEvidenceKindSchema,
  sourceAbilityGroupId: PostActionObservationSourceAbilityGroupIdSchema,
  sourceChildCapabilityId: requiredString,
  sourceProofRef: requiredString,
  capturedAt: z.string().datetime(),
  sessionId: requiredString,
  roundId: nullableString,
  videoVisitId: nullableString,
  summary: nullableLimitedString,
}).strict();

const PageStateObservationPayloadSchema = z.object({
  kind: z.literal("page_state"),
  currentUrl: nullableString,
  loginState: nullableString,
  commentsPanelOpen: z.boolean().nullable().default(null),
  modalOverlayPresent: z.boolean().nullable().default(null),
  recommendationChanged: z.boolean().nullable().default(null),
  changeSummary: nullableLimitedString,
  targetStateChanged: z.boolean().nullable().default(null),
  targetType: nullableString,
  wrongDomain: z.boolean().nullable().default(null),
}).strict();

const AiObservationPayloadSchema = z.object({
  kind: z.literal("ai_observation"),
  summary: z.string().min(1).max(POST_ACTION_MAX_SUMMARY_LENGTH),
  promptContractId: nullableString,
  aiResultRef: nullableString,
  tags: z.array(requiredString).max(20).default([]),
}).strict();

const VisualTargetObservationPayloadSchema = z.object({
  kind: z.literal("visual_target"),
  visualTargetResultRef: nullableString,
  sourceTargetRef: nullableString,
  targetType: nullableString,
  targetNature: nullableString,
  coordinateSpace: nullableString,
}).strict();

const ScreenshotDiffObservationPayloadSchema = z.object({
  kind: z.literal("screenshot_diff"),
  beforeEvidenceRef: nullableString,
  afterEvidenceRef: nullableString,
  diffSummary: nullableLimitedString,
  changed: z.boolean().nullable().default(null),
}).strict();

const VideoIdentityObservationPayloadSchema = z.object({
  kind: z.literal("video_identity"),
  previousVideoRef: nullableString,
  currentVideoRef: nullableString,
  changed: z.boolean().nullable().default(null),
  summary: nullableLimitedString,
}).strict();

const ActionCompletionObservationPayloadSchema = z.object({
  kind: z.literal("action_completion"),
  completed: z.boolean().nullable().default(null),
  actionExecutionRef: nullableString,
  primitiveExecutionRef: nullableString,
  summary: nullableLimitedString,
}).strict();

const RuntimeSignalObservationPayloadSchema = z.object({
  kind: z.literal("runtime_signal"),
  signalType: requiredString,
  signalRef: nullableString,
  targetStateChanged: z.boolean().nullable().default(null),
  afterConfirmed: z.boolean().nullable().default(null),
  summary: nullableLimitedString,
}).strict();

export {
  POST_ACTION_MAX_EVIDENCE_REFS,
  POST_ACTION_MAX_OBSERVATIONS,
  POST_ACTION_MAX_SOURCE_PROOF_REFS,
  POST_ACTION_MAX_STATUS_MESSAGE_LENGTH,
  POST_ACTION_MAX_SUMMARY_LENGTH,
  POST_ACTION_MAX_TARGET_TYPE_LENGTH,
  ActionCompletionObservationPayloadSchema,
  AiObservationPayloadSchema,
  PageStateObservationPayloadSchema,
  PostActionEvidenceKindSchema,
  PostActionEvidenceRefSchema,
  PostActionObservationKindSchema,
  PostActionObservationSourceAbilityGroupIdSchema,
  PostActionObservationSourceSchema,
  RuntimeSignalObservationPayloadSchema,
  ScreenshotDiffObservationPayloadSchema,
  VideoIdentityObservationPayloadSchema,
  VisualTargetObservationPayloadSchema,
  dataQualityFlagsSchema,
  nonNegativeInt,
  nullableLimitedString,
  nullableString,
  requiredString,
};