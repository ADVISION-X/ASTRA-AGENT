import { z } from "zod";

import {
  OpenAllowedCallerSchema,
  OpenChildCapabilityIdSchema,
  OpenFailureSchema,
  OpenPlatformIdSchema,
  OpenStatusSchema,
  OpenTargetKindSchema,
  nullableString,
} from "./schema-base.js";
import {
  BrowserLoginStateSchema,
  BrowserModeSchema,
  BrowserProfileStatusSchema,
  BrowserProfileVerificationStatusSchema,
} from "./schema-base.js";
import {
  OPEN_ABILITY_GROUP_ID,
} from "./shared/open-target-profile.js";

const OpenTimeoutPolicySchema = z.object({
  maxOpenDurationMs: z.number().int().positive(),
  timeoutFailureCode: z.literal("navigation_timeout"),
}).strict();

const OpenIdempotencyPolicySchema = z.object({
  allowReplay: z.boolean().default(false),
  scope: z.literal("session_target_round_video_visit"),
  duplicateStatus: z.literal("review_required"),
  ttlMs: z.number().int().positive(),
  maxReservations: z.number().int().positive(),
}).strict();

const OpenBoundaryPolicySchema = z.object({
  allowedCaller: z.array(OpenAllowedCallerSchema).nonempty(),
  requiresNerveBus: z.boolean(),
  requiresPageStateHandoff: z.literal(true),
  deniesCookieRead: z.literal(true),
  deniesDirectChildImport: z.literal(true),
  deniesOtherCapabilityImports: z.array(z.string().min(1)).nonempty(),
}).strict();

const OpenProofPolicySchema = z.object({
  requireRuntimeProof: z.literal(true),
  requireNegativeProof: z.literal(true),
  allowFailureOutput: z.literal(false),
  allowReviewOutput: z.literal(false),
}).strict();

const OpenOutputPolicySchema = z.object({
  successRequiresPageStateHandoff: z.literal(true),
  failureOutputMustBeNull: z.literal(true),
  reviewOutputMustBeNull: z.literal(true),
}).strict();

const OpenFailurePolicySchema = z.object({
  dispatchFailureUsesEnvelopeOnly: z.literal(true),
  fakeTargetProfileForbidden: z.literal(true),
  fakeAllowDecisionForbidden: z.literal(true),
}).strict();

const OpenWebTargetProfileSchema = z.object({
  childCapabilityId: OpenChildCapabilityIdSchema,
  targetKind: z.enum(["platform-feed", "local-workbench"]),
  platformId: OpenPlatformIdSchema,
  allowedHostnames: z.array(z.string().min(1)).nonempty(),
  defaultUrl: z.string().url(),
  defaultTitle: z.string().min(1),
  purpose: z.string().min(1),
  allowedCaller: z.array(OpenAllowedCallerSchema).nonempty(),
  requiresNerveBus: z.boolean(),
  requiresRealChromeSession: z.boolean().default(true),
  allowsLocalhost: z.boolean().default(false),
  maxOpenDurationMs: z.number().int().positive(),
  allowedSchemes: z.array(z.enum(["http", "https"])).nonempty(),
  postOpenStatePolicy: z.object({
    allowLoginWallReview: z.boolean().default(true),
    allowSecurityWallReview: z.boolean().default(true),
    allowBlankPageReview: z.boolean().default(true),
    requirePageTitle: z.boolean().default(true),
    classifyCaptchaWall: z.literal(true),
    classifyPermissionWall: z.literal(true),
  }).strict(),
  pageStateHandoffRequired: z.literal(true),
  allowReplay: z.boolean().default(false),
  timeoutPolicy: OpenTimeoutPolicySchema,
  idempotencyPolicy: OpenIdempotencyPolicySchema,
  boundaryPolicy: OpenBoundaryPolicySchema,
  proofPolicy: OpenProofPolicySchema,
  outputPolicy: OpenOutputPolicySchema,
  failurePolicy: OpenFailurePolicySchema,
}).strict();

const LocalProgramOpenTargetProfileSchema = z.object({
  childCapabilityId: z.literal("open-local-program"),
  targetKind: z.literal("local-program"),
  platformId: z.literal("macos-local"),
  targetProfileRef: z.string().min(1),
  appName: z.string().min(1),
  bundleId: nullableString,
  appPath: nullableString,
  allowedLaunchMethod: z.literal("macos-open-application"),
  defaultTitle: z.string().min(1),
  purpose: z.string().min(1),
  allowedCaller: z.array(OpenAllowedCallerSchema).nonempty(),
  requiresNerveBus: z.boolean(),
  requiresRealChromeSession: z.literal(false),
  allowsLocalhost: z.literal(false),
  maxOpenDurationMs: z.number().int().positive(),
  pageStateHandoffRequired: z.literal(true),
  localAppStateHandoffRequired: z.literal(true),
  requiresUserVisibleWindow: z.literal(true),
  requiresPostOpenWindowHandoff: z.literal(true),
  allowReplay: z.boolean().default(false),
  timeoutPolicy: OpenTimeoutPolicySchema,
  idempotencyPolicy: OpenIdempotencyPolicySchema,
  boundaryPolicy: OpenBoundaryPolicySchema,
  proofPolicy: OpenProofPolicySchema,
  outputPolicy: OpenOutputPolicySchema,
  failurePolicy: OpenFailurePolicySchema,
}).strict();

const OpenTargetProfileSchema = z.discriminatedUnion("targetKind", [
  OpenWebTargetProfileSchema,
  LocalProgramOpenTargetProfileSchema,
]);

const OpenRequestSchema = z.object({
  abilityGroupId: z.literal(OPEN_ABILITY_GROUP_ID).default(OPEN_ABILITY_GROUP_ID),
  childCapabilityId: OpenChildCapabilityIdSchema,
  requestedBy: OpenAllowedCallerSchema,
  sourceAbilityGroupId: z.string().min(1),
  sourceChildCapabilityId: nullableString,
  missionId: z.string().min(1),
  runId: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
  stepId: z.string().min(1),
  bindingPackageId: z.string().min(1),
  bindingPackageVersion: z.string().min(1),
  selectedBindingId: z.string().min(1),
  bindingVersion: z.string().min(1),
  bindingSnapshotRef: z.string().min(1),
  capabilityCallId: z.string().min(1),
  nerveBusEnvelopeId: z.string().min(1),
  platformId: OpenPlatformIdSchema,
  targetKind: OpenTargetKindSchema,
  reason: z.string().min(1),
  targetUrl: nullableString,
  targetTitle: nullableString,
  targetProfileRef: nullableString,
  sourceRef: z.string().min(1),
  inputRef: z.string().min(1),
  idempotencyKey: z.string().min(1),
  timeoutMs: z.number().int().positive(),
}).strict();

export {
  OpenTimeoutPolicySchema,
  OpenIdempotencyPolicySchema,
  OpenBoundaryPolicySchema,
  OpenProofPolicySchema,
  OpenOutputPolicySchema,
  OpenFailurePolicySchema,
  OpenWebTargetProfileSchema,
  LocalProgramOpenTargetProfileSchema,
  OpenTargetProfileSchema,
  OpenRequestSchema,
};
