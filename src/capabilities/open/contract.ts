import type { z } from "zod";

import type { OpenBrowserPort } from "./ports/open-browser-port.js";
import type { OpenClockPort } from "./ports/open-clock-port.js";
import type { OpenIdempotencyPort } from "./ports/open-idempotency-port.js";
import type { OpenLocalProgramPort } from "./ports/open-local-program-port.js";
import type { OpenProfilePort } from "./ports/open-profile-port.js";
import {
  BrowserSessionSnapshotSchema,
  NavigationResultSchema,
  OpenAllowedCallerSchema,
  OpenBoundaryPolicySchema,
  OpenChildCapabilityIdSchema,
  OpenDataQualityFlagSchema,
  OpenFailureSchema,
  OpenFailurePolicySchema,
  OpenIdempotencyPolicySchema,
  OpenNavigationDecisionSchema,
  OpenOutputPolicySchema,
  OpenPlatformIdSchema,
  OpenProofPolicySchema,
  OpenRequestSchema,
  OpenResultSchema,
  OpenRuntimeProofSchema,
  OpenSessionDecisionSchema,
  OpenStatusSchema,
  OpenTargetKindSchema,
  OpenTargetPolicyDecisionSchema,
  OpenTargetProfileSchema,
  OpenTargetUrlSourceSchema,
  OpenTimeoutPolicySchema,
  OpenUrlSafetyDecisionSchema,
  PostOpenStateDecisionSchema,
} from "./schema.js";
import { DEFAULT_TIKTOK_URL, OPEN_ABILITY_GROUP_ID, TIKTOK_PLATFORM_ID } from "./shared/open-target-profile.js";

export { DEFAULT_TIKTOK_URL, OPEN_ABILITY_GROUP_ID, TIKTOK_PLATFORM_ID };

type OpenAbilityGroupId = typeof OPEN_ABILITY_GROUP_ID;
type OpenChildCapabilityId = z.output<typeof OpenChildCapabilityIdSchema>;
type OpenPlatformId = z.output<typeof OpenPlatformIdSchema>;
type OpenTargetKind = z.output<typeof OpenTargetKindSchema>;
type OpenStatus = z.output<typeof OpenStatusSchema>;
type OpenFailure = z.output<typeof OpenFailureSchema>;
type OpenTargetProfile = z.output<typeof OpenTargetProfileSchema>;
type OpenAllowedCaller = z.output<typeof OpenAllowedCallerSchema>;
type OpenBoundaryPolicy = z.output<typeof OpenBoundaryPolicySchema>;
type OpenProofPolicy = z.output<typeof OpenProofPolicySchema>;
type OpenOutputPolicy = z.output<typeof OpenOutputPolicySchema>;
type OpenFailurePolicy = z.output<typeof OpenFailurePolicySchema>;
type OpenTimeoutPolicy = z.output<typeof OpenTimeoutPolicySchema>;
type OpenIdempotencyPolicy = z.output<typeof OpenIdempotencyPolicySchema>;
type OpenDataQualityFlag = z.output<typeof OpenDataQualityFlagSchema>;
type OpenTargetUrlSource = z.output<typeof OpenTargetUrlSourceSchema>;
type BrowserSessionSnapshot = z.output<typeof BrowserSessionSnapshotSchema>;
type OpenBrowserNavigationResult = z.output<typeof NavigationResultSchema>;
type OpenTargetPolicyDecision = z.output<typeof OpenTargetPolicyDecisionSchema>;
type OpenUrlSafetyDecision = z.output<typeof OpenUrlSafetyDecisionSchema>;
type OpenSessionDecision = z.output<typeof OpenSessionDecisionSchema>;
type OpenNavigationDecision = z.output<typeof OpenNavigationDecisionSchema>;
type PostOpenStateDecision = z.output<typeof PostOpenStateDecisionSchema>;
type OpenRequest = z.input<typeof OpenRequestSchema>;
type ParsedOpenRequest = z.output<typeof OpenRequestSchema>;
type OpenResult = z.output<typeof OpenResultSchema>;
type OpenRuntimeProof = z.output<typeof OpenRuntimeProofSchema>;

export type CreateOpenAbilityGroupInput = {
  browser: OpenBrowserPort;
  localProgram?: OpenLocalProgramPort;
  clock?: OpenClockPort;
  idempotency?: OpenIdempotencyPort;
  profilePort?: OpenProfilePort;
};

export interface OpenAbilityGroup {
  listChildCapabilityIds(): OpenChildCapabilityId[];
  execute(input: OpenRequest): Promise<OpenResult>;
}

export type {
  OpenAbilityGroupId,
  OpenAllowedCaller,
  OpenBoundaryPolicy,
  OpenBrowserNavigationResult,
  OpenChildCapabilityId,
  OpenDataQualityFlag,
  OpenFailure,
  OpenFailurePolicy,
  OpenIdempotencyPolicy,
  OpenNavigationDecision,
  OpenOutputPolicy,
  OpenPlatformId,
  OpenProofPolicy,
  OpenRequest,
  OpenResult,
  OpenRuntimeProof,
  OpenSessionDecision,
  OpenStatus,
  OpenTargetKind,
  OpenTargetPolicyDecision,
  OpenTargetProfile,
  OpenTargetUrlSource,
  OpenTimeoutPolicy,
  OpenUrlSafetyDecision,
  ParsedOpenRequest,
  BrowserSessionSnapshot,
  PostOpenStateDecision,
};
