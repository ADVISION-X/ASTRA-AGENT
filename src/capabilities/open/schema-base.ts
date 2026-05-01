import { z } from "zod";

import {
  BrowserLoginStateSchema,
  BrowserModeSchema,
  BrowserProfileStatusSchema,
  BrowserProfileVerificationStatusSchema,
} from "../../types/local-browser-session.js";
import { OPEN_FAILURE_CODES } from "./shared/open-failure.js";
import { OPEN_RESULT_STATUSES } from "./shared/open-result.js";
import {
  OPEN_ALLOWED_CALLERS,
  OPEN_CHILD_CAPABILITY_IDS,
  OPEN_PLATFORM_IDS,
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

const OpenFailureSchema = z.object({
  code: OpenFailureCodeSchema,
  message: z.string().min(1),
  detail: nullableString,
}).strict();

export {
  BrowserLoginStateSchema,
  BrowserModeSchema,
  BrowserProfileStatusSchema,
  BrowserProfileVerificationStatusSchema,
  nullableString,
  nullableUrl,
  nonNegativeInt,
  OpenChildCapabilityIdSchema,
  OpenTargetKindSchema,
  OpenPlatformIdSchema,
  OpenStatusSchema,
  OpenFailureCodeSchema,
  OpenAllowedCallerSchema,
  OpenTargetUrlSourceSchema,
  OpenTraceFieldSourceSchema,
  OpenFailureInputParseDecisionSchema,
  OpenTimeoutDecisionSchema,
  OpenAbortDecisionSchema,
  OpenCircuitBreakerStateSchema,
  OpenIdempotencyDecisionSchema,
  OpenAlreadyOnTargetFreshnessDecisionSchema,
  OpenDataQualityFlagSchema,
  OpenFailureSchema,
};