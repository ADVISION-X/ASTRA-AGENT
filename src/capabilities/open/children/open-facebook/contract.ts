import type { z } from "zod";

import {
	OpenBoundaryPolicySchema,
	OpenFailurePolicySchema,
	OpenOutputPolicySchema,
	OpenProofPolicySchema,
} from "../../schema.js";
import { OpenFacebookRequestSchema, OpenFacebookResultSchema } from "./schema.js";

export const OPEN_FACEBOOK_CHILD_ID = "open-facebook" as const;
export const OPEN_FACEBOOK_PLATFORM_ID = "facebook-web" as const;
export const OPEN_FACEBOOK_TARGET_KIND = "platform-feed" as const;
export const OPEN_FACEBOOK_PURPOSE = "Open the governed Facebook Reels feed without bypassing Open runtime gates." as const;
export const OPEN_FACEBOOK_ALLOWED_HOSTNAMES = ["facebook.com", "www.facebook.com", "m.facebook.com"] as const;
export const OPEN_FACEBOOK_ALLOWED_SCHEMES = ["https"] as const;
export const OPEN_FACEBOOK_REQUIRES_REAL_CHROME_SESSION = true as const;
export const OPEN_FACEBOOK_PAGE_STATE_HANDOFF_REQUIRED = true as const;
export const OPEN_FACEBOOK_BOUNDARY_POLICY = OpenBoundaryPolicySchema.parse({
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
export const OPEN_FACEBOOK_PROOF_POLICY = OpenProofPolicySchema.parse({
	requireRuntimeProof: true,
	requireNegativeProof: true,
	allowFailureOutput: false,
	allowReviewOutput: false,
});
export const OPEN_FACEBOOK_OUTPUT_POLICY = OpenOutputPolicySchema.parse({
	successRequiresPageStateHandoff: true,
	failureOutputMustBeNull: true,
	reviewOutputMustBeNull: true,
});
export const OPEN_FACEBOOK_FAILURE_POLICY = OpenFailurePolicySchema.parse({
	dispatchFailureUsesEnvelopeOnly: true,
	fakeTargetProfileForbidden: true,
	fakeAllowDecisionForbidden: true,
});

export type OpenFacebookRequest = z.output<typeof OpenFacebookRequestSchema>;
export type OpenFacebookResult = z.output<typeof OpenFacebookResultSchema>;