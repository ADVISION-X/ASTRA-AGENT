import type { BrowserControlState } from "../infrastructure/browser-control-state.js";
import { absentBrowserControlState } from "../infrastructure/browser-control-state.js";
import type { BrowserTransportEvent } from "./transport-event.js";

export const reduceBrowserTransport = (state: BrowserControlState, event: BrowserTransportEvent): BrowserControlState => {
  if (event.generation < state.infrastructure.epoch) return state;
  if (event.kind === "START_REQUESTED") {
    return { infrastructure: { kind: "AUTHENTICATING", epoch: event.generation }, authority: { kind: "ABSENT", reasonCode: "BROWSER_AUTH_TRANSCRIPT_INVALID" } };
  }
  if (event.kind === "AUTH_PROOF_COMMITTED") {
    return { infrastructure: { kind: "READY", epoch: event.generation }, authority: { kind: "PRESENT", authority: event.authority } };
  }
  if (event.kind === "REPAIR_REQUESTED") {
    return { infrastructure: { kind: "REPAIRING", epoch: event.generation, reasonCode: event.reasonCode }, authority: { kind: "ABSENT", reasonCode: event.reasonCode } };
  }
  return { ...absentBrowserControlState(event.kind === "DISCONNECTED" ? event.reasonCode : "BROWSER_LIVENESS_EXPIRED"), infrastructure: { kind: "BACKING_OFF", epoch: event.generation, retryAt: new Date().toISOString(), reasonCode: event.kind === "DISCONNECTED" ? event.reasonCode : "BROWSER_LIVENESS_EXPIRED" } };
};
