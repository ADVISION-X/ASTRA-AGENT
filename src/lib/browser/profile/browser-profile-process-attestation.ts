import { createHash } from "node:crypto";
import type { BrowserProfileState } from "./browser-profile-state.js";

export type BrowserProfileProcessAttestation = Readonly<{
  profileRef: string;
  processIncarnationHash: `sha256:${string}`;
  enrollmentHash: `sha256:${string}`;
  attestedAt: string;
}>;

export const attestBrowserProcess = (state: BrowserProfileState, processStartToken: string): BrowserProfileProcessAttestation => ({
  profileRef: state.profileRef,
  processIncarnationHash: `sha256:${createHash("sha256").update(`${state.profileRef}:${processStartToken}`).digest("hex")}`,
  enrollmentHash: state.enrollmentHash,
  attestedAt: new Date().toISOString(),
});
