import type { BrowserInfrastructureErrorCode } from "../infrastructure/browser-control-state.js";
import type { BrowserWireMessage } from "../protocol/generated/browser-protocol.js";

export type BrowserTransportFence = Readonly<{
  supervisorEpoch: number;
  controllerIncarnationHash: `sha256:${string}`;
  connectionGeneration: number;
  hostProcessEpoch: number;
  nativePortEpoch: number;
  sourceChannelToken: string;
}>;

export type BrowserTransportEvent =
  | Readonly<{ type: "START"; supervisorEpoch: number }>
  | Readonly<{ type: "INSTALL_VERIFIED"; supervisorEpoch: number }>
  | Readonly<{
      type: "CHROME_STARTED";
      supervisorEpoch: number;
      processEpoch: number;
    }>
  | Readonly<{ type: "OWNER_BOUND"; supervisorEpoch: number }>
  | Readonly<{
      type: "HOST_CONNECTED";
      fence: Omit<BrowserTransportFence, "nativePortEpoch"> & {
        nativePortEpoch: 0;
      };
    }>
  | Readonly<{ type: "HOST_AUTHENTICATED"; fence: BrowserTransportFence }>
  | Readonly<{
      type: "WIRE_MESSAGE";
      fence: BrowserTransportFence;
      message: BrowserWireMessage;
    }>
  | Readonly<{
      type: "AUTH_PROOF_COMMITTED";
      fence: BrowserTransportFence;
      authorityRefHash: `sha256:${string}`;
      activationTupleHash: `sha256:${string}`;
    }>
  | Readonly<{
      type: "AUTHORITY_REVOKED";
      fence?: BrowserTransportFence;
      reason: string;
    }>
  | Readonly<{ type: "LIVENESS_EXPIRED"; fence: BrowserTransportFence }>
  | Readonly<{
      type: "HOST_DISCONNECTED";
      fence: BrowserTransportFence;
      reason: string;
    }>
  | Readonly<{
      type: "PROCESS_EXITED";
      supervisorEpoch: number;
      processEpoch: number;
      reason: string;
    }>
  | Readonly<{
      type: "RETRY_SCHEDULED";
      attempt: number;
      nextProbeAtMonotonicMs: number;
    }>
  | Readonly<{ type: "REPAIR_REQUIRED"; code: BrowserInfrastructureErrorCode }>
  | Readonly<{ type: "DRAIN"; reason: string }>
  | Readonly<{ type: "STOP" }>;
