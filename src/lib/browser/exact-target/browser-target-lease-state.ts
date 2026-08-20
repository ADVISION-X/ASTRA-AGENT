import type {
  BrowserExecutionBinding,
  BrowserTargetLeaseState,
} from "../browser-authority-api.js";
import type { BrowserAuthorityCertificateV1 } from "../infrastructure/browser-authority-certificate.js";
import { hashBrowserExecutionBinding } from "../transport/command-permit.js";
import type { ControlledBrowserTarget } from "./browser-target-ref.js";

const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

import { createHash } from "node:crypto";

export const browserTargetLeaseHealth = (
  assertValid: () => void,
  leaseRef: string,
): { ok: boolean; detail: string } => {
  try {
    assertValid();
    return {
      ok: true,
      detail: `authenticated execution-bound target lease ${leaseRef}`,
    };
  } catch (error) {
    return {
      ok: false,
      detail:
        error instanceof Error ? error.message : "BROWSER_TARGET_LEASE_STALE",
    };
  }
};

export const browserTargetLeaseState = (input: {
  leaseRef: string;
  ownerId: string;
  certificate: BrowserAuthorityCertificateV1;
  executionBinding: BrowserExecutionBinding;
  target: ControlledBrowserTarget | null;
}): BrowserTargetLeaseState => ({
  leaseRef: input.leaseRef,
  ownerId: input.ownerId,
  authorityRefHash: hash(input.certificate.authorityRef),
  authorityEpoch: input.certificate.authorityEpoch,
  executionBindingHash: hashBrowserExecutionBinding(input.executionBinding),
  profileRef: input.certificate.profileEnrollmentHash,
  currentUrl: input.target?.url ?? "about:blank",
  currentTitle: input.target?.title ?? input.ownerId,
  lifecycle: input.target ? "ATTACHED" : "DETACHED",
});
