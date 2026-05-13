/**
 * workbench-assembly.ts — All capability group assembly for the local workbench.
 *
 * Responsibilities:
 *   - Creates browser session + controller.
 *   - Creates generic file storage and wires Forensics storage adapter.
 *   - Creates all capability groups from their public factory functions.
 *
 * Does NOT contain: mission logic, AI routing, Forensics finalization,
 * Commander read models, map/binding, visual-target/PAV support,
 * or Nerve Bus special routes.
 */

import path from "node:path";

import { createConfiguredAiAbilityGroup } from "../../capabilities/ai/index.js";
import { createForensicsPersistenceAbilityGroup } from "../../capabilities/forensics-persistence/index.js";
import { createForensicsStorageAdapter } from "../../capabilities/forensics-persistence/storage-adapter.js";
import { createGeometryGuardAbilityGroup } from "../../capabilities/geometry-guard/index.js";
import { createMouseClickAbilityGroupWithPrimitivePort } from "../../capabilities/mouse-click/index.js";
import { createMouseScrollAbilityGroupWithPrimitivePort } from "../../capabilities/mouse-scroll/index.js";
import { createOpenAbilityGroup } from "../../capabilities/open/index.js";
import type { BrowserOpenPort } from "../../capabilities/open/index.js";

import { createWorkbenchScreenshotAbilityGroup } from "../../capabilities/screenshot/workbench-screenshot-ability-group.js";
import { createTextInputAbilityGroupWithPrimitivePort } from "../../capabilities/text-input/index.js";
import { createVisualTargetAbilityGroup } from "../../capabilities/visual-target/index.js";
import { CurrentChromeBrowserController } from "../browser/current-chrome-browser-controller.js";
import { createLocalBrowserSessionConfig } from "../browser/local-browser-session.js";
import { createBrowserControllerMouseClickPrimitivePort } from "../browser/mouse-click-primitive-port.js";
import { createBrowserControllerMouseScrollPrimitivePort } from "../browser/mouse-scroll-primitive-port.js";
import { createBrowserControllerTextInputRuntimePorts } from "../browser/text-input-runtime-ports.js";
import { createGrassEyeFileStorage } from "../storage/index.js";
import { getDefaultPhase04LocalDataDir } from "./default-data-dir.js";
import { StructuredLogBus } from "./structured-log-bus.js";
import {
  createStructuredTerminalLogListener,
  isStructuredLogStdoutEnabled,
  resolveStructuredLogLevel,
} from "./structured-log-terminal.js";
import { createRuntimeLogger, setDefaultRuntimeLogger } from "../runtime-logs/logger.js";
import type { RuntimeLogger } from "../runtime-logs/index.js";
import type { GrassEyeWorkbenchOptions } from "./contract.js";

// ─── Local Port Adapters ───────────────────────────────────────────────────────

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



// ─── Assembly Type ─────────────────────────────────────────────────────────────

export type WorkbenchAssembly = {
  options: GrassEyeWorkbenchOptions;
  dataDir: string;
  structuredLogBus: StructuredLogBus;
  browserController: CurrentChromeBrowserController;
  forensicsPersistenceAbilityGroup: ReturnType<
    typeof createForensicsPersistenceAbilityGroup
  >;
  aiAbilityGroup: ReturnType<typeof createConfiguredAiAbilityGroup>;
  openAbilityGroup: ReturnType<typeof createOpenAbilityGroup>;
  screenshotAbilityGroup: ReturnType<typeof createWorkbenchScreenshotAbilityGroup>;
  visualTargetAbilityGroup: ReturnType<typeof createVisualTargetAbilityGroup>;
  geometryGuardAbilityGroup: ReturnType<typeof createGeometryGuardAbilityGroup>;
  mouseClickAbilityGroup: ReturnType<
    typeof createMouseClickAbilityGroupWithPrimitivePort
  >;
  mouseScrollAbilityGroup: ReturnType<
    typeof createMouseScrollAbilityGroupWithPrimitivePort
  >;
  textInputAbilityGroup: ReturnType<typeof createTextInputAbilityGroupWithPrimitivePort>;
  runtimeLogger: RuntimeLogger;
};

