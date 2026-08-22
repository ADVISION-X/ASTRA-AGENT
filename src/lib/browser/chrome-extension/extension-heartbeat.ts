import { BROWSER_HEARTBEAT_MS } from "../protocol/generated/browser-protocol.generated.js";
import type { ExtensionChromeApi } from "./extension-runtime-types.js";

export class ExtensionHeartbeat {
  private timer: ReturnType<typeof globalThis.setInterval> | null = null;

  public constructor(
    private readonly chromeApi: ExtensionChromeApi,
    private readonly send: (socket: WebSocket) => Promise<void>,
    private readonly reportFailure: (error: unknown) => void,
  ) {}

  public startHeartbeat(socket: WebSocket): void {
    this.stop();
    void this.sendLivenessPulse(socket);
    this.timer = globalThis.setInterval(() => {
      void this.sendLivenessPulse(socket);
    }, BROWSER_HEARTBEAT_MS);
  }

  public stop(): void {
    if (this.timer !== null) globalThis.clearInterval(this.timer);
    this.timer = null;
  }

  private async sendLivenessPulse(socket: WebSocket): Promise<void> {
    try {
      await this.chromeApi.runtime.getPlatformInfo();
      await this.send(socket);
    } catch (error) {
      this.reportFailure(error);
    }
  }
}
