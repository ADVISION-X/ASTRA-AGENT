import type {
  ExtensionChromeApi,
  ExtensionDebuggee,
  ExtensionDebugTarget,
  ExtensionTab,
} from "./extension-runtime-types.js";

const PAGE_ACTION_READ_SETTLEMENT_MS = 2500;

const PAGE_MUTATION_METHODS = new Set([
  "DOM.focus",
  "DOM.setFileInputFiles",
  "Input.dispatchKeyEvent",
  "Input.dispatchMouseEvent",
  "Input.insertText",
  "Page.navigate",
]);

const PAGE_READ_METHODS = new Set([
  "DOM.describeNode",
  "DOM.getDocument",
  "DOM.getOuterHTML",
  "DOM.querySelectorAll",
  "DOM.requestNode",
  "DOM.resolveNode",
  "Page.getFrameTree",
  "Page.getNavigationHistory",
  "Runtime.callFunctionOn",
  "Runtime.evaluate",
]);

const DEVTOOLS_CONTROL_METHODS = new Set([
  "Page.enable",
  "Page.setInterceptFileChooserDialog",
  "Runtime.releaseObject",
]);

export type ProviderInputState = {
  started: boolean;
};

type ProviderInputGuard = Readonly<{
  assertInteractive(): void;
  state: ProviderInputState;
}>;

/** Narrow adapter: DevTools methods are selected by the fixed command registry, never by business input. */
export class ExtensionDebuggerRuntime {
  private readonly attached = new Set<number>();
  private inFlightPageActions = 0;
  private pageReadNotBefore = 0;
  private providerInputGuard: ProviderInputGuard | null = null;
  private readonly pendingFileChoosers = new Map<number, {
    resolve(value: Readonly<{ backendNodeId: number }>): void;
    reject(error: Error): void;
    timeout: ReturnType<typeof globalThis.setTimeout> | null;
    backendNodeId: number | null;
    duplicate: boolean;
  }>();

  public constructor(private readonly chromeApi: ExtensionChromeApi) {
    this.chromeApi.debugger.onEvent.addListener((target, method, parameters) => {
      if (method === "Page.fileChooserOpened") this.consumeFileChooserEvent(target.tabId, parameters);
    });
  }

  private consumeFileChooserEvent(
    tabId: number,
    parameters?: Readonly<Record<string, unknown>>,
  ): void {
    const pending = this.pendingFileChoosers.get(tabId);
    if (!pending) return;
    if (pending.backendNodeId !== null) {
      pending.duplicate = true;
      return;
    }
    const backendNodeId = parameters?.backendNodeId;
    if (!Number.isSafeInteger(backendNodeId)) {
      pending.reject(new Error("BROWSER_FILE_CHOOSER_MISMATCH"));
      return;
    }
    pending.backendNodeId = backendNodeId as number;
    pending.resolve(Object.freeze({ backendNodeId: backendNodeId as number }));
  }

  public async attach(tabId: number): Promise<void> {
    if (this.attached.has(tabId)) return;
    await this.chromeApi.debugger.attach({ tabId }, "1.3");
    this.attached.add(tabId);
  }

  public adoptAttached(tabId: number): void {
    this.attached.add(tabId);
  }

  public forgetAttached(tabId: number): void {
    this.attached.delete(tabId);
  }

  public async detach(tabId: number): Promise<void> {
    if (!this.attached.has(tabId)) return;
    await this.chromeApi.debugger.detach({ tabId });
    this.attached.delete(tabId);
  }

  public async send(tabId: number, method: string, parameters?: Readonly<Record<string, unknown>>): Promise<unknown> {
    if (!this.attached.has(tabId)) throw new Error("BROWSER_DEVTOOLS_CONFLICT");
    if (PAGE_MUTATION_METHODS.has(method)) {
      const guard = this.providerInputGuard;
      if (guard) {
        guard.assertInteractive();
        guard.state.started = true;
      }
      try {
        return await this.executePageAction(() =>
          this.chromeApi.debugger.sendCommand(target(tabId), method, parameters));
      } catch (error) {
        await this.awaitPageReadPermission();
        throw error;
      }
    }
    if (PAGE_READ_METHODS.has(method)) {
      await this.awaitPageReadPermission();
      return this.chromeApi.debugger.sendCommand(target(tabId), method, parameters);
    }
    if (DEVTOOLS_CONTROL_METHODS.has(method)) {
      return this.chromeApi.debugger.sendCommand(target(tabId), method, parameters);
    }
    throw new Error("BROWSER_UNREGISTERED_DEVTOOLS_METHOD");
  }

  public async createProductionTab(url: string): Promise<Readonly<{ id?: number }>> {
    try { return await this.executePageAction(() => this.chromeApi.tabs.create({ active: true, url })); }
    catch (error) {
      await this.awaitPageReadPermission();
      throw error;
    }
  }

