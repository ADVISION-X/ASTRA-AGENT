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
import type { OpenBrowserPort } from "../../capabilities/open/index.js";
import { createPostActionVerificationAbilityGroup } from "../../capabilities/post-action-verification/index.js";
import type { PostActionEvidenceReadPort } from "../../capabilities/post-action-verification/ports/post-action-evidence-read-port.js";
import { createWorkbenchScreenshotAbilityGroup } from "../../capabilities/screenshot/workbench-screenshot-ability-group.js";
import { createTextInputAbilityGroupWithPorts } from "../../capabilities/text-input/index.js";
import { createVisualTargetAbilityGroup } from "../../capabilities/visual-target/index.js";
import { CurrentChromeBrowserController } from "../browser/current-chrome-browser-controller.js";
import { createLocalBrowserSessionConfig } from "../browser/local-browser-session.js";
import { createBrowserControllerMouseClickPrimitivePort } from "../browser/mouse-click-primitive-port.js";
import { createBrowserControllerMouseScrollPrimitivePort } from "../browser/mouse-scroll-primitive-port.js";
import { createBrowserControllerTextInputRuntimePorts } from "../browser/text-input-runtime-ports.js";
import { createGrassEyeFileStorage } from "../storage/index.js";
import { getDefaultPhase04LocalDataDir } from "./default-data-dir.js";
import { createGovernedMacOSOpenLocalProgramAdapter } from "./open-local-program-adapter.js";
import { StructuredLogBus } from "./structured-log-bus.js";
import {
  createStructuredTerminalLogListener,
  isStructuredLogStdoutEnabled,
  resolveStructuredLogLevel,
} from "./structured-log-terminal.js";
import type { GrassEyeWorkbenchOptions } from "./contract.js";

// ─── Local Port Adapters ───────────────────────────────────────────────────────

function createOpenBrowserPortAdapter(
  browserController: CurrentChromeBrowserController,
): OpenBrowserPort {
  return {
    async getSessionSnapshot() {
      const state = browserController.getSessionState();
      return {
        open: state.open,
        currentUrl: state.currentUrl,
        currentTitle: state.currentTitle ?? null,
        browserExecutable: state.browserExecutable,
        browserMode: state.browserMode,
        browserProfileRef: state.browserProfileRef,
        browserExecutablePath: state.browserExecutablePath,
        profileStatus: state.profileStatus,
        profileDirectory: state.profileDirectory,
        profileProvisioning: state.profileProvisioning,
        profileVerificationStatus: state.profileVerificationStatus,
        profileVerificationReason: state.profileVerificationReason ?? null,
        loginState: state.loginState,
        lastLoginCheckAt: state.lastLoginCheckAt ?? null,
        loginRequiredReason: state.loginRequiredReason ?? null,
        reviewRequiredReason: state.reviewRequiredReason ?? null,
      } as unknown as ReturnType<OpenBrowserPort["getSessionSnapshot"]> extends Promise<infer T>
        ? T
        : never;
    },
    async open(input) {
      const result = await browserController.open({
        url: input.url,
        title: input.title ?? "",
      });
      return {
        browserActionId: result.browserActionId,
        ok: result.ok,
        message: result.message,
        createdAt: result.createdAt,
        openedUrl: input.url,
        pageTitleAfter: null,
        redirectChain: [input.url],
        portKind: "current-chrome-browser-controller",
      };
    },
  };
}

function createLocalPavEvidenceReadPort(): PostActionEvidenceReadPort {
  return {
    listObservations(request) {
      return request.observationSet.observations;
    },
    getObservationByRef(request, ref) {
      return (
        request.observationSet.observations.find((o) => o.ref === ref) ?? null
      );
    },
    getEvidenceByRef(request, ref) {
      const { beforeEvidence, afterEvidence } = request.beforeAfterEvidence;
      if (
        beforeEvidence != null &&
        (beforeEvidence as { evidenceRef?: string }).evidenceRef === ref
      ) {
        return beforeEvidence as unknown as ReturnType<
          PostActionEvidenceReadPort["getEvidenceByRef"]
        >;
      }
      if (
        afterEvidence != null &&
        (afterEvidence as { evidenceRef?: string }).evidenceRef === ref
      ) {
        return afterEvidence as unknown as ReturnType<
          PostActionEvidenceReadPort["getEvidenceByRef"]
        >;
      }
      return null;
    },
    getActionLogByRef(_request, _ref) {
      return null;
    },
    verifyProofRef(_request, _ref) {
      return true;
    },
    verifyEvidenceBinding(_request, _ref) {
      return true;
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
  textInputAbilityGroup: ReturnType<typeof createTextInputAbilityGroupWithPorts>;
  postActionVerificationAbilityGroup: ReturnType<
    typeof createPostActionVerificationAbilityGroup
  >;
};

// ─── Assembly ─────────────────────────────────────────────────────────────────

export function createWorkbenchAssembly(
  options: GrassEyeWorkbenchOptions,
): WorkbenchAssembly {
  const dataDir = options.dataDir ?? getDefaultPhase04LocalDataDir();

  // Structured log bus
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
    createForensicsPersistenceAbilityGroup(forensicsStoragePort);

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
    createTextInputAbilityGroupWithPorts(textInputPorts);
  const postActionVerificationAbilityGroup =
    createPostActionVerificationAbilityGroup({
      clock: {
        portKind: "post-action-verification-clock" as const,
        now: () => ({
          isoTimestamp: new Date().toISOString(),
          monotonicMs: performance.now(),
        }),
      },
      evidenceReadPort: createLocalPavEvidenceReadPort(),
    });
  const aiAbilityGroup = createConfiguredAiAbilityGroup({ dataDir });
  const openAbilityGroup = createOpenAbilityGroup({
    browser: createOpenBrowserPortAdapter(browserController),
    localProgram: createGovernedMacOSOpenLocalProgramAdapter(),
    profilePort: {
      resolveProfileOverride: ({ childCapabilityId }) => {
        if (childCapabilityId !== "open-local-workbench") return null;
        const workbenchUrl = new URL(options.baseUrl);
        return {
          defaultUrl: workbenchUrl.toString(),
          profileRef: "local-workbench",
          platformId: "agent-shell",
          targetKind: "local-url",
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
    postActionVerificationAbilityGroup,
  };
}
