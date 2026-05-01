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

const OPEN_LOCAL_WORKBENCH_CHILD_ID = "open-local-workbench" as const;
const OPEN_LOCAL_WORKBENCH_PLATFORM_ID = "local-workbench" as const;
const OPEN_LOCAL_WORKBENCH_TARGET_KIND = "local-workbench" as const;
const OPEN_LOCAL_WORKBENCH_PURPOSE = "Open the local GrassEye workbench through the same governed Open runtime gates." as const;
const OPEN_LOCAL_WORKBENCH_ALLOWED_HOSTNAMES = ["localhost", "127.0.0.1"] as const;
const OPEN_LOCAL_WORKBENCH_ALLOWED_SCHEMES = ["http", "https"] as const;
const OPEN_LOCAL_WORKBENCH_REQUIRES_REAL_CHROME_SESSION = true as const;
const OPEN_LOCAL_WORKBENCH_PAGE_STATE_HANDOFF_REQUIRED = true as const;
const OPEN_LOCAL_WORKBENCH_BOUNDARY_POLICY = OpenBoundaryPolicySchema.parse({
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
const OPEN_LOCAL_WORKBENCH_PROOF_POLICY = OpenProofPolicySchema.parse({
  requireRuntimeProof: true,
  requireNegativeProof: true,
  allowFailureOutput: false,
  allowReviewOutput: false,
});
const OPEN_LOCAL_WORKBENCH_OUTPUT_POLICY = OpenOutputPolicySchema.parse({
  successRequiresPageStateHandoff: true,
  failureOutputMustBeNull: true,
  reviewOutputMustBeNull: true,
});
const OPEN_LOCAL_WORKBENCH_FAILURE_POLICY = OpenFailurePolicySchema.parse({
  dispatchFailureUsesEnvelopeOnly: true,
  fakeTargetProfileForbidden: true,
  fakeAllowDecisionForbidden: true,
});

type OpenLocalWorkbenchRequest = z.output<typeof OpenLocalWorkbenchRequestSchema>;
type OpenLocalWorkbenchResult = z.output<typeof OpenLocalWorkbenchResultSchema>;

export {
  OPEN_LOCAL_WORKBENCH_CHILD_ID,
  OPEN_LOCAL_WORKBENCH_PLATFORM_ID,
  OPEN_LOCAL_WORKBENCH_TARGET_KIND,
  OPEN_LOCAL_WORKBENCH_PURPOSE,
  OPEN_LOCAL_WORKBENCH_ALLOWED_HOSTNAMES,
  OPEN_LOCAL_WORKBENCH_ALLOWED_SCHEMES,
  OPEN_LOCAL_WORKBENCH_REQUIRES_REAL_CHROME_SESSION,
  OPEN_LOCAL_WORKBENCH_PAGE_STATE_HANDOFF_REQUIRED,
  OPEN_LOCAL_WORKBENCH_BOUNDARY_POLICY,
  OPEN_LOCAL_WORKBENCH_PROOF_POLICY,
  OPEN_LOCAL_WORKBENCH_OUTPUT_POLICY,
  OPEN_LOCAL_WORKBENCH_FAILURE_POLICY,
};

export type {
  OpenLocalWorkbenchRequest,
  OpenLocalWorkbenchResult,
};
