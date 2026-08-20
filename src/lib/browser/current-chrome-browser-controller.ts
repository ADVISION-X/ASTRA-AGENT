import type {
  BrowserController,
  BrowserTargetSession,
} from "./browser-controller.js";
import type { BrowserAuthoritySnapshot } from "./authority/browser-authority-certificate.js";
import type { RuntimeLogger } from "../runtime-logs/index.js";
import {
  createCurrentChromeBrowserControllerRuntime,
  type CurrentChromeBrowserControllerOptions,
} from "./current-chrome-browser-controller-runtime.js";

export class CurrentChromeBrowserController implements BrowserController {
  private constructor(private readonly runtime: BrowserController) {}

  static async create(
    options: CurrentChromeBrowserControllerOptions,
    runtimeLogger?: RuntimeLogger,
  ): Promise<CurrentChromeBrowserController> {
    return new CurrentChromeBrowserController(
      await createCurrentChromeBrowserControllerRuntime(options, runtimeLogger),
    );
  }

  getHealth() {
    return this.runtime.getHealth();
  }

  getAuthoritySnapshot(): BrowserAuthoritySnapshot {
    return this.runtime.getAuthoritySnapshot();
  }

  setExecutionAbortSignal(signal: AbortSignal | null) {
    this.runtime.setExecutionAbortSignal?.(signal);
  }

  createTargetSession(ownerId: string): BrowserTargetSession {
    return this.runtime.createTargetSession(ownerId);
  }

  close() {
    return this.runtime.close();
  }
}
