import { BROWSER_COMMAND_MAX_IN_FLIGHT } from "../protocol/generated/browser-protocol.generated.js";

export class BrowserCommandAdmissionBudget {
  private inFlight = 0;

  public enter(): void {
    if (this.inFlight >= BROWSER_COMMAND_MAX_IN_FLIGHT) {
      throw new Error("BROWSER_BACKPRESSURE");
    }
    this.inFlight += 1;
  }

  public leave(): void {
    this.inFlight = Math.max(0, this.inFlight - 1);
  }
}
