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
  "Page.close",
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
  "Browser.setDownloadBehavior",
  "Page.enable",
  "Page.setInterceptFileChooserDialog",
  "Runtime.releaseObject",
]);

type PendingDownload = {
  expectedFrameId: string;
  expectedSizeBytes: number;
  guid: string | null;
  resolveStarted(value: Readonly<{ guid: string }>): void;
  resolveCompleted(value: Readonly<{ guid: string; totalBytes: number }>): void;
  reject(error: Error): void;
};

/** Narrow adapter: DevTools methods are selected by the fixed command registry, never by business input. */
export class ExtensionDebuggerRuntime {
  private readonly attached = new Set<number>();
  private inFlightPageActions = 0;
  private pageReadNotBefore = 0;
  private readonly pendingFileChoosers = new Map<number, {
    resolve(value: Readonly<{ backendNodeId: number }>): void;
    reject(error: Error): void;
    timeout: ReturnType<typeof globalThis.setTimeout> | null;
    backendNodeId: number | null;
    duplicate: boolean;
  }>();
  private readonly pendingDownloads = new Map<number, PendingDownload>();

  public constructor(private readonly chromeApi: ExtensionChromeApi) {
    this.chromeApi.debugger.onEvent.addListener((target, method, parameters) => {
      if (method === "Page.fileChooserOpened") this.consumeFileChooserEvent(target.tabId, parameters);
      else if (method === "Browser.downloadWillBegin") this.consumeDownloadWillBegin(target.tabId, parameters);
      else if (method === "Browser.downloadProgress") this.consumeDownloadProgress(target.tabId, parameters);
    });
  }

  private rejectPendingDownload(tabId: number, code: string): void {
    const pending = this.pendingDownloads.get(tabId);
    if (!pending) return;
    pending.reject(new Error(code));
  }

  private consumeDownloadWillBegin(
    tabId: number,
    parameters?: Readonly<Record<string, unknown>>,
  ): void {
    const pending = this.pendingDownloads.get(tabId);
    if (!pending) return;
    const guid = parameters?.guid;
    const frameId = parameters?.frameId;
    if (typeof guid !== "string" || guid.length === 0 || frameId !== pending.expectedFrameId) {
      this.rejectPendingDownload(tabId, "BROWSER_DOWNLOAD_IDENTITY_MISMATCH");
      return;
    }
    if (pending.guid !== null) {
      this.rejectPendingDownload(tabId, "BROWSER_DOWNLOAD_MULTIPLE");
      return;
    }
    pending.guid = guid;
    pending.resolveStarted(Object.freeze({ guid }));
  }

  private consumeDownloadProgress(
    tabId: number,
    parameters?: Readonly<Record<string, unknown>>,
  ): void {
    const pending = this.pendingDownloads.get(tabId);
    if (!pending || typeof parameters?.guid !== "string" || parameters.guid !== pending.guid) return;
    if (parameters.state === "canceled") {
      this.rejectPendingDownload(tabId, "BROWSER_DOWNLOAD_INTERRUPTED");
      return;
    }
    if (parameters.state !== "completed") return;
    const receivedBytes = parameters.receivedBytes;
    const totalBytes = parameters.totalBytes;
    if (!Number.isSafeInteger(receivedBytes) || !Number.isSafeInteger(totalBytes)
      || receivedBytes !== totalBytes || totalBytes !== pending.expectedSizeBytes) {
      this.rejectPendingDownload(tabId, "BROWSER_DOWNLOAD_BYTES_MISMATCH");
      return;
    }
    pending.resolveCompleted(Object.freeze({ guid: pending.guid!, totalBytes: totalBytes as number }));
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

  public async createBackgroundTab(url: string): Promise<Readonly<{ id?: number }>> {
    try { return await this.executePageAction(() => this.chromeApi.tabs.create({ active: false, url })); }
    catch (error) {
      await this.awaitPageReadPermission();
      throw error;
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

  private async readMainFrameId(tabId: number): Promise<string> {
    const result = await this.send(tabId, "Page.getFrameTree") as Readonly<{
      frameTree?: Readonly<{ frame?: Readonly<{ id?: unknown }> }>;
    }>;
    const frameId = result.frameTree?.frame?.id;
    if (typeof frameId !== "string" || frameId.length === 0) throw new Error("BROWSER_DOCUMENT_INVALID");
    return frameId;
  }

  public async captureCompletedDownload(
    tabId: number,
    expectedSizeBytes: number,
    timeoutMs: number,
    trigger: () => Promise<void>,
    onStarted: (value: Readonly<{ guid: string }>) => Promise<void>,
  ): Promise<Readonly<{ guid: string; totalBytes: number }>> {
    if (!this.attached.has(tabId)) throw new Error("BROWSER_DEVTOOLS_CONFLICT");
    if (!Number.isSafeInteger(expectedSizeBytes) || expectedSizeBytes < 1
      || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 20_000
      || this.pendingDownloads.has(tabId)) throw new Error("BROWSER_BACKPRESSURE");
    const expectedFrameId = await this.readMainFrameId(tabId);
    await this.send(tabId, "Browser.setDownloadBehavior", { behavior: "default", eventsEnabled: true });
    let resolveStarted!: (value: Readonly<{ guid: string }>) => void;
    let rejectStarted!: (error: Error) => void;
    let resolveCompleted!: (value: Readonly<{ guid: string; totalBytes: number }>) => void;
    let rejectCompleted!: (error: Error) => void;
    const started = new Promise<Readonly<{ guid: string }>>((resolve, reject) => {
      resolveStarted = resolve; rejectStarted = reject;
    });
    const completed = new Promise<Readonly<{ guid: string; totalBytes: number }>>((resolve, reject) => {
      resolveCompleted = resolve; rejectCompleted = reject;
    });
    void completed.catch(() => undefined);
    this.pendingDownloads.set(tabId, {
      expectedFrameId, expectedSizeBytes, guid: null, resolveStarted, resolveCompleted,
      reject: (error) => { rejectStarted(error); rejectCompleted(error); },
    });
    let rejectDeadline!: (error: Error) => void;
    const deadline = new Promise<never>((_resolve, reject) => { rejectDeadline = reject; });
    const timeout = globalThis.setTimeout(() => {
      rejectDeadline(new Error("BROWSER_DOWNLOAD_TIMEOUT"));
    }, timeoutMs);
    try {
      const [, start] = await Promise.race([Promise.all([trigger(), started]), deadline]);
      await onStarted(start);
      return await Promise.race([completed, deadline]);
    } finally {
      globalThis.clearTimeout(timeout);
      this.pendingDownloads.delete(tabId);
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
