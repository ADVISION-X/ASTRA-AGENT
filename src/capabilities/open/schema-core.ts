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
  OPEN_PLATFORM_IDS,
  OPEN_POST_OPEN_CLASSIFICATIONS,
  OPEN_TARGET_KINDS,
} from "./shared/open-target-profile.js";

const nullableString = z.string().min(1).nullable().default(null);
const nullableUrl = z.string().url().nullable().default(null);
const nonNegativeInt = z.number().int().nonnegative();

const OpenChildCapabilityIdSchema = z.enum(OPEN_CHILD_CAPABILITY_IDS);
const OpenTargetKindSchema = z.enum(OPEN_TARGET_KINDS);
const OpenPlatformIdSchema = z.enum(OPEN_PLATFORM_IDS);
const OpenStatusSchema = z.enum(OPEN_RESULT_STATUSES);
const OpenFailureCodeSchema = z.enum(OPEN_FAILURE_CODES);
const OpenAllowedCallerSchema = z.enum(OPEN_ALLOWED_CALLERS);
const OpenTargetUrlSourceSchema = z.enum(["provided", "registered_profile", "rejected_missing"]);
const OpenTraceFieldSourceSchema = z.enum(["provided", "unavailable"]);
const OpenFailureInputParseDecisionSchema = z.enum(["parsed", "fallback_trace_only"]);
const OpenTimeoutDecisionSchema = z.enum(["within_limit", "timed_out"]);
const OpenAbortDecisionSchema = z.enum(["not_requested", "timeout_abort_requested", "operator_abort_requested"]);
const OpenCircuitBreakerStateSchema = z.enum(["closed", "open"]);
const OpenIdempotencyDecisionSchema = z.enum([
  "reserved",
  "duplicate_review_required",
  "already_on_target",
  "scope_capacity_exceeded",
  "not_started",
]);
const OpenAlreadyOnTargetFreshnessDecisionSchema = z.enum(["not_applicable", "freshness_required", "freshness_verified"]);

const OpenDataQualityFlagSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(["info", "warn", "error"]),
  reason: z.string().min(1),
}).strict();

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

const OpenFailureSchema = z.object({
  code: OpenFailureCodeSchema,
  message: z.string().min(1),
  detail: nullableString,
}).strict();

const OpenTargetProfileSchema = z.object({
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

const OpenRequestSchema = z.object({
  abilityGroupId: z.literal(OPEN_ABILITY_GROUP_ID).default(OPEN_ABILITY_GROUP_ID),
  childCapabilityId: OpenChildCapabilityIdSchema,
  platformId: OpenPlatformIdSchema,
  targetKind: OpenTargetKindSchema,
  requestedBy: OpenAllowedCallerSchema,
  sourceAbilityGroupId: z.string().min(1),
  sourceChildCapabilityId: nullableString,
  missionId: z.string().min(1),
  runId: z.string().min(1),
  sessionId: z.string().min(1),
  roundId: nullableString,
  videoVisitId: nullableString,
  reason: z.string().min(1),
  targetUrl: nullableString,
  targetTitle: nullableString,
  targetProfileRef: nullableString,
  sourceRef: nullableString,
}).strict();

const BrowserSessionSnapshotSchema = z.object({
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

const NavigationResultSchema = z.object({
  browserActionId: nullableString,
  ok: z.boolean(),
  message: z.string().min(1),
  createdAt: z.string().datetime(),
  openedUrl: nullableUrl,
  pageTitleAfter: nullableString,
  redirectChain: z.array(z.string().url()).default([]),
  portKind: z.string().min(1),
}).strict();

const OpenTargetPolicyDecisionSchema = z.object({
  status: z.enum(OPEN_TARGET_POLICY_DECISION_STATUSES),
  reason: nullableString,
  targetProfileRef: nullableString,
  resolvedTargetUrl: nullableUrl,
  resolvedTargetTitle: nullableString,
  targetUrlSource: OpenTargetUrlSourceSchema,
}).strict().superRefine((value, context) => {
  if (value.status === "allow" && (!value.targetProfileRef || !value.resolvedTargetUrl || !value.resolvedTargetTitle)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "allow target policy decision requires target profile and resolved target fields",
      path: ["resolvedTargetUrl"],
    });
  }
  if (value.status === "allow" && value.targetUrlSource === "rejected_missing") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "allow target policy decision cannot use rejected_missing targetUrlSource",
      path: ["targetUrlSource"],
    });
  }
});

