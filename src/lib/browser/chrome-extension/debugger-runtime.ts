import type { ExtensionChromeApi, ExtensionDebuggee } from "./extension-runtime-types.js";

/** Narrow adapter: DevTools methods are selected by the fixed command registry, never by business input. */
export class ExtensionDebuggerRuntime {
  private readonly attached = new Set<number>();

  public constructor(private readonly chromeApi: ExtensionChromeApi) {}

  public async attach(tabId: number): Promise<void> {
    if (this.attached.has(tabId)) return;
    await this.chromeApi.debugger.attach({ tabId }, "1.3");
    this.attached.add(tabId);
  }

  public async detach(tabId: number): Promise<void> {
    if (!this.attached.delete(tabId)) return;
    await this.chromeApi.debugger.detach({ tabId }).catch(() => undefined);
  }

  public async send(tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>): Promise<unknown> {
    if (!this.attached.has(tabId)) throw new Error("BROWSER_DEVTOOLS_CONFLICT");
    return this.chromeApi.debugger.sendCommand(target(tabId), method, parameters);
  }

  public isAttached(tabId: number): boolean {
    return this.attached.has(tabId);
  }
}

const target = (tabId: number): ExtensionDebuggee => ({ tabId });
