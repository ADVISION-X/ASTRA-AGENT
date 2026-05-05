import type { z } from "zod";

import {
  OpenBoundaryPolicySchema,
  OpenFailurePolicySchema,
  OpenOutputPolicySchema,
  OpenProofPolicySchema,
} from "../../schema.js";
import {
  OpenLocalProgramRequestSchema,
  OpenLocalProgramResultSchema,
} from "./schema.js";

const OPEN_LOCAL_PROGRAM_CHILD_ID = "open-local-program" as const;
const OPEN_LOCAL_PROGRAM_PLATFORM_ID = "macos-local" as const;
const OPEN_LOCAL_PROGRAM_TARGET_KIND = "local-program" as const;
const OPEN_LOCAL_PROGRAM_TARGET_PROFILE_REF = "macos-app:iphone-mirroring" as const;
const OPEN_LOCAL_PROGRAM_APP_NAME = "iPhone Mirroring" as const;
const OPEN_LOCAL_PROGRAM_BUNDLE_ID = "com.apple.ScreenContinuity" as const;
const OPEN_LOCAL_PROGRAM_APP_PATH = null;
const OPEN_LOCAL_PROGRAM_ALLOWED_LAUNCH_METHOD = "macos-open-application" as const;
const OPEN_LOCAL_PROGRAM_PURPOSE = "Open a governed macOS local program and hand off its visible window to the visual/runtime state chain." as const;
const OPEN_LOCAL_PROGRAM_REQUIRES_REAL_CHROME_SESSION = false as const;
const OPEN_LOCAL_PROGRAM_PAGE_STATE_HANDOFF_REQUIRED = true as const;
const OPEN_LOCAL_PROGRAM_LOCAL_APP_STATE_HANDOFF_REQUIRED = true as const;
const OPEN_LOCAL_PROGRAM_BOUNDARY_POLICY = OpenBoundaryPolicySchema.parse({
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
const OPEN_LOCAL_PROGRAM_PROOF_POLICY = OpenProofPolicySchema.parse({
  requireRuntimeProof: true,
  requireNegativeProof: true,
  allowFailureOutput: false,
  allowReviewOutput: false,
});
const OPEN_LOCAL_PROGRAM_OUTPUT_POLICY = OpenOutputPolicySchema.parse({
  successRequiresPageStateHandoff: true,
  failureOutputMustBeNull: true,
  reviewOutputMustBeNull: true,
});
const OPEN_LOCAL_PROGRAM_FAILURE_POLICY = OpenFailurePolicySchema.parse({
  dispatchFailureUsesEnvelopeOnly: true,
  fakeTargetProfileForbidden: true,
  fakeAllowDecisionForbidden: true,
});

type OpenLocalProgramRequest = z.output<typeof OpenLocalProgramRequestSchema>;
type OpenLocalProgramResult = z.output<typeof OpenLocalProgramResultSchema>;

export {
  OPEN_LOCAL_PROGRAM_CHILD_ID,
  OPEN_LOCAL_PROGRAM_PLATFORM_ID,
  OPEN_LOCAL_PROGRAM_TARGET_KIND,
  OPEN_LOCAL_PROGRAM_TARGET_PROFILE_REF,
  OPEN_LOCAL_PROGRAM_APP_NAME,
  OPEN_LOCAL_PROGRAM_BUNDLE_ID,
  OPEN_LOCAL_PROGRAM_APP_PATH,
  OPEN_LOCAL_PROGRAM_ALLOWED_LAUNCH_METHOD,
  OPEN_LOCAL_PROGRAM_PURPOSE,
  OPEN_LOCAL_PROGRAM_REQUIRES_REAL_CHROME_SESSION,
  OPEN_LOCAL_PROGRAM_PAGE_STATE_HANDOFF_REQUIRED,
  OPEN_LOCAL_PROGRAM_LOCAL_APP_STATE_HANDOFF_REQUIRED,
  OPEN_LOCAL_PROGRAM_BOUNDARY_POLICY,
  OPEN_LOCAL_PROGRAM_PROOF_POLICY,
  OPEN_LOCAL_PROGRAM_OUTPUT_POLICY,
  OPEN_LOCAL_PROGRAM_FAILURE_POLICY,
};

export type {
  OpenLocalProgramRequest,
  OpenLocalProgramResult,
};
