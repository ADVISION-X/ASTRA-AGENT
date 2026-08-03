import type {
  BrowserController,
} from "./browser-controller.js";
import {
  createCurrentChromeBrowserControllerRuntime,
  type CurrentChromeBrowserControllerOptions,
} from "./current-chrome-browser-controller-runtime.js";

export class CurrentChromeBrowserController implements BrowserController {
  private readonly runtime: BrowserController;

  constructor(private readonly options: CurrentChromeBrowserControllerOptions) {
    this.runtime = createCurrentChromeBrowserControllerRuntime(options);
  }

  getHealth() { return this.runtime.getHealth(); }
  getSessionState() { return this.runtime.getSessionState(); }
  getGeometrySnapshot() { return this.runtime.getGeometrySnapshot(); }
  open(input: Parameters<BrowserController["open"]>[0]) { return this.runtime.open(input); }
  scroll(input: Parameters<BrowserController["scroll"]>[0]) { return this.runtime.scroll(input); }
  click(input: Parameters<BrowserController["click"]>[0]) { return this.runtime.click(input); }
  move(input: Parameters<NonNullable<BrowserController["move"]>>[0]) { return this.runtime.move?.(input) ?? Promise.resolve({ browserActionId: "browser-move-unavailable", ok: false, message: "browser move unavailable", createdAt: new Date().toISOString() }); }
  clickLocatedDomElement(input: Parameters<BrowserController["clickLocatedDomElement"]>[0]) { return this.runtime.clickLocatedDomElement(input); }
  textInput(input: Parameters<BrowserController["textInput"]>[0]) { return this.runtime.textInput(input); }
  screenshotRegion(input: Parameters<BrowserController["screenshotRegion"]>[0]) { return this.runtime.screenshotRegion(input); }
  evaluateActiveTab<T>(input: Parameters<BrowserController["evaluateActiveTab"]>[0]) { return this.runtime.evaluateActiveTab<T>(input); }
  setFileInputFiles(input: Parameters<BrowserController["setFileInputFiles"]>[0]) { return this.runtime.setFileInputFiles(input); }
  selectFilesInNativePicker(input: Parameters<NonNullable<BrowserController["selectFilesInNativePicker"]>>[0]) {
    const action = this.runtime.selectFilesInNativePicker;
    if (!action) {
      return Promise.resolve({
        browserActionId: "browser-native-multi-file-picker-unavailable",
        ok: false,
        message: "native multi-file picker is unavailable",
        observedFileNames: [],
        createdAt: new Date().toISOString(),
      });
    }
    return action(input);
  }
  wait(durationMs: number) { return this.runtime.wait(durationMs); }
  closeActiveTab(input: Parameters<BrowserController["closeActiveTab"]>[0]) { return this.runtime.closeActiveTab(input); }
  close() { return this.runtime.close(); }
}
