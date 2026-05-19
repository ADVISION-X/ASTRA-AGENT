import path from "node:path";

import { createOpenAbilityGroup } from "../../capabilities/open/index.js";
import type { BrowserOpenPort } from "../../capabilities/open/index.js";
import { createWorkbenchScreenshotAbilityGroup } from "../../capabilities/screenshot/workbench-screenshot-ability-group.js";
import { CurrentChromeBrowserController } from "../browser/current-chrome-browser-controller.js";
import { createLocalBrowserSessionConfig } from "../browser/local-browser-session.js";
import { createBrowserControllerMouseClickPrimitivePort } from "../browser/mouse-click-primitive-port.js";
import { createBrowserControllerMouseScrollPrimitivePort } from "../browser/mouse-scroll-primitive-port.js";
import { createBrowserControllerTextInputRuntimePorts } from "../browser/text-input-runtime-ports.js";
import type { GrassEyeWorkbenchOptions } from "./contract.js";

function createOpenBrowserPortAdapter(
  browserController: CurrentChromeBrowserController,
): BrowserOpenPort {
  return {
    async openUrl(input: { url: string; timeoutMs?: number }) {
      const started = new Date().toISOString();
      const result = await browserController.open({
        url: input.url,
        title: "",
      });
      return {
        ok: result.ok,
        currentUrl: input.url,
        navigationStartedAt: started,
        navigationEndedAt: new Date().toISOString(),
        ...(result.ok ? {} : { failureMessage: result.message }),
      };
    },
    async readRawObservation() {
      const state = browserController.getSessionState();
      return {
        ...(state.currentUrl != null ? { currentUrl: state.currentUrl } : {}),
        ...(state.currentTitle != null ? { currentTitle: state.currentTitle } : {}),
        ...(state.browserProfileRef != null ? { browserSessionRef: state.browserProfileRef } : {}),
      };
    },
  };
}

export type WorkbenchPrimitivePorts = {
  mouseClickPrimitivePort: ReturnType<
    typeof createBrowserControllerMouseClickPrimitivePort
  >;
  mouseScrollPrimitivePort: ReturnType<
    typeof createBrowserControllerMouseScrollPrimitivePort
  >;
  textInputPorts: ReturnType<typeof createBrowserControllerTextInputRuntimePorts>;
};

export function createWorkbenchBrowserController(
  options: GrassEyeWorkbenchOptions,
  dataDir: string,
): CurrentChromeBrowserController {
  const browserSessionConfig = createLocalBrowserSessionConfig({
    platform: options.platformTarget,
    ...(options.browserProfileDirectory
      ? { profileDirectory: options.browserProfileDirectory }
      : {}),
  });
  return new CurrentChromeBrowserController({
    sessionConfig: browserSessionConfig,
    screenshotDir: path.join(dataDir, "browser-captures"),
    headlessRequested: options.browserHeadless === true,
  });
}

export function createWorkbenchPrimitivePorts(
  browserController: CurrentChromeBrowserController,
): WorkbenchPrimitivePorts {
  const mouseClickPrimitivePort =
    createBrowserControllerMouseClickPrimitivePort({ browserController });
  const mouseScrollPrimitivePort =
    createBrowserControllerMouseScrollPrimitivePort({ browserController });
  const textInputPorts = createBrowserControllerTextInputRuntimePorts({
    browserController,
  });
  return { mouseClickPrimitivePort, mouseScrollPrimitivePort, textInputPorts };
}

export function createWorkbenchScreenshotGroup(
  browserController: CurrentChromeBrowserController,
  dataDir: string,
) {
  return createWorkbenchScreenshotAbilityGroup({
    browserController,
    evidenceStore: { getDataDir: () => dataDir },
  });
}

export function createWorkbenchOpenAbilityGroup(
  options: GrassEyeWorkbenchOptions,
  browserController: CurrentChromeBrowserController,
) {
  return createOpenAbilityGroup({
    browserOpenPort: createOpenBrowserPortAdapter(browserController),
    workbenchOpenPort: {
      openWorkbench: async (_input) =>
        openWorkbenchInBrowser(options, browserController),
    },
  });
}

async function openWorkbenchInBrowser(
  options: GrassEyeWorkbenchOptions,
  browserController: CurrentChromeBrowserController,
) {
  const started = new Date().toISOString();
  const workbenchUrl = new URL(options.baseUrl);
  const result = await browserController.open({
    url: workbenchUrl.toString(),
    title: "",
  });
  return {
    ok: result.ok,
    currentUrl: workbenchUrl.toString(),
    navigationStartedAt: started,
    navigationEndedAt: new Date().toISOString(),
    ...(result.ok ? {} : { failureMessage: result.message }),
  };
}