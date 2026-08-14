import type { BrowserController, BrowserTargetSession } from "./browser-controller.js";
import type { RuntimeLogger } from "../runtime-logs/index.js";
import {
  createCurrentChromeBrowserControllerRuntime,
  type CurrentChromeBrowserControllerOptions,
} from "./current-chrome-browser-controller-runtime.js";

export class CurrentChromeBrowserController implements BrowserController {
  private readonly runtime: BrowserController;

  constructor(options: CurrentChromeBrowserControllerOptions, runtimeLogger?: RuntimeLogger) {
    this.runtime = createCurrentChromeBrowserControllerRuntime(options, runtimeLogger);
  }

  getHealth() { return this.runtime.getHealth(); }
  setExecutionAbortSignal(signal: AbortSignal | null) { this.runtime.setExecutionAbortSignal?.(signal); }
  getSessionState() { return this.runtime.getSessionState(); }
  createTargetSession(ownerId: string): BrowserTargetSession {
    return this.runtime.createTargetSession(ownerId);
  }
  close() { return this.runtime.close(); }
}
