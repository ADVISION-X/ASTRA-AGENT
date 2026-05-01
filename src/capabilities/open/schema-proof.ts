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
  OpenNavigationDecisionSchema,
  OpenOutputSchema,
  OpenPlatformIdSchema,
  OpenSessionDecisionSchema,
  OpenStatusSchema,
  OpenTargetKindSchema,
  OpenTargetPolicyDecisionSchema,
  OpenTargetUrlSourceSchema,
  OpenTimeoutDecisionSchema,
  OpenTraceFieldSourceSchema,
  OpenUrlSafetyDecisionSchema,
  PostOpenStateDecisionSchema,
  nullableString,
  nullableUrl,
  nonNegativeInt,
} from "./schema-core.js";
import { OPEN_ABILITY_GROUP_ID, OPEN_POST_OPEN_CLASSIFICATIONS } from "./shared/open-target-profile.js";
import { OPEN_CLOCK_KIND } from "./shared/open-proof.js";

type OpenRuntimeProofValidationValue = {
  clock: {
    startedMonotonicMs: number;
    endedMonotonicMs: number;
  };
  status: z.infer<typeof OpenStatusSchema>;
  postOpenDecision: {
    status: z.infer<typeof PostOpenStateDecisionSchema>["status"];
  };
  outputRef: string | null;
  pageStateHandoffRequired: boolean;
  pageStateHandoffRef: string | null;
};

const openRuntimeProofIdentityShape = {
  proofId: z.string().min(1),
  runId: nullableString,
  missionId: nullableString,
  sessionId: nullableString,
  roundId: nullableString,
  videoVisitId: nullableString,
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
  loginStateBefore: BrowserLoginStateSchema,
  loginStateAfter: BrowserLoginStateSchema,
  pageTitleAfter: nullableString,
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

type OpenRuntimeProofBaseValue = z.output<typeof OpenRuntimeProofBaseSchema>;

const validateOpenRuntimeProofTiming = (value: OpenRuntimeProofValidationValue, context: z.RefinementCtx) => {
  if (value.clock.startedMonotonicMs > value.clock.endedMonotonicMs) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "startedMonotonicMs must not be after endedMonotonicMs",
      path: ["clock", "startedMonotonicMs"],
    });
  }
};

const validateOpenRuntimeProofStatus = (value: OpenRuntimeProofValidationValue, context: z.RefinementCtx) => {
  if (value.status !== value.postOpenDecision.status) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "proof status must equal postOpenDecision.status",
      path: ["postOpenDecision", "status"],
    });
  }
};

const validateOpenRuntimeProofOutput = (value: OpenRuntimeProofValidationValue, context: z.RefinementCtx) => {
  if (value.status === "success") {
    if (value.outputRef === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "success proof requires outputRef",
        path: ["outputRef"],
      });
    }
    if (!value.pageStateHandoffRequired || value.pageStateHandoffRef === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "success proof requires page-state handoff",
        path: ["pageStateHandoffRef"],
      });
    }
  }
  if (value.status !== "success" && value.outputRef !== null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "failed and review_required proof must not expose outputRef",
      path: ["outputRef"],
    });
  }
};

const validateOpenRuntimeProof = (value: OpenRuntimeProofBaseValue, context: z.RefinementCtx) => {
  const proof = value as OpenRuntimeProofValidationValue;
  validateOpenRuntimeProofTiming(proof, context);
  validateOpenRuntimeProofStatus(proof, context);
  validateOpenRuntimeProofOutput(proof, context);
};

export const OpenRuntimeProofSchema = OpenRuntimeProofBaseSchema.superRefine(validateOpenRuntimeProof);

export const OpenResultSchema = z.object({
  abilityGroupId: z.literal(OPEN_ABILITY_GROUP_ID),
  childCapabilityId: OpenChildCapabilityIdSchema.nullable().default(null),
  platformId: OpenPlatformIdSchema.nullable().default(null),
  targetKind: OpenTargetKindSchema.nullable().default(null),
  status: OpenStatusSchema,
  message: z.string().min(1),
  targetUrl: nullableUrl,
  openedUrl: nullableUrl,
  targetTitle: nullableString,
  pageTitleAfter: nullableString,
  pageStateHandoffRequired: z.boolean(),
  output: OpenOutputSchema.nullable().default(null),
  failureReason: OpenFailureSchema.nullable().default(null),
  reviewRequiredReason: nullableString,
  runtimeProof: OpenRuntimeProofSchema,
}).strict().superRefine((value, context) => {
  if (value.runtimeProof.status !== value.status) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "runtimeProof.status must equal result.status",
      path: ["runtimeProof", "status"],
    });
  }
  if (value.status === "success") {
    if (value.output === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "success result requires output",
        path: ["output"],
      });
    }
    if (!value.pageStateHandoffRequired) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "success result requires pageStateHandoffRequired=true",
        path: ["pageStateHandoffRequired"],
      });
    }
  }
  if (value.status !== "success" && value.output !== null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "failed and review_required result must not expose output",
      path: ["output"],
    });
  }
});