// ─── Assembly ─────────────────────────────────────────────────────────────────

export function createWorkbenchAssembly(
  options: GrassEyeWorkbenchOptions,
): WorkbenchAssembly {
  const dataDir = options.dataDir ?? getDefaultPhase04LocalDataDir();

  // Runtime Log Spine — single source of truth for all structured runtime events.
  // Must be initialized before any capability group so emitRuntimeLog calls are captured.
  const runtimeLogger = createRuntimeLogger({
    terminalEnabled: true,
  });
  setDefaultRuntimeLogger(runtimeLogger);

  // Structured log bus used by terminal relay output.
  // Must NOT be used by start/mission/AI main chain; use runtimeLogger/emitRuntimeLog instead.
  const structuredLogBus = new StructuredLogBus();
  if (isStructuredLogStdoutEnabled()) {
    structuredLogBus.subscribe(
      createStructuredTerminalLogListener(resolveStructuredLogLevel()),
    );
  }

  // Browser session + controller
  const browserSessionConfig = createLocalBrowserSessionConfig({
    platform: options.platformTarget,
    ...(options.browserProfileDirectory
      ? { profileDirectory: options.browserProfileDirectory }
      : {}),
  });
  const browserController = new CurrentChromeBrowserController({
    sessionConfig: browserSessionConfig,
    screenshotDir: path.join(dataDir, "browser-captures"),
    headlessRequested: options.browserHeadless === true,
  });

  // Generic storage + Forensics adapter
  const genericStorage = createGrassEyeFileStorage(dataDir);
  const forensicsStoragePort = createForensicsStorageAdapter(genericStorage);
  const forensicsPersistenceAbilityGroup =
    createForensicsPersistenceAbilityGroup(forensicsStoragePort, runtimeLogger);

  // Minimal dataDir provider for screenshot artifact path (no evidenceStore dependency)
  const dataDirProvider = { getDataDir: () => dataDir };

  // Browser primitive ports
  const mouseClickPrimitivePort =
    createBrowserControllerMouseClickPrimitivePort({ browserController });
  const mouseScrollPrimitivePort =
    createBrowserControllerMouseScrollPrimitivePort({ browserController });
  const textInputPorts = createBrowserControllerTextInputRuntimePorts({
    browserController,
  });

  // Capability groups
  const screenshotAbilityGroup = createWorkbenchScreenshotAbilityGroup({
    browserController,
    evidenceStore: dataDirProvider,
  });
  const visualTargetAbilityGroup = createVisualTargetAbilityGroup();
  const geometryGuardAbilityGroup = createGeometryGuardAbilityGroup();
  const mouseClickAbilityGroup = createMouseClickAbilityGroupWithPrimitivePort({
    primitivePort: mouseClickPrimitivePort,
  });
  const mouseScrollAbilityGroup =
    createMouseScrollAbilityGroupWithPrimitivePort({
      primitivePort: mouseScrollPrimitivePort,
    });
  const textInputAbilityGroup =
    createTextInputAbilityGroupWithPrimitivePort(textInputPorts);
  const aiAbilityGroup = createConfiguredAiAbilityGroup({ dataDir, runtimeLogger });
  const openAbilityGroup = createOpenAbilityGroup({
    browserOpenPort: createOpenBrowserPortAdapter(browserController),
    workbenchOpenPort: {
      openWorkbench: async (_input) => {
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
      },
    },
  });

  return {
    options,
    dataDir,
    structuredLogBus,
    browserController,
    forensicsPersistenceAbilityGroup,
    aiAbilityGroup,
    openAbilityGroup,
    screenshotAbilityGroup,
    visualTargetAbilityGroup,
    geometryGuardAbilityGroup,
    mouseClickAbilityGroup,
    mouseScrollAbilityGroup,
    textInputAbilityGroup,
    runtimeLogger,
  };
}
