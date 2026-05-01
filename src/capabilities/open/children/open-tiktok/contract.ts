import type { z } from "zod";

import {
	OpenBoundaryPolicySchema,
	OpenFailurePolicySchema,
	OpenOutputPolicySchema,
	OpenProofPolicySchema,
} from "../../schema.js";
import { OpenTikTokRequestSchema, OpenTikTokResultSchema } from "./schema.js";

const OPEN_TIKTOK_CHILD_ID = "open-tiktok" as const;
const OPEN_TIKTOK_PLATFORM_ID = "tiktok-web" as const;
const OPEN_TIKTOK_TARGET_KIND = "platform-feed" as const;
const OPEN_TIKTOK_PURPOSE = "Open the governed TikTok feed without bypassing Open runtime gates." as const;
const OPEN_TIKTOK_ALLOWED_HOSTNAMES = ["tiktok.com", "www.tiktok.com"] as const;
const OPEN_TIKTOK_ALLOWED_SCHEMES = ["https"] as const;
const OPEN_TIKTOK_REQUIRES_REAL_CHROME_SESSION = true as const;
const OPEN_TIKTOK_PAGE_STATE_HANDOFF_REQUIRED = true as const;
const OPEN_TIKTOK_BOUNDARY_POLICY = OpenBoundaryPolicySchema.parse({
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
const OPEN_TIKTOK_PROOF_POLICY = OpenProofPolicySchema.parse({
	requireRuntimeProof: true,
	requireNegativeProof: true,
	allowFailureOutput: false,
	allowReviewOutput: false,
});
const OPEN_TIKTOK_OUTPUT_POLICY = OpenOutputPolicySchema.parse({
	successRequiresPageStateHandoff: true,
	failureOutputMustBeNull: true,
	reviewOutputMustBeNull: true,
});
const OPEN_TIKTOK_FAILURE_POLICY = OpenFailurePolicySchema.parse({
	dispatchFailureUsesEnvelopeOnly: true,
	fakeTargetProfileForbidden: true,
	fakeAllowDecisionForbidden: true,
});

type OpenTikTokRequest = z.output<typeof OpenTikTokRequestSchema>;
type OpenTikTokResult = z.output<typeof OpenTikTokResultSchema>;

export {
  OPEN_TIKTOK_CHILD_ID,
  OPEN_TIKTOK_PLATFORM_ID,
  OPEN_TIKTOK_TARGET_KIND,
  OPEN_TIKTOK_PURPOSE,
  OPEN_TIKTOK_ALLOWED_HOSTNAMES,
  OPEN_TIKTOK_ALLOWED_SCHEMES,
  OPEN_TIKTOK_REQUIRES_REAL_CHROME_SESSION,
  OPEN_TIKTOK_PAGE_STATE_HANDOFF_REQUIRED,
  OPEN_TIKTOK_BOUNDARY_POLICY,
  OPEN_TIKTOK_PROOF_POLICY,
  OPEN_TIKTOK_OUTPUT_POLICY,
  OPEN_TIKTOK_FAILURE_POLICY,
};

export type {
  OpenTikTokRequest,
  OpenTikTokResult,
};
