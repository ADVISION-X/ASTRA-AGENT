import { z } from "zod";

import {
  BrowserLoginStateSchema,
  BrowserModeSchema,
  BrowserProfileStatusSchema,
  BrowserProfileVerificationStatusSchema,
} from "../../types/local-browser-session.js";
import { OPEN_FAILURE_CODES } from "./shared/open-failure.js";
import { DEFAULT_LOCALHOST_HOSTNAMES } from "./shared/open-policy.js";
import {
  OPEN_CLOCK_KIND,
  OPEN_NAVIGATION_DECISION_STATUSES,
  OPEN_SESSION_DECISION_STATUSES,
  OPEN_TARGET_POLICY_DECISION_STATUSES,
  OPEN_URL_SAFETY_DECISION_STATUSES,
} from "./shared/open-proof.js";
import { OPEN_RESULT_STATUSES } from "./shared/open-result.js";
import {
  OPEN_ABILITY_GROUP_ID,
  OPEN_ALLOWED_CALLERS,
  OPEN_CHILD_CAPABILITY_IDS,
  OPEN_FAILURE_INPUT_PARSE_DECISIONS,
  OPEN_PLATFORM_IDS,
  OPEN_POST_OPEN_CLASSIFICATIONS,
  OPEN_TRACE_FIELD_SOURCES,
  OPEN_TARGET_KINDS,
} from "./shared/open-target-profile.js";

const nullableString = z.string().min(1).nullable().optional().default(null);
const nullableUrl = z.string().url().nullable().optional().default(null);
const nonNegativeInt = z.number().int().nonnegative();

export const OpenChildCapabilityIdSchema = z.enum(OPEN_CHILD_CAPABILITY_IDS);
export const OpenTargetKindSchema = z.enum(OPEN_TARGET_KINDS);
export const OpenPlatformIdSchema = z.enum(OPEN_PLATFORM_IDS);
export const OpenStatusSchema = z.enum(OPEN_RESULT_STATUSES);
export const OpenFailureCodeSchema = z.enum(OPEN_FAILURE_CODES);
export const OpenAllowedCallerSchema = z.enum(OPEN_ALLOWED_CALLERS);
export const OpenTraceFieldSourceSchema = z.enum(OPEN_TRACE_FIELD_SOURCES);
export const OpenFailureInputParseDecisionSchema = z.enum(OPEN_FAILURE_INPUT_PARSE_DECISIONS);

export const OpenDataQualityFlagSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(["info", "warn", "error"]),
  reason: z.string().min(1),
}).strict();

export const OpenTimeoutPolicySchema = z.object({
  maxOpenDurationMs: z.number().int().positive(),
  timeoutFailureCode: z.literal("navigation_timeout"),
}).strict();

export const OpenIdempotencyPolicySchema = z.object({
  allowReplay: z.boolean().default(false),
  scope: z.literal("session_target_round"),
  duplicateStatus: z.literal("review_required"),
}).strict();

export const OpenBoundaryPolicySchema = z.object({
  allowedCaller: z.array(OpenAllowedCallerSchema).nonempty(),
  requiresNerveBus: z.boolean(),
  requiresPageStateHandoff: z.literal(true),
  deniesCookieRead: z.literal(true),
  deniesDirectChildImport: z.literal(true),
  deniesOtherCapabilityImports: z.array(z.string().min(1)).nonempty(),
}).strict();

export const OpenProofPolicySchema = z.object({
  requireRuntimeProof: z.literal(true),
  requireNegativeProof: z.literal(true),
  allowFailureOutput: z.literal(false),
  allowReviewOutput: z.literal(false),
}).strict();

export const OpenOutputPolicySchema = z.object({
  successRequiresPageStateHandoff: z.literal(true),
  failureOutputMustBeNull: z.literal(true),
  reviewOutputMustBeNull: z.literal(true),
}).strict();

export const OpenFailurePolicySchema = z.object({
  dispatchFailureUsesEnvelopeOnly: z.literal(true),
  fakeTargetProfileForbidden: z.literal(true),
  fakeAllowDecisionForbidden: z.literal(true),
}).strict();

export const OpenFailureSchema = z.object({
  code: OpenFailureCodeSchema,
  message: z.string().min(1),
  detail: nullableString,
}).strict();

export const OpenTargetProfileSchema = z.object({
  childCapabilityId: OpenChildCapabilityIdSchema,
  targetKind: OpenTargetKindSchema,
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

export const OpenRequestSchema = z.object({
  abilityGroupId: z.literal(OPEN_ABILITY_GROUP_ID).default(OPEN_ABILITY_GROUP_ID),
  childCapabilityId: OpenChildCapabilityIdSchema,
  platformId: OpenPlatformIdSchema,
  targetKind: OpenTargetKindSchema,
  requestedBy: OpenAllowedCallerSchema,
  sourceAbilityGroupId: OpenAllowedCallerSchema,
  sourceChildCapabilityId: nullableString,
  missionId: z.string().min(1),
  runId: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
  reason: z.string().min(1),
  targetUrl: nullableString,
  targetTitle: nullableString,
  sourceRef: nullableString,
}).strict();

export const BrowserSessionSnapshotSchema = z.object({
  open: z.boolean(),
  currentUrl: z.union([z.string().url(), z.literal("about:blank")]),
  currentTitle: nullableString,
  browserExecutable: nullableString,
  browserMode: BrowserModeSchema,
  browserProfileRef: z.string().min(1),
  browserExecutablePath: nullableString,
  profileStatus: BrowserProfileStatusSchema,
  profileDirectory: z.string().min(1),
  profileProvisioning: z.enum(["operator_supplied", "managed_default"]),
  profileVerificationStatus: BrowserProfileVerificationStatusSchema,
  profileVerificationReason: nullableString,
  loginState: BrowserLoginStateSchema,
  lastLoginCheckAt: nullableString,
  loginRequiredReason: nullableString,
  reviewRequiredReason: nullableString,
}).strict();

export const NavigationResultSchema = z.object({
  browserActionId: z.string().min(1),
  ok: z.boolean(),
  message: z.string().min(1),
  createdAt: z.string().datetime(),
  fallbackUsed: z.boolean(),
}).strict();

export const OpenTargetPolicyDecisionSchema = z.object({
  status: z.enum(OPEN_TARGET_POLICY_DECISION_STATUSES),
  reason: nullableString,
  targetProfileRef: nullableString,
  resolvedTargetUrl: nullableUrl,
  resolvedTargetTitle: nullableString,
}).strict().superRefine((value, context) => {
  if (value.status === "allow" && (!value.targetProfileRef || !value.resolvedTargetUrl || !value.resolvedTargetTitle)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "allow target policy decision requires target profile and resolved target fields", path: ["resolvedTargetUrl"] });
  }
});

export const OpenUrlSafetyDecisionSchema = z.object({
  status: z.enum(OPEN_URL_SAFETY_DECISION_STATUSES),
  reason: nullableString,
  normalizedUrl: nullableUrl,
  hostname: nullableString,
  scheme: z.enum(["http", "https"]).nullable().optional().default(null),
}).strict().superRefine((value, context) => {
  if (value.status === "allow" && (!value.normalizedUrl || !value.hostname || !value.scheme)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "allow url safety decision requires normalized url, hostname, and scheme", path: ["normalizedUrl"] });
  }
});

export const OpenSessionDecisionSchema = z.object({
  status: z.enum(OPEN_SESSION_DECISION_STATUSES),
  reason: nullableString,
  browserMode: BrowserModeSchema,
  profileStatus: BrowserProfileStatusSchema,
  profileVerificationStatus: BrowserProfileVerificationStatusSchema,
}).strict();

export const OpenNavigationDecisionSchema = z.object({
  status: z.enum(OPEN_NAVIGATION_DECISION_STATUSES),
  reason: nullableString,
  browserActionId: nullableString,
  fallbackUsed: z.boolean(),
  openedUrl: nullableString,
  pageTitleAfter: nullableString,
  navigationAttemptRef: z.string().min(1),
  redirectChain: z.array(z.string().url()).default([]),
}).strict();

export const PostOpenStateDecisionSchema = z.object({
  status: OpenStatusSchema,
  classification: z.enum(OPEN_POST_OPEN_CLASSIFICATIONS),
  reason: nullableString,
  openedUrl: nullableString,
  pageTitleAfter: nullableString,
  pageStateHandoffRequired: z.boolean(),
}).strict();

export const OpenOutputSchema = z.object({
  targetProfileRef: z.string().min(1),
  targetUrl: z.string().url(),
  openedUrl: nullableString,
  redirectChain: z.array(z.string().url()).default([]),
  pageTitleAfter: nullableString,
  browserSessionRef: z.string().min(1),
  browserProfileRef: z.string().min(1),
  browserMode: BrowserModeSchema,
  profileVerificationStatus: BrowserProfileVerificationStatusSchema,
  loginStateBefore: BrowserLoginStateSchema,
  loginStateAfter: BrowserLoginStateSchema,
  sourceRef: z.string().min(1),
  openAttemptRef: z.string().min(1),
  pageStateRef: nullableString,
  forensicsRef: nullableString,
  fallbackUsed: z.boolean(),
  pageStateHandoffRequired: z.boolean(),
}).strict();

export const OpenRuntimeProofSchema = z.object({
  proofId: z.string().min(1),
  runId: nullableString,
  missionId: nullableString,
  sessionId: nullableString,
  roundId: nullableString,
  videoVisitId: nullableString,
  abilityGroupId: z.literal(OPEN_ABILITY_GROUP_ID),
  childCapabilityId: OpenChildCapabilityIdSchema.nullable().optional().default(null),
  platformId: OpenPlatformIdSchema.nullable().optional().default(null),
  targetKind: OpenTargetKindSchema.nullable().optional().default(null),
  sourceAbilityGroupId: z.string().min(1),
  sourceChildCapabilityId: nullableString,
  inputRef: z.string().min(1),
  outputRef: z.string().min(1),
  targetProfileRef: nullableString,
  targetUrl: nullableUrl,
  openedUrl: nullableString,
  redirectChain: z.array(z.string().url()).default([]),
  browserProfileRef: z.string().min(1),
  browserMode: BrowserModeSchema,
  profileVerificationStatus: BrowserProfileVerificationStatusSchema,
  loginStateBefore: BrowserLoginStateSchema,
  loginStateAfter: BrowserLoginStateSchema,
  pageTitleAfter: nullableString,
  idempotencyKey: z.string().min(1),
  navigationAttemptRef: z.string().min(1),
  pageStateHandoffRequired: z.boolean(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: nonNegativeInt,
  status: OpenStatusSchema,
  failureReason: OpenFailureSchema.nullable().default(null),
  reviewRequiredReason: nullableString,
  targetPolicyDecision: OpenTargetPolicyDecisionSchema,
  urlSafetyDecision: OpenUrlSafetyDecisionSchema,
  sessionDecision: OpenSessionDecisionSchema,
  navigationDecision: OpenNavigationDecisionSchema,
  postOpenStateDecision: PostOpenStateDecisionSchema,
  dataQualityFlags: z.array(OpenDataQualityFlagSchema).default([]),
  browserSessionRef: z.string().min(1),
  sourceRef: z.string().min(1),
  openAttemptRef: z.string().min(1),
  pageStateRef: nullableString,
  forensicsRef: nullableString,
  missionIdSource: OpenTraceFieldSourceSchema,
  runIdSource: OpenTraceFieldSourceSchema,
  sessionIdSource: OpenTraceFieldSourceSchema,
  targetUrlSource: OpenTraceFieldSourceSchema,
  childCapabilityIdSource: OpenTraceFieldSourceSchema,
  failureInputParseDecision: OpenFailureInputParseDecisionSchema,
  clock: z.object({
    portKind: z.literal(OPEN_CLOCK_KIND),
    startedMonotonicMs: z.number().finite(),
    endedMonotonicMs: z.number().finite(),
  }).strict(),
}).strict().superRefine((value, context) => {
  if (value.clock.startedMonotonicMs > value.clock.endedMonotonicMs) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "startedMonotonicMs must not be after endedMonotonicMs", path: ["clock", "startedMonotonicMs"] });
  }
  if (value.status !== value.postOpenStateDecision.status) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "proof status must equal postOpenStateDecision.status", path: ["postOpenStateDecision", "status"] });
  }
  if (value.status === "success" && !value.pageStateHandoffRequired) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof requires pageStateHandoffRequired=true", path: ["pageStateHandoffRequired"] });
  }
  if (value.status === "success" && (!value.childCapabilityId || !value.platformId || !value.targetKind || !value.runId || !value.missionId || !value.sessionId || !value.targetProfileRef || !value.targetUrl)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success proof requires complete identity and target fields", path: ["childCapabilityId"] });
  }
});

export const OpenResultSchema = z.object({
  abilityGroupId: z.literal(OPEN_ABILITY_GROUP_ID),
  childCapabilityId: OpenChildCapabilityIdSchema.nullable().optional().default(null),
  platformId: OpenPlatformIdSchema.nullable().optional().default(null),
  targetKind: OpenTargetKindSchema.nullable().optional().default(null),
  status: OpenStatusSchema,
  message: z.string().min(1),
  targetUrl: nullableUrl,
  openedUrl: nullableString,
  targetTitle: nullableString,
  pageTitleAfter: nullableString,
  pageStateHandoffRequired: z.boolean(),
  output: OpenOutputSchema.nullable().default(null),
  failureReason: OpenFailureSchema.nullable().default(null),
  reviewRequiredReason: nullableString,
  runtimeProof: OpenRuntimeProofSchema,
}).strict().superRefine((value, context) => {
  if (value.runtimeProof.status !== value.status) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "runtimeProof.status must equal result.status", path: ["runtimeProof", "status"] });
  }
  if (value.status === "success" && !value.pageStateHandoffRequired) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success result requires pageStateHandoffRequired=true", path: ["pageStateHandoffRequired"] });
  }
  if (value.status === "success" && (!value.output || !value.childCapabilityId || !value.platformId || !value.targetKind || !value.targetUrl)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "success result requires output and target identity fields", path: ["output"] });
  }
  if (value.status !== "success" && value.output !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "failed or review_required result must not expose executable output", path: ["output"] });
  }
});

export const OpenProfileOverrideSchema = z.object({
  defaultUrl: z.string().url().optional(),
  defaultTitle: z.string().min(1).optional(),
  allowedHostnames: z.array(z.string().min(1)).nonempty().optional(),
}).strict();

export const OpenLocalhostHostnameSchema = z.enum(DEFAULT_LOCALHOST_HOSTNAMES);