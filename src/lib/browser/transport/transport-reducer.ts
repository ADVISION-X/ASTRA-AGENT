import type { BrowserInfrastructureControlState } from "../infrastructure/browser-control-state.js";
import type { BrowserTransportEvent, BrowserTransportFence } from "./transport-event.js";

export type BrowserTransportReducerState = Readonly<{
  controlState: BrowserInfrastructureControlState;
  supervisorEpoch: number;
  processEpoch: number;
  currentFence: BrowserTransportFence | null;
  retryAttempt: number;
}>;

export const initialBrowserTransportReducerState = (): BrowserTransportReducerState => ({
  controlState: { kind: "OFFLINE" },
  supervisorEpoch: 0,
  processEpoch: 0,
  currentFence: null,
  retryAttempt: 0,
});

const sameConnection = (
  left: BrowserTransportFence | null,
  right: BrowserTransportFence,
): boolean => Boolean(
  left
  && left.supervisorEpoch === right.supervisorEpoch
  && left.controllerIncarnationHash === right.controllerIncarnationHash
  && left.connectionGeneration === right.connectionGeneration
  && left.sourceChannelToken === right.sourceChannelToken,
);

export const browserTransportFenceIsCurrent = (
  left: BrowserTransportFence | null,
  right: BrowserTransportFence,
): boolean => Boolean(
  sameConnection(left, right)
  && left!.hostProcessEpoch === right.hostProcessEpoch
  && left!.nativePortEpoch === right.nativePortEpoch,
);

export const reduceBrowserTransportEvent = (
  state: BrowserTransportReducerState,
  event: BrowserTransportEvent,
): BrowserTransportReducerState => {
  switch (event.type) {
    case "START":
      return {
        ...state,
        supervisorEpoch: event.supervisorEpoch,
        currentFence: null,
        retryAttempt: 0,
        controlState: { kind: "VERIFYING_INSTALL", attempt: 1 },
      };
    case "INSTALL_VERIFIED":
      if (event.supervisorEpoch !== state.supervisorEpoch) return state;
      return {
        ...state,
        controlState: { kind: "STARTING_CHROME", processEpoch: state.processEpoch + 1 },
      };
    case "CHROME_STARTED":
      if (event.supervisorEpoch !== state.supervisorEpoch) return state;
      return {
        ...state,
        processEpoch: event.processEpoch,
        controlState: { kind: "BINDING_OWNER", supervisorEpoch: state.supervisorEpoch },
      };
    case "OWNER_BOUND":
      if (event.supervisorEpoch !== state.supervisorEpoch) return state;
      return {
        ...state,
        controlState: { kind: "CONNECTING_HOST", connectionGeneration: 0 },
      };
    case "HOST_CONNECTED":
      if (event.fence.supervisorEpoch !== state.supervisorEpoch) return state;
      return {
        ...state,
        currentFence: event.fence,
        controlState: {
          kind: "CONNECTING_HOST",
          connectionGeneration: event.fence.connectionGeneration,
        },
      };
    case "HOST_AUTHENTICATED":
      if (!sameConnection(state.currentFence, event.fence)) return state;
      return {
        ...state,
        currentFence: event.fence,
        controlState: {
          kind: "AUTHENTICATING_TRANSPORT",
          nativePortEpoch: 0,
        },
      };
    case "WIRE_MESSAGE": {
      if (!sameConnection(state.currentFence, event.fence)) return state;
      if (event.message.type === "extension_hello") {
        if (state.currentFence!.hostProcessEpoch !== event.fence.hostProcessEpoch) return state;
        return {
          ...state,
          currentFence: event.fence,
          controlState: {
            kind: "AUTHENTICATING_TRANSPORT",
            nativePortEpoch: event.fence.nativePortEpoch,
          },
        };
      }
      if (!browserTransportFenceIsCurrent(state.currentFence, event.fence)) return state;
      if (event.message.type === "extension_authenticated") {
        return {
          ...state,
          controlState: {
            kind: "PROBING_CAPABILITIES",
            transcriptHash: "pending",
          },
        };
      }
      return state;
    }
    case "AUTH_PROOF_COMMITTED":
      if (!browserTransportFenceIsCurrent(state.currentFence, event.fence)) return state;
      return {
        ...state,
        retryAttempt: 0,
        controlState: {
          kind: "AUTHORITY_AVAILABLE",
          authorityRefHash: event.authorityRefHash,
          activationTupleHash: event.activationTupleHash,
        },
      };
    case "AUTHORITY_REVOKED":
      if (event.fence && !sameConnection(state.currentFence, event.fence)) return state;
      return {
        ...state,
        currentFence: null,
        controlState: { kind: "DRAINING", reason: event.reason },
      };
    case "LIVENESS_EXPIRED":
    case "HOST_DISCONNECTED":
      if (!sameConnection(state.currentFence, event.fence)) return state;
      return {
        ...state,
        currentFence: null,
        controlState: {
          kind: "DRAINING",
          reason: event.type === "LIVENESS_EXPIRED"
            ? "BROWSER_AUTHORITY_LIVENESS_EXPIRED"
            : event.reason,
        },
      };
    case "PROCESS_EXITED":
      if (
        event.supervisorEpoch !== state.supervisorEpoch
        || event.processEpoch !== state.processEpoch
      ) return state;
      return {
        ...state,
        currentFence: null,
        controlState: { kind: "DRAINING", reason: event.reason },
      };
    case "RETRY_SCHEDULED":
      return {
        ...state,
        retryAttempt: event.attempt,
        controlState: {
          kind: "BACKOFF",
          attempt: event.attempt,
          nextProbeAtMonotonicMs: event.nextProbeAtMonotonicMs,
        },
      };
    case "REPAIR_REQUIRED":
      return {
        ...state,
        currentFence: null,
        controlState: { kind: "REPAIR_REQUIRED", code: event.code },
      };
    case "DRAIN":
      return { ...state, controlState: { kind: "DRAINING", reason: event.reason } };
    case "STOP":
      return { ...state, currentFence: null, controlState: { kind: "STOPPING" } };
  }
};
