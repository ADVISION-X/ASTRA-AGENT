import { z } from "zod";

import {
  BrowserLoginStateSchema,
  BrowserModeSchema,
  BrowserProfileVerificationStatusSchema,
  OpenAbortDecisionSchema,
  OpenChildCapabilityIdSchema,
  OpenCircuitBreakerStateSchema,
  OpenDataQualityFlagSchema,
  OpenFailureInputParseDecisionSchema,
  OpenFailureSchema,
  OpenIdempotencyDecisionSchema,
  nullableString,
  nullableUrl,
  nonNegativeInt,
  OpenPlatformIdSchema,
  OpenStatusSchema,
  OpenTargetKindSchema,
  OpenTargetUrlSourceSchema,
  OpenTimeoutDecisionSchema,
  OpenTraceFieldSourceSchema,
} from "./schema-base.js";
import {
  OpenNavigationDecisionSchema,
  OpenSessionDecisionSchema,
  OpenTargetPolicyDecisionSchema,
  OpenUrlSafetyDecisionSchema,
  PostOpenStateDecisionSchema,
} from "./schema-runtime.js";
import { OpenOutputSchema } from "./schema-runtime-output.js";
import { validateOpenResult, validateOpenRuntimeProof } from "./schema-proof-refinements.js";
import { OPEN_ABILITY_GROUP_ID, OPEN_POST_OPEN_CLASSIFICATIONS } from "./shared/open-target-profile.js";
import { OPEN_CLOCK_KIND } from "./shared/open-proof.js";

export const OPEN_SCHEMA_VALIDATION_MARKERS = [
  "parsed runtime proof requires browserSessionRef",
  "fallback_trace_only runtime proof requires receivedShapeHash",
  "success proof requires page-state handoff",
  "local program success proof requires windowHandoffRef",
  "local program success proof requires localAppStateHandoffRef",
  "failed and review_required proof must expose diagnosticPayloadRef",
  "failed and review_required result must expose diagnosticPayloadRef",
  "failed and review_required result must not expose output",
  "success result must not expose diagnosticPayloadRef",
  "startedMonotonicMs must not be after endedMonotonicMs",
] as const;

const openRuntimeProofIdentityShape = {
  proofId: z.string().min(1),
  runId: nullableString,
  missionId: nullableString,
  sessionId: nullableString,
  roundId: nullableString,
  videoVisitId: nullableString,
  stepId: nullableString,
  mapPackageId: nullableString,
  mapPackageVersion: nullableString,
  selectedMapId: nullableString,
  selectedMapVersion: nullableString,
  activationSnapshotRef: nullableString,
  capabilityCallId: nullableString,
  nerveBusEnvelopeId: nullableString,
  abilityGroupId: z.literal(OPEN_ABILITY_GROUP_ID),
  childCapabilityId: OpenChildCapabilityIdSchema.nullable().default(null),
  platformId: OpenPlatformIdSchema.nullable().default(null),
  targetKind: OpenTargetKindSchema.nullable().default(null),
  sourceAbilityGroupId: z.string().min(1),
  sourceChildCapabilityId: nullableString,
};

const openRuntimeProofSourceShape = {
  missionIdSource: OpenTraceFieldSourceSchema,
  runIdSource: OpenTraceFieldSourceSchema,
  sessionIdSource: OpenTraceFieldSourceSchema,
  childCapabilityIdSource: OpenTraceFieldSourceSchema,
  failureInputParseDecision: OpenFailureInputParseDecisionSchema,
  inputRef: z.string().min(1),
  outputRef: nullableString,
  diagnosticPayloadRef: nullableString,
  targetProfileRef: nullableString,
  targetUrl: nullableUrl,
  targetUrlSource: OpenTargetUrlSourceSchema,
  openedUrl: nullableUrl,
  redirectChain: z.array(z.string().url()).default([]),
  browserProfileRef: nullableString,
  browserMode: BrowserModeSchema,
  profileVerificationStatus: BrowserProfileVerificationStatusSchema,
  browserSessionRef: nullableString,
  loginStateBefore: BrowserLoginStateSchema,
  loginStateAfter: BrowserLoginStateSchema,
  pageTitleAfter: nullableString,
  localProgramOpenAttemptRef: nullableString,
  appLaunchAttemptRef: nullableString,
  appName: nullableString,
  bundleId: nullableString,
  appPath: nullableString,
  allowedLaunchMethod: z.literal("macos-open-application").nullable().default(null),
  windowHandoffRef: nullableString,
  localAppStateHandoffRef: nullableString,
  localProgramSnapshotAvailable: z.boolean().default(false),
  localProgramSnapshotFailureReason: nullableString,
};

