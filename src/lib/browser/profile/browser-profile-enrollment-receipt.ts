import type { BrowserProfileState } from "./browser-profile-state.js";

export type BrowserProfileEnrollmentReceipt = Readonly<{
  profileRef: string;
  enrollmentHash: `sha256:${string}`;
  issuedAt: string;
}>;

export const createProfileEnrollmentReceipt = (state: BrowserProfileState): BrowserProfileEnrollmentReceipt => ({
  profileRef: state.profileRef,
  enrollmentHash: state.enrollmentHash,
  issuedAt: new Date().toISOString(),
});
