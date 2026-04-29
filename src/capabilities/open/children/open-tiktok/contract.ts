import type { z } from "zod";

import {
	OpenBoundaryPolicySchema,
	OpenFailurePolicySchema,
	OpenOutputPolicySchema,
	OpenProofPolicySchema,
} from "../../schema.js";
import { OpenTikTokRequestSchema, OpenTikTokResultSchema } from "./schema.js";

export const OPEN_TIKTOK_CHILD_ID = "open-tiktok" as const;
export const OPEN_TIKTOK_PLATFORM_ID = "tiktok-web" as const;
export const OPEN_TIKTOK_TARGET_KIND = "platform-feed" as const;
export const OPEN_TIKTOK_PURPOSE = "Open the governed TikTok feed without bypassing Open runtime gates." as const;
export const OPEN_TIKTOK_ALLOWED_HOSTNAMES = ["tiktok.com", "www.tiktok.com"] as const;
export const OPEN_TIKTOK_ALLOWED_SCHEMES = ["https"] as const;
export const OPEN_TIKTOK_REQUIRES_REAL_CHROME_SESSION = true as const;
export const OPEN_TIKTOK_PAGE_STATE_HANDOFF_REQUIRED = true as const;
export const OPEN_TIKTOK_BOUNDARY_POLICY = OpenBoundaryPolicySchema.parse({
	allowedCaller: ["orchestration", "nerve-bus"],
	requiresNerveBus: true,
	requiresPageStateHandoff: true,
	deniesCookieRead: true,
	deniesDirectChildImport: true,
	deniesOtherCapabilityImports: [
		"ai",
		"screenshot",
		"mouse-click",
		"mouse-scroll",
		"geometry-guard",
		"forensics-persistence",
	],
});
export const OPEN_TIKTOK_PROOF_POLICY = OpenProofPolicySchema.parse({
	requireRuntimeProof: true,
	requireNegativeProof: true,
	allowFailureOutput: false,
	allowReviewOutput: false,
});
export const OPEN_TIKTOK_OUTPUT_POLICY = OpenOutputPolicySchema.parse({
	successRequiresPageStateHandoff: true,
	failureOutputMustBeNull: true,
	reviewOutputMustBeNull: true,
});
export const OPEN_TIKTOK_FAILURE_POLICY = OpenFailurePolicySchema.parse({
	dispatchFailureUsesEnvelopeOnly: true,
	fakeTargetProfileForbidden: true,
	fakeAllowDecisionForbidden: true,
});

export type OpenTikTokRequest = z.output<typeof OpenTikTokRequestSchema>;
export type OpenTikTokResult = z.output<typeof OpenTikTokResultSchema>;