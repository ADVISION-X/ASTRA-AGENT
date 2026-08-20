import { BROWSER_COMMAND_MAX_IN_FLIGHT, BROWSER_COMMAND_MAX_QUEUED } from "../protocol/generated/browser-protocol.generated.js";

export class BrowserCommandAdmissionBudget {
  private inFlight = 0;
  private queued = 0;

  public enter(): void {
    if (this.queued >= BROWSER_COMMAND_MAX_QUEUED || this.inFlight >= BROWSER_COMMAND_MAX_IN_FLIGHT) {
      throw new Error("BROWSER_BACKPRESSURE");
    }
    this.queued += 1;
    this.inFlight += 1;
  }

  public leave(): void {
    this.inFlight = Math.max(0, this.inFlight - 1);
    this.queued = Math.max(0, this.queued - 1);
  }

  public snapshot(): Readonly<{ queued: number; inFlight: number }> {
    return { queued: this.queued, inFlight: this.inFlight };
  }
}
