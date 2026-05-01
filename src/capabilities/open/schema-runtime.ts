import { z } from "zod";

import {
  BrowserLoginStateSchema,
  BrowserModeSchema,
  BrowserProfileStatusSchema,
  BrowserProfileVerificationStatusSchema,
  OpenAbortDecisionSchema,
  OpenAlreadyOnTargetFreshnessDecisionSchema,
  OpenCircuitBreakerStateSchema,
  OpenStatusSchema,
  OpenTargetUrlSourceSchema,
  OpenTimeoutDecisionSchema,
  nullableString,
  nullableUrl,
} from "./schema-base.js";
import {
  OPEN_NAVIGATION_DECISION_STATUSES,
  OPEN_SESSION_DECISION_STATUSES,
  OPEN_TARGET_POLICY_DECISION_STATUSES,
  OPEN_URL_SAFETY_DECISION_STATUSES,
} from "./shared/open-proof.js";
import { OPEN_POST_OPEN_CLASSIFICATIONS } from "./shared/open-target-profile.js";

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
  browserActionId: nullableString,
  ok: z.boolean(),
  message: z.string().min(1),
  createdAt: z.string().datetime(),
  openedUrl: nullableUrl,
  pageTitleAfter: nullableString,
  redirectChain: z.array(z.string().url()).default([]),
  portKind: z.string().min(1),
}).strict();

export const OpenTargetPolicyDecisionSchema = z.object({
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

export const OpenUrlSafetyDecisionSchema = z.object({
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

export const PostOpenStateDecisionSchema = z.object({
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

export const OpenOutputSchema = z.object({
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