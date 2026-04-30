import type { z } from "zod";

import type { OpenBrowserPort } from "./ports/open-browser-port.js";
import type { OpenClockPort } from "./ports/open-clock-port.js";
import type { OpenIdempotencyPort } from "./ports/open-idempotency-port.js";
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

export type OpenAbilityGroupId = typeof OPEN_ABILITY_GROUP_ID;
export type OpenChildCapabilityId = z.output<typeof OpenChildCapabilityIdSchema>;
export type OpenPlatformId = z.output<typeof OpenPlatformIdSchema>;
export type OpenTargetKind = z.output<typeof OpenTargetKindSchema>;
export type OpenStatus = z.output<typeof OpenStatusSchema>;
export type OpenFailure = z.output<typeof OpenFailureSchema>;
export type OpenTargetProfile = z.output<typeof OpenTargetProfileSchema>;
export type OpenAllowedCaller = z.output<typeof OpenAllowedCallerSchema>;
export type OpenBoundaryPolicy = z.output<typeof OpenBoundaryPolicySchema>;
export type OpenProofPolicy = z.output<typeof OpenProofPolicySchema>;
export type OpenOutputPolicy = z.output<typeof OpenOutputPolicySchema>;
export type OpenFailurePolicy = z.output<typeof OpenFailurePolicySchema>;
export type OpenTimeoutPolicy = z.output<typeof OpenTimeoutPolicySchema>;
export type OpenIdempotencyPolicy = z.output<typeof OpenIdempotencyPolicySchema>;
export type OpenDataQualityFlag = z.output<typeof OpenDataQualityFlagSchema>;
export type OpenTargetUrlSource = z.output<typeof OpenTargetUrlSourceSchema>;
export type BrowserSessionSnapshot = z.output<typeof BrowserSessionSnapshotSchema>;
export type OpenBrowserNavigationResult = z.output<typeof NavigationResultSchema>;
export type OpenTargetPolicyDecision = z.output<typeof OpenTargetPolicyDecisionSchema>;
export type OpenUrlSafetyDecision = z.output<typeof OpenUrlSafetyDecisionSchema>;
export type OpenSessionDecision = z.output<typeof OpenSessionDecisionSchema>;
export type OpenNavigationDecision = z.output<typeof OpenNavigationDecisionSchema>;
export type PostOpenStateDecision = z.output<typeof PostOpenStateDecisionSchema>;
export type OpenRequest = z.input<typeof OpenRequestSchema>;
export type ParsedOpenRequest = z.output<typeof OpenRequestSchema>;
export type OpenResult = z.output<typeof OpenResultSchema>;
export type OpenRuntimeProof = z.output<typeof OpenRuntimeProofSchema>;

export type CreateOpenAbilityGroupInput = {
  browser: OpenBrowserPort;
  clock?: OpenClockPort;
  idempotency?: OpenIdempotencyPort;
  profilePort?: OpenProfilePort;
};

export interface OpenAbilityGroup {
  listChildCapabilityIds(): OpenChildCapabilityId[];
  execute(input: OpenRequest): Promise<OpenResult>;
}