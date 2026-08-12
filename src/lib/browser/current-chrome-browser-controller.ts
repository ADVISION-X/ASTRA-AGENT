import type {
  BrowserController,
} from "./browser-controller.js";
import type { RuntimeLogger } from "../runtime-logs/index.js";
import {
  runLoggedBrowserResultAction,
  runLoggedBrowserValueAction,
} from "./current-chrome-browser-action-logging.js";
import {
  createCurrentChromeBrowserControllerRuntime,
  type CurrentChromeBrowserControllerOptions,
} from "./current-chrome-browser-controller-runtime.js";

export class CurrentChromeBrowserController implements BrowserController {
  private readonly runtime: BrowserController;

  constructor(private readonly options: CurrentChromeBrowserControllerOptions, private readonly runtimeLogger?: RuntimeLogger) {
    this.runtime = createCurrentChromeBrowserControllerRuntime(options);
  }

  getHealth() { return this.runtime.getHealth(); }
  setExecutionAbortSignal(abortSignal: AbortSignal | null) { this.runtime.setExecutionAbortSignal?.(abortSignal); }
  getSessionState() { return this.runtime.getSessionState(); }
  getGeometrySnapshot(abortSignal?: AbortSignal) { return this.runtime.getGeometrySnapshot(abortSignal); }
  open(input: Parameters<BrowserController["open"]>[0]) {
    if (input.browserActionId) return this.runtime.open(input);
    return this.loggedResult("open", (browserActionId) => this.runtime.open({ ...input, browserActionId }), (result) => result.ok, (result) => result.message);
  }
  scroll(input: Parameters<BrowserController["scroll"]>[0]) { return this.loggedResult("scroll", () => this.runtime.scroll(input), (result) => result.ok, (result) => result.message); }
  click(input: Parameters<BrowserController["click"]>[0]) { return this.loggedResult("click", () => this.runtime.click(input), (result) => result.ok, (result) => result.message); }
  move(input: Parameters<NonNullable<BrowserController["move"]>>[0]) { return this.loggedResult("move", () => this.runtime.move?.(input) ?? Promise.resolve({ browserActionId: "browser-move-unavailable", ok: false, message: "browser move unavailable", createdAt: new Date().toISOString() }), (result) => result.ok, (result) => result.message); }
  clickLocatedDomElement(input: Parameters<BrowserController["clickLocatedDomElement"]>[0]) { return this.loggedResult("click-located-dom-element", () => this.runtime.clickLocatedDomElement(input), (result) => result.ok, (result) => result.message); }
  textInput(input: Parameters<BrowserController["textInput"]>[0]) { return this.loggedResult("text-input", () => this.runtime.textInput(input), (result) => result.ok, (result) => result.message); }
  screenshotRegion(input: Parameters<BrowserController["screenshotRegion"]>[0]) { return this.loggedResult("screenshot-region", () => this.runtime.screenshotRegion(input)); }
  evaluateActiveTab<T>(input: Parameters<BrowserController["evaluateActiveTab"]>[0]) { return this.loggedValue("evaluate-active-tab", () => this.runtime.evaluateActiveTab<T>(input)); }
  setFileInputFiles(input: Parameters<BrowserController["setFileInputFiles"]>[0]) { return this.loggedResult("set-file-input-files", () => this.runtime.setFileInputFiles(input), (result) => result.ok, (result) => result.message); }
  selectFilesInNativePicker(input: Parameters<NonNullable<BrowserController["selectFilesInNativePicker"]>>[0]) {
    const action = this.runtime.selectFilesInNativePicker;
    return this.loggedResult("native-file-picker", () => action ? action(input) : Promise.resolve({
        browserActionId: "browser-native-multi-file-picker-unavailable",
        ok: false,
        message: "native multi-file picker is unavailable",
        observedFileNames: [],
        createdAt: new Date().toISOString(),
      }), (result) => result.ok, (result) => result.message);
  }
  wait(durationMs: number, abortSignal?: AbortSignal) { return this.runtime.wait(durationMs, abortSignal); }
  closeActiveTab(input: Parameters<BrowserController["closeActiveTab"]>[0]) { return this.loggedResult("close-active-tab", () => this.runtime.closeActiveTab(input), (result) => result.ok, (result) => result.message); }
  close() { return this.loggedResult("close", () => this.runtime.close(), (result) => result.ok, (result) => result.message); }

  private loggedResult<T extends { browserActionId: string }>(
    actionKind: string,
    run: (browserActionId: string) => Promise<T>,
    isSuccess?: (result: T) => boolean,
    failureReason?: (result: T) => string,
  ): Promise<T> {
    return runLoggedBrowserResultAction({
      ...(this.runtimeLogger ? { runtimeLogger: this.runtimeLogger } : {}),
      actionKind,
      beforeUrl: this.runtime.getSessionState().currentUrl,
      readAfterUrl: () => this.runtime.getSessionState().currentUrl,
      run,
      ...(isSuccess ? { isSuccess } : {}),
      ...(failureReason ? { failureReason } : {}),
    });
  }

  private loggedValue<T>(actionKind: string, run: () => Promise<T>): Promise<T> {
    return runLoggedBrowserValueAction({
      ...(this.runtimeLogger ? { runtimeLogger: this.runtimeLogger } : {}),
      actionKind,
      beforeUrl: this.runtime.getSessionState().currentUrl,
      readAfterUrl: () => this.runtime.getSessionState().currentUrl,
      run,
    });
  }
}
