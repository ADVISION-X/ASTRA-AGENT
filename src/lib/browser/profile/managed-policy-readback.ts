import { createHash } from "node:crypto";
import type { BrowserDedicatedProfilePolicy } from "./dedicated-profile-policy.js";

export type BrowserManagedPolicyReadback = Readonly<{
  policyHash: `sha256:${string}`;
  extensionId: string;
  verifiedAt: string;
}>;

export const attestManagedPolicyReadback = (policy: BrowserDedicatedProfilePolicy): BrowserManagedPolicyReadback => ({
  policyHash: `sha256:${createHash("sha256").update(JSON.stringify(policy)).digest("hex")}`,
  extensionId: policy.extensionId,
  verifiedAt: new Date().toISOString(),
});
