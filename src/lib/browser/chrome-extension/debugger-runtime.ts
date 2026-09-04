import type { ExtensionChromeApi, ExtensionDebuggee } from "./extension-runtime-types.js";

/** Narrow adapter: DevTools methods are selected by the fixed command registry, never by business input. */
export class ExtensionDebuggerRuntime {
  private readonly attached = new Set<number>();
  private readonly pendingFileChoosers = new Map<number, {
    resolve(value: Readonly<{ backendNodeId: number }>): void;
    reject(error: Error): void;
    timeout: ReturnType<typeof globalThis.setTimeout>;
    backendNodeId: number | null;
    duplicate: boolean;
  }>();

  public constructor(private readonly chromeApi: ExtensionChromeApi) {
    this.chromeApi.debugger.onEvent.addListener((target, method, parameters) => {
      if (method !== "Page.fileChooserOpened") return;
      const pending = this.pendingFileChoosers.get(target.tabId);
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
    });
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
    return this.chromeApi.debugger.sendCommand(target(tabId), method, parameters);
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
    let rejectDeadline!: (error: Error) => void;
    const chooser = new Promise<Readonly<{ backendNodeId: number }>>((resolve, reject) => {
      resolveChooser = resolve;
      rejectChooser = reject;
    });
    const deadline = new Promise<never>((_resolve, reject) => { rejectDeadline = reject; });
    const timeout = globalThis.setTimeout(() => {
      rejectDeadline(new Error("BROWSER_FILE_CHOOSER_TIMEOUT"));
    }, timeoutMs);
    this.pendingFileChoosers.set(tabId, {
      resolve: resolveChooser,
      reject: rejectChooser,
      timeout,
      backendNodeId: null,
      duplicate: false,
    });
    try {
      const [, opened] = await Promise.race([Promise.all([trigger(), chooser]), deadline]);
      globalThis.clearTimeout(timeout);
      await consume(opened);
      if (this.pendingFileChoosers.get(tabId)?.duplicate === true) {
        throw new Error("BROWSER_FILE_CHOOSER_MISMATCH");
      }
    } finally {
      const pending = this.pendingFileChoosers.get(tabId);
      if (pending) {
        this.pendingFileChoosers.delete(tabId);
        globalThis.clearTimeout(pending.timeout);
      }
    }
  }

  public isAttached(tabId: number): boolean {
    return this.attached.has(tabId);
  }
}

const target = (tabId: number): ExtensionDebuggee => ({ tabId });