  public async activateTab(tabId: number): Promise<ExtensionTab> {
    try {
      return await this.executePageAction(() => this.chromeApi.tabs.update(tabId, { active: true }));
    } catch (error) {
      await this.awaitPageReadPermission();
      throw error;
    }
  }

  public async withProviderInputGuard<T>(
    state: ProviderInputState,
    assertInteractive: () => void,
    action: () => Promise<T>,
  ): Promise<T> {
    if (this.providerInputGuard !== null) throw new Error("BROWSER_BACKPRESSURE");
    this.providerInputGuard = Object.freeze({ state, assertInteractive });
    try {
      return await action();
    } finally {
      this.providerInputGuard = null;
    }
  }

  public async removeTab(tabId: number): Promise<void> {
    try {
      await this.executePageAction(() => this.chromeApi.tabs.remove(tabId));
      await this.awaitPageReadPermission();
    }
    catch (error) {
      await this.awaitPageReadPermission();
      throw error;
    }
  }

  public async readTargets(): Promise<readonly ExtensionDebugTarget[]> {
    await this.awaitPageReadPermission();
    return this.chromeApi.debugger.getTargets();
  }

  public async readTab(tabId: number): Promise<ExtensionTab> {
    await this.awaitPageReadPermission();
    return this.chromeApi.tabs.get(tabId);
  }

  public async awaitPageReadPermission(): Promise<void> {
    while (true) {
      if (this.inFlightPageActions > 0) {
        await waitForBarrier(1);
        continue;
      }
      const remaining = this.pageReadNotBefore - monotonicNow();
      if (remaining <= 0) return;
      await waitForBarrier(remaining);
    }
  }

  private async executePageAction<T>(action: () => Promise<T>): Promise<T> {
    this.inFlightPageActions += 1;
    try {
      return await action();
    } finally {
      this.inFlightPageActions -= 1;
      this.pageReadNotBefore = Math.max(
        this.pageReadNotBefore,
        monotonicNow() + PAGE_ACTION_READ_SETTLEMENT_MS,
      );
    }
  }

  public async captureFileChooserOpened(
    tabId: number,
    timeoutMs: number,
    trigger: () => Promise<void>,
    consume: (opened: Readonly<{ backendNodeId: number }>) => Promise<void>,
  ): Promise<void> {
    if (!this.attached.has(tabId)) throw new Error("BROWSER_DEVTOOLS_CONFLICT");
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000
      || this.pendingFileChoosers.has(tabId)) {
      throw new Error("BROWSER_BACKPRESSURE");
    }
    let resolveChooser!: (value: Readonly<{ backendNodeId: number }>) => void;
    let rejectChooser!: (error: Error) => void;
    const chooser = new Promise<Readonly<{ backendNodeId: number }>>((resolve, reject) => {
      resolveChooser = resolve;
      rejectChooser = reject;
    });
    this.pendingFileChoosers.set(tabId, {
      resolve: resolveChooser,
      reject: rejectChooser,
      timeout: null,
      backendNodeId: null,
      duplicate: false,
    });
    try {
      let rejectDeadline!: (error: Error) => void;
      const deadline = new Promise<never>((_resolve, reject) => { rejectDeadline = reject; });
      const timeout = globalThis.setTimeout(() => {
        rejectDeadline(new Error("BROWSER_FILE_CHOOSER_TIMEOUT"));
      }, timeoutMs);
      const pending = this.pendingFileChoosers.get(tabId);
      if (!pending) throw new Error("BROWSER_FILE_CHOOSER_MISMATCH");
      pending.timeout = timeout;
      const [, opened] = await Promise.race([Promise.all([trigger(), chooser]), deadline]);
      globalThis.clearTimeout(timeout);
      await consume(opened);
      await this.awaitPageReadPermission();
      if (this.pendingFileChoosers.get(tabId)?.duplicate === true) {
        throw new Error("BROWSER_FILE_CHOOSER_MISMATCH");
      }
    } catch (error) {
      await this.awaitPageReadPermission();
      throw error;
    } finally {
      const pending = this.pendingFileChoosers.get(tabId);
      if (pending) {
        this.pendingFileChoosers.delete(tabId);
        if (pending.timeout !== null) globalThis.clearTimeout(pending.timeout);
      }
    }
  }

  public isAttached(tabId: number): boolean {
    return this.attached.has(tabId);
  }
}

const target = (tabId: number): ExtensionDebuggee => ({ tabId });

const monotonicNow = (): number => globalThis.performance.now();

const waitForBarrier = (durationMs: number): Promise<void> =>
  new Promise((resolve) => globalThis.setTimeout(resolve, Math.max(1, Math.ceil(durationMs))));