const openRuntimeProofDecisionShape = {
  idempotencyKey: z.string().min(1),
  idempotencyDecision: OpenIdempotencyDecisionSchema,
  openAttemptRef: z.string().min(1),
  navigationCallId: z.string().min(1),
  navigationAttemptRef: z.string().min(1),
  timeoutDecision: OpenTimeoutDecisionSchema,
  abortDecision: OpenAbortDecisionSchema,
  circuitBreakerState: OpenCircuitBreakerStateSchema,
  targetPolicyDecision: OpenTargetPolicyDecisionSchema,
  urlSafetyDecision: OpenUrlSafetyDecisionSchema,
  sessionDecision: OpenSessionDecisionSchema,
  navigationDecision: OpenNavigationDecisionSchema,
  postOpenDecision: PostOpenStateDecisionSchema,
  preliminaryOpenClassification: z.enum(OPEN_POST_OPEN_CLASSIFICATIONS),
  pageStateHandoffRequired: z.boolean(),
  pageStateHandoffRef: nullableString,
  sourceRef: z.string().min(1),
  sessionSnapshotAvailable: z.boolean(),
  sessionSnapshotFailureReason: nullableString,
};

const openRuntimeProofClockShape = {
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: nonNegativeInt,
  status: OpenStatusSchema,
  failureReason: OpenFailureSchema.nullable().default(null),
  reviewRequiredReason: nullableString,
  dataQualityFlags: z.array(OpenDataQualityFlagSchema).default([]),
  receivedShapeHash: nullableString,
  clock: z.object({
    portKind: z.literal(OPEN_CLOCK_KIND),
    startedMonotonicMs: z.number().finite(),
    endedMonotonicMs: z.number().finite(),
  }).strict(),
};

const OpenRuntimeProofBaseSchema = z.object({
  ...openRuntimeProofIdentityShape,
  ...openRuntimeProofSourceShape,
  ...openRuntimeProofDecisionShape,
  ...openRuntimeProofClockShape,
}).strict();

export const OpenRuntimeProofSchema = OpenRuntimeProofBaseSchema.superRefine(validateOpenRuntimeProof);

const openResultShape = {
  abilityGroupId: z.literal(OPEN_ABILITY_GROUP_ID),
  childCapabilityId: OpenChildCapabilityIdSchema.nullable().default(null),
  platformId: OpenPlatformIdSchema.nullable().default(null),
  targetKind: OpenTargetKindSchema.nullable().default(null),
  status: OpenStatusSchema,
  missionId: nullableString,
  runId: nullableString,
  sessionId: nullableString,
  roundId: nullableString,
  videoVisitId: nullableString,
  stepId: nullableString,
  mapPackageId: nullableString,
  mapPackageVersion: nullableString,
  selectedMapId: nullableString,
  selectedMapVersion: nullableString,
  activationSnapshotRef: nullableString,
  capabilityCallId: nullableString,
  nerveBusEnvelopeId: nullableString,
  message: z.string().min(1),
  targetUrl: nullableUrl,
  openedUrl: nullableUrl,
  targetTitle: nullableString,
  pageTitleAfter: nullableString,
  pageStateHandoffRequired: z.boolean(),
  output: OpenOutputSchema.nullable().default(null),
  failureReason: OpenFailureSchema.nullable().default(null),
  reviewRequiredReason: nullableString,
  diagnosticPayloadRef: nullableString,
  dataQualityFlags: z.array(OpenDataQualityFlagSchema).default([]),
  runtimeProof: OpenRuntimeProofSchema,
} satisfies z.ZodRawShape;

export const OpenResultBaseSchema = z.object(openResultShape).strict();

export const OpenResultSchema = z.object(openResultShape).strict().superRefine(validateOpenResult);
