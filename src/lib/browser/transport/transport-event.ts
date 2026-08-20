import type { BrowserAuthorityCertificateV1 } from "../infrastructure/browser-authority-certificate.js";

export type BrowserTransportEvent =
  | Readonly<{ kind: "START_REQUESTED"; generation: number }>
  | Readonly<{ kind: "AUTH_PROOF_COMMITTED"; generation: number; authority: BrowserAuthorityCertificateV1 }>
  | Readonly<{ kind: "DISCONNECTED"; generation: number; reasonCode: string }>
  | Readonly<{ kind: "LIVENESS_EXPIRED"; generation: number }>
  | Readonly<{ kind: "REPAIR_REQUESTED"; generation: number; reasonCode: string }>;