const OpenUrlSafetyDecisionSchema = z.object({
  status: z.enum(OPEN_URL_SAFETY_DECISION_STATUSES),
  reason: nullableString,
  normalizedUrl: nullableUrl,
  hostname: nullableString,
  scheme: z.enum(["http", "https"]).nullable().default(null),
}).strict().superRefine((value, context) => {
  if (value.status === "allow" && (!value.normalizedUrl || !value.hostname || !value.scheme)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "allow url safety decision requires normalized url, hostname, and scheme",
      path: ["normalizedUrl"],
    });
  }
});

const OpenSessionDecisionSchema = z.object({
  status: z.enum(OPEN_SESSION_DECISION_STATUSES),
  reason: nullableString,
  browserMode: BrowserModeSchema,
  profileStatus: BrowserProfileStatusSchema,
  profileVerificationStatus: BrowserProfileVerificationStatusSchema,
}).strict();

const OpenNavigationDecisionSchema = z.object({
  status: z.enum(OPEN_NAVIGATION_DECISION_STATUSES),
  reason: nullableString,
  browserActionId: nullableString,
  openedUrl: nullableUrl,
  pageTitleAfter: nullableString,
  navigationAttemptRef: z.string().min(1),
  navigationCallId: z.string().min(1),
  redirectChain: z.array(z.string().url()).default([]),
  timeoutDecision: OpenTimeoutDecisionSchema,
  abortDecision: OpenAbortDecisionSchema,
  circuitBreakerState: OpenCircuitBreakerStateSchema,
  browserOpenStillRunningGuard: z.boolean(),
  alreadyOnTargetFreshnessDecision: OpenAlreadyOnTargetFreshnessDecisionSchema,
}).strict();

const PostOpenStateDecisionSchema = z.object({
  status: OpenStatusSchema,
  classification: z.enum(OPEN_POST_OPEN_CLASSIFICATIONS),
  reason: nullableString,
  openedUrl: nullableUrl,
  pageTitleAfter: nullableString,
  pageStateHandoffRequired: z.boolean(),
  pageStateHandoffRef: nullableString,
  authoritative: z.literal(false),
  documentReadyState: z.enum(["loading", "interactive", "complete"]).nullable().default(null),
}).strict().superRefine((value, context) => {
  if (value.status === "success" && (!value.pageStateHandoffRequired || value.pageStateHandoffRef === null)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "success post-open decision requires page-state handoff",
      path: ["pageStateHandoffRef"],
    });
  }
});

const OpenOutputSchema = z.object({
  targetProfileRef: z.string().min(1),
  targetUrl: z.string().url(),
  openedUrl: z.string().url(),
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
  pageStateHandoffRef: z.string().min(1),
  pageStateHandoffRequired: z.literal(true),
}).strict();

export { nullableString, nullableUrl, nonNegativeInt, OpenChildCapabilityIdSchema, OpenTargetKindSchema, OpenPlatformIdSchema, OpenStatusSchema, OpenFailureCodeSchema, OpenAllowedCallerSchema, OpenTargetUrlSourceSchema, OpenTraceFieldSourceSchema, OpenFailureInputParseDecisionSchema, OpenTimeoutDecisionSchema, OpenAbortDecisionSchema, OpenCircuitBreakerStateSchema, OpenIdempotencyDecisionSchema, OpenAlreadyOnTargetFreshnessDecisionSchema, OpenDataQualityFlagSchema, OpenTimeoutPolicySchema, OpenIdempotencyPolicySchema, OpenBoundaryPolicySchema, OpenProofPolicySchema, OpenOutputPolicySchema, OpenFailurePolicySchema, OpenFailureSchema, OpenTargetProfileSchema, OpenRequestSchema, BrowserSessionSnapshotSchema, NavigationResultSchema, OpenTargetPolicyDecisionSchema, OpenUrlSafetyDecisionSchema, OpenSessionDecisionSchema, OpenNavigationDecisionSchema, PostOpenStateDecisionSchema, OpenOutputSchema };

