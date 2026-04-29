import type { z } from "zod";

import {
  OpenBoundaryPolicySchema,
  OpenFailurePolicySchema,
  OpenOutputPolicySchema,
  OpenProofPolicySchema,
} from "../../schema.js";
import {
  OpenLocalWorkbenchRequestSchema,
  OpenLocalWorkbenchResultSchema,
} from "./schema.js";

export const OPEN_LOCAL_WORKBENCH_CHILD_ID = "open-local-workbench" as const;
export const OPEN_LOCAL_WORKBENCH_PLATFORM_ID = "local-workbench" as const;
export const OPEN_LOCAL_WORKBENCH_TARGET_KIND = "local-workbench" as const;
export const OPEN_LOCAL_WORKBENCH_PURPOSE = "Open the local GrassEye workbench through the same governed Open runtime gates." as const;
export const OPEN_LOCAL_WORKBENCH_ALLOWED_HOSTNAMES = ["localhost", "127.0.0.1"] as const;
export const OPEN_LOCAL_WORKBENCH_ALLOWED_SCHEMES = ["http", "https"] as const;
export const OPEN_LOCAL_WORKBENCH_REQUIRES_REAL_CHROME_SESSION = true as const;
export const OPEN_LOCAL_WORKBENCH_PAGE_STATE_HANDOFF_REQUIRED = true as const;
export const OPEN_LOCAL_WORKBENCH_BOUNDARY_POLICY = OpenBoundaryPolicySchema.parse({
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
export const OPEN_LOCAL_WORKBENCH_PROOF_POLICY = OpenProofPolicySchema.parse({
  requireRuntimeProof: true,
  requireNegativeProof: true,
  allowFailureOutput: false,
  allowReviewOutput: false,
});
export const OPEN_LOCAL_WORKBENCH_OUTPUT_POLICY = OpenOutputPolicySchema.parse({
  successRequiresPageStateHandoff: true,
  failureOutputMustBeNull: true,
  reviewOutputMustBeNull: true,
});
export const OPEN_LOCAL_WORKBENCH_FAILURE_POLICY = OpenFailurePolicySchema.parse({
  dispatchFailureUsesEnvelopeOnly: true,
  fakeTargetProfileForbidden: true,
  fakeAllowDecisionForbidden: true,
});

export type OpenLocalWorkbenchRequest = z.output<typeof OpenLocalWorkbenchRequestSchema>;
export type OpenLocalWorkbenchResult = z.output<typeof OpenLocalWorkbenchResultSchema>;