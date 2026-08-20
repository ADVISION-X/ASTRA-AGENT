import type { BrowserAuthorityIssuer, BrowserAuthenticationProof } from "../infrastructure/browser-authority-issuer.js";
import type { BrowserControlState } from "../infrastructure/browser-control-state.js";
import { absentBrowserControlState } from "../infrastructure/browser-control-state.js";
import type { BrowserTransportEvent } from "./transport-event.js";
import { reduceBrowserTransport } from "./transport-reducer.js";

export class BrowserTransportActor {
  private state: BrowserControlState = absentBrowserControlState();
  private generation = 0;

  public constructor(private readonly issuer: BrowserAuthorityIssuer) {}

  public currentState(): BrowserControlState {
    return this.state;
  }

  public start(): void {
    this.dispatch({ kind: "START_REQUESTED", generation: ++this.generation });
  }

  public commitAuthentication(proof: BrowserAuthenticationProof): void {
    const authority = this.issuer.commitAuthenticationProof(proof);
    this.dispatch({ kind: "AUTH_PROOF_COMMITTED", generation: this.generation, authority });
  }

  public disconnect(reasonCode: string): void {
    this.issuer.revokeCurrent(reasonCode);
    this.dispatch({ kind: "DISCONNECTED", generation: this.generation, reasonCode });
  }

  public expireLiveness(): void {
    this.issuer.revokeCurrent("BROWSER_LIVENESS_EXPIRED");
    this.dispatch({ kind: "LIVENESS_EXPIRED", generation: this.generation });
  }

  private dispatch(event: BrowserTransportEvent): void {
    this.state = reduceBrowserTransport(this.state, event);
  }
}
