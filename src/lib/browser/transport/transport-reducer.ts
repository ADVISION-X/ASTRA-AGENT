import type { BrowserInfrastructureControlState } from "../infrastructure/browser-control-state.js";
import type {
  BrowserTransportEvent,
  BrowserTransportFence,
} from "./transport-event.js";

export type BrowserTransportReducerState = Readonly<{
  controlState: BrowserInfrastructureControlState;
  supervisorEpoch: number;
  processEpoch: number;
  currentFence: BrowserTransportFence | null;
  retryAttempt: number;
}>;

export const initialBrowserTransportReducerState =
  (): BrowserTransportReducerState => ({
    controlState: { kind: "OFFLINE" },
    supervisorEpoch: 0,
    processEpoch: 0,
    currentFence: null,
    retryAttempt: 0,
  });

const sameConnection = (
  left: BrowserTransportFence | null,
  right: BrowserTransportFence,
): boolean =>
  Boolean(
    left &&
    left.supervisorEpoch === right.supervisorEpoch &&
    left.controllerIncarnationHash === right.controllerIncarnationHash &&
    left.connectionGeneration === right.connectionGeneration &&
    left.sourceChannelToken === right.sourceChannelToken,
  );

export const browserTransportFenceIsCurrent = (
  left: BrowserTransportFence | null,
  right: BrowserTransportFence,
): boolean =>
  Boolean(
    sameConnection(left, right) &&
    left!.hostProcessEpoch === right.hostProcessEpoch &&
    left!.nativePortEpoch === right.nativePortEpoch,
  );

type StartupEvent = Extract<
  BrowserTransportEvent,
  { type: "START" | "INSTALL_VERIFIED" | "CHROME_STARTED" | "OWNER_BOUND" }
>;
type ConnectionEvent = Extract<
  BrowserTransportEvent,
  { type: "HOST_CONNECTED" | "HOST_AUTHENTICATED" | "WIRE_MESSAGE" }
>;
type AuthorityEvent = Extract<
  BrowserTransportEvent,
  {
    type:
      | "AUTH_PROOF_COMMITTED"
      | "AUTHORITY_REVOKED"
      | "LIVENESS_EXPIRED"
      | "HOST_DISCONNECTED";
  }
>;
type LifecycleEvent = Extract<
  BrowserTransportEvent,
  {
    type:
      | "PROCESS_EXITED"
      | "RETRY_SCHEDULED"
      | "REPAIR_REQUIRED"
      | "DRAIN"
      | "STOP";
  }
>;

const STARTUP_EVENT_TYPES = new Set<StartupEvent["type"]>([
  "START",
  "INSTALL_VERIFIED",
  "CHROME_STARTED",
  "OWNER_BOUND",
]);
const CONNECTION_EVENT_TYPES = new Set<ConnectionEvent["type"]>([
  "HOST_CONNECTED",
  "HOST_AUTHENTICATED",
  "WIRE_MESSAGE",
]);
const AUTHORITY_EVENT_TYPES = new Set<AuthorityEvent["type"]>([
  "AUTH_PROOF_COMMITTED",
  "AUTHORITY_REVOKED",
  "LIVENESS_EXPIRED",
  "HOST_DISCONNECTED",
]);

const isStartupEvent = (event: BrowserTransportEvent): event is StartupEvent =>
  STARTUP_EVENT_TYPES.has(event.type as StartupEvent["type"]);
const isConnectionEvent = (
  event: BrowserTransportEvent,
): event is ConnectionEvent =>
  CONNECTION_EVENT_TYPES.has(event.type as ConnectionEvent["type"]);
const isAuthorityEvent = (
  event: BrowserTransportEvent,
): event is AuthorityEvent =>
  AUTHORITY_EVENT_TYPES.has(event.type as AuthorityEvent["type"]);

const reduceStartupEvent = (
  state: BrowserTransportReducerState,
  event: StartupEvent,
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
        controlState: {
          kind: "STARTING_CHROME",
          processEpoch: state.processEpoch + 1,
        },
      };
    case "CHROME_STARTED":
      if (event.supervisorEpoch !== state.supervisorEpoch) return state;
      return {
        ...state,
        processEpoch: event.processEpoch,
        controlState: {
          kind: "BINDING_OWNER",
          supervisorEpoch: state.supervisorEpoch,
        },
      };
    case "OWNER_BOUND":
      if (event.supervisorEpoch !== state.supervisorEpoch) return state;
      return {
        ...state,
        controlState: { kind: "CONNECTING_HOST", connectionGeneration: 0 },
      };
  }
};

type WireMessageEvent = Extract<ConnectionEvent, { type: "WIRE_MESSAGE" }>;

const reduceWireMessage = (
  state: BrowserTransportReducerState,
  event: WireMessageEvent,
): BrowserTransportReducerState => {
  if (!sameConnection(state.currentFence, event.fence)) return state;
  if (event.message.type === "extension_hello") {
    if (state.currentFence!.hostProcessEpoch !== event.fence.hostProcessEpoch)
      return state;
    return {
      ...state,
      currentFence: event.fence,
      controlState: {
        kind: "AUTHENTICATING_TRANSPORT",
        nativePortEpoch: event.fence.nativePortEpoch,
      },
    };
  }
  if (!browserTransportFenceIsCurrent(state.currentFence, event.fence))
    return state;
  if (event.message.type !== "extension_authenticated") return state;
  return {
    ...state,
    controlState: {
      kind: "PROBING_CAPABILITIES",
      transcriptHash: "pending",
    },
  };
};

const reduceConnectionEvent = (
  state: BrowserTransportReducerState,
  event: ConnectionEvent,
): BrowserTransportReducerState => {
  switch (event.type) {
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
    case "WIRE_MESSAGE":
      return reduceWireMessage(state, event);
  }
};

const reduceAuthorityEvent = (
  state: BrowserTransportReducerState,
  event: AuthorityEvent,
): BrowserTransportReducerState => {
  switch (event.type) {
    case "AUTH_PROOF_COMMITTED":
      if (!browserTransportFenceIsCurrent(state.currentFence, event.fence))
        return state;
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
      if (event.fence && !sameConnection(state.currentFence, event.fence))
        return state;
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
          reason:
            event.type === "LIVENESS_EXPIRED"
              ? "BROWSER_AUTHORITY_LIVENESS_EXPIRED"
              : event.reason,
        },
      };
  }
};

const reduceLifecycleEvent = (
  state: BrowserTransportReducerState,
  event: LifecycleEvent,
): BrowserTransportReducerState => {
  switch (event.type) {
    case "PROCESS_EXITED":
      if (
        event.supervisorEpoch !== state.supervisorEpoch ||
        event.processEpoch !== state.processEpoch
      )
        return state;
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
      return {
        ...state,
        controlState: { kind: "DRAINING", reason: event.reason },
      };
    case "STOP":
      return {
        ...state,
        currentFence: null,
        controlState: { kind: "STOPPING" },
      };
  }
};

export const reduceBrowserTransportEvent = (
  state: BrowserTransportReducerState,
  event: BrowserTransportEvent,
): BrowserTransportReducerState => {
  if (isStartupEvent(event)) return reduceStartupEvent(state, event);
  if (isConnectionEvent(event)) return reduceConnectionEvent(state, event);
  if (isAuthorityEvent(event)) return reduceAuthorityEvent(state, event);
  return reduceLifecycleEvent(state, event);
};
