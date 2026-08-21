import type { BrowserAuthorityCertificateV1 } from "./browser-authority-certificate.js";

export type BrowserInfrastructureControlState =
  | Readonly<{ kind: "STOPPED"; epoch: number }>
  | Readonly<{ kind: "STARTING"; epoch: number }>
  | Readonly<{ kind: "AUTHENTICATING"; epoch: number }>
  | Readonly<{ kind: "REPAIRING"; epoch: number; reasonCode: string }>
  | Readonly<{ kind: "BACKING_OFF"; epoch: number; retryAt: string; reasonCode: string }>
  | Readonly<{ kind: "READY"; epoch: number }>;

export type BrowserAuthoritySlot =
  | Readonly<{ kind: "ABSENT"; reasonCode: string }>
  | Readonly<{ kind: "PRESENT"; authority: BrowserAuthorityCertificateV1 }>;

export type BrowserControlState = Readonly<{
  infrastructure: BrowserInfrastructureControlState;
  authority: BrowserAuthoritySlot;
}>;

export const absentBrowserControlState = (reasonCode = "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE"): BrowserControlState => ({
  infrastructure: { kind: "STOPPED", epoch: 0 },
  authority: { kind: "ABSENT", reasonCode },
});
