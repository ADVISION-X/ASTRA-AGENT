import path from "node:path";

import { createAiAbilityGroup } from "../../capabilities/ai/index.js";
import { createAiModelRosterPort } from "../../capabilities/ai/model-roster.js";
import { createSystemAiClock } from "../../capabilities/ai/runtime/ai-clock.js";
import { createAiPromptRegistry } from "../../capabilities/ai/runtime/ai-prompt-registry.js";
import { createLocalAiRuntimePort } from "../../capabilities/ai/runtime-adapters/local-ai-runtime-adapter.js";
import { createForensicsPersistenceAbilityGroup } from "../../capabilities/forensics-persistence/index.js";
import { createGeometryGuardAbilityGroup } from "../../capabilities/geometry-guard/index.js";
import { createMouseClickAbilityGroup } from "../../capabilities/mouse-click/index.js";
import { createSystemMouseClickClock } from "../../capabilities/mouse-click/runtime/mouse-click-clock.js";
import { createMouseClickIdempotencyRegistry } from "../../capabilities/mouse-click/runtime/mouse-click-idempotency.js";
import { createMouseScrollAbilityGroup } from "../../capabilities/mouse-scroll/index.js";
import { createMouseScrollExecutionContext } from "../../capabilities/mouse-scroll/runtime/mouse-scroll-execution-context.js";
import { createOpenAbilityGroup } from "../../capabilities/open/index.js";
import { createDefaultPageStateRuntimeContext, createPageStateAbilityGroup } from "../../capabilities/page-state/index.js";
import { createPostActionVerificationAbilityGroup } from "../../capabilities/post-action-verification/index.js";
import { createBrowserControllerScreenshotCapturePort, createFilesystemScreenshotArtifactPort, createSharpScreenshotImageProcessingPort, createSystemScreenshotClockPort } from "../../capabilities/screenshot/adapters/index.js";
import { createScreenshotAbilityGroup } from "../../capabilities/screenshot/index.js";
import { createTextInputAbilityGroup } from "../../capabilities/text-input/index.js";
import { createSystemTextInputClock } from "../../capabilities/text-input/runtime/text-input-clock.js";
import { createSystemVisualTargetClock, createVisualTargetAbilityGroup, createVisualTargetRuntimeContext } from "../../capabilities/visual-target/index.js";
import { createBrowserControllerMouseClickPrimitivePort } from "../browser/mouse-click-primitive-port.js";
import { createBrowserControllerMouseScrollPrimitivePort } from "../browser/mouse-scroll-primitive-port.js";
import { CurrentChromeBrowserController } from "../browser/current-chrome-browser-controller.js";
import { createLocalBrowserSessionConfig } from "../browser/local-browser-session.js";
import { createSystemClipboardPort } from "../browser/system-clipboard-port.js";
import { createBrowserControllerTextInputExecutionPort } from "../browser/text-input-primitive-port.js";
import { createEvidenceStoreForensicsArtifactStoragePort, createEvidenceStoreForensicsRecordStoragePort } from "../storage/evidence-store/forensics-storage-adapter.js";
import { EvidenceStoreService } from "../storage/evidence-store/evidence-store-service.js";
import { getDefaultLocalDataDir } from "./default-data-dir.js";
import { recordAiDebugEvent } from "./workbench-debug.js";
import type { WorkbenchBaseRuntime, GrassEyeWorkbenchOptions } from "./workbench-contract.js";
import { createStructuredTerminalLogListener, isStructuredLogStdoutEnabled, resolveStructuredLogLevel, StructuredLogBus } from "./structured-log-bus.js";

const createStructuredLogRuntime = (): StructuredLogBus => {
  const structuredLogBus = new StructuredLogBus();
  if (isStructuredLogStdoutEnabled()) {
    structuredLogBus.subscribe(createStructuredTerminalLogListener(resolveStructuredLogLevel()));
  }
  return structuredLogBus;
};

const createPersistenceRuntime = (dataDir: string, structuredLogBus: StructuredLogBus) => {
  const evidenceStore = new EvidenceStoreService(dataDir, structuredLogBus);
  return {
    evidenceStore,
    forensicsPersistenceAbilityGroup: createForensicsPersistenceAbilityGroup({ recordStorage: createEvidenceStoreForensicsRecordStoragePort(evidenceStore), artifactStorage: createEvidenceStoreForensicsArtifactStoragePort() }),
  };
};

const createBrowserRuntime = (options: GrassEyeWorkbenchOptions, dataDir: string) => {
  const browserSessionConfig = createLocalBrowserSessionConfig({ platform: options.platformTarget, ...(options.browserProfileDirectory ? { profileDirectory: options.browserProfileDirectory } : {}) });
  const browserController = new CurrentChromeBrowserController({ sessionConfig: browserSessionConfig, screenshotDir: path.join(dataDir, "browser-captures"), headlessRequested: options.browserHeadless === true });
  return { browserSessionConfig, browserController };
};

const createActionRuntimes = (runtime: Omit<WorkbenchBaseRuntime, "aiAbilityGroup" | "openAbilityGroup">) => ({
  mouseClickAbilityGroup: createMouseClickAbilityGroup({ context: { primitivePort: createBrowserControllerMouseClickPrimitivePort({ browserController: runtime.browserController }), clock: createSystemMouseClickClock(), idempotency: createMouseClickIdempotencyRegistry() } }),
  textInputAbilityGroup: createTextInputAbilityGroup({ context: { executionPort: createBrowserControllerTextInputExecutionPort({ browserController: runtime.browserController }), clipboardPort: createSystemClipboardPort(), clock: createSystemTextInputClock() } }),
  mouseScrollAbilityGroup: createMouseScrollAbilityGroup({ context: createMouseScrollExecutionContext({ primitivePort: createBrowserControllerMouseScrollPrimitivePort({ browserController: runtime.browserController }) }) }),
});

const createObservationRuntimes = (runtime: Omit<WorkbenchBaseRuntime, "aiAbilityGroup" | "openAbilityGroup" | "mouseClickAbilityGroup" | "textInputAbilityGroup" | "mouseScrollAbilityGroup">) => ({
  pageStateAbilityGroup: createPageStateAbilityGroup(createDefaultPageStateRuntimeContext()),
  postActionVerificationAbilityGroup: createPostActionVerificationAbilityGroup({
    clock: { portKind: "post-action-verification-clock", now: () => ({ isoTimestamp: new Date().toISOString(), monotonicMs: typeof globalThis.performance?.now === "function" ? globalThis.performance.now() : Date.now() }) },
    evidenceReadPort: {
      listObservations: (request) => request.observationSet.observations,
      getObservationByRef: (request, ref) => request.observationSet.observations.find((observation) => observation.ref === ref) ?? null,
      getEvidenceByRef: (request, ref) => [request.beforeAfterEvidence.beforeEvidence, request.beforeAfterEvidence.afterEvidence].find((evidence) => evidence?.evidenceRef === ref) ?? null,
      getActionLogByRef: (request, ref) => {
        const actionLogRef = request.actionProof.actionLogRef ?? request.actionProof.actionRecordRef;
        return actionLogRef === ref ? { actionLogRef: ref, sourceRuntimeProofRef: request.actionProof.sourceRuntimeProofRef, sourceActionResultRef: request.actionProof.sourceActionResultRef, sourceActionOutputRef: request.actionProof.sourceActionOutputRef } : null;
      },
      verifyProofRef: (request, ref) => request.actionProof.sourceRuntimeProofRef === ref || request.observationSet.observations.some((observation) => observation.source.sourceProofRef === ref) || [request.beforeAfterEvidence.beforeEvidence, request.beforeAfterEvidence.afterEvidence].some((evidence) => evidence?.source.sourceProofRef === ref),
      verifyEvidenceBinding: (request, evidenceRef) => [request.beforeAfterEvidence.beforeEvidence, request.beforeAfterEvidence.afterEvidence].some((evidence) => evidence?.evidenceRef === evidenceRef && evidence.sessionId === request.sessionId && evidence.roundId === request.roundId && evidence.videoVisitId === request.videoVisitId),
    },
  }),
  screenshotAbilityGroup: createScreenshotAbilityGroup({ capturePort: createBrowserControllerScreenshotCapturePort(runtime.browserController), artifactPort: createFilesystemScreenshotArtifactPort(path.join(runtime.evidenceStore.getDataDir(), "artifacts", "screenshot")), imageProcessingPort: createSharpScreenshotImageProcessingPort(), clockPort: createSystemScreenshotClockPort() }),
  visualTargetAbilityGroup: createVisualTargetAbilityGroup({ runtimeContext: createVisualTargetRuntimeContext({ clock: createSystemVisualTargetClock() }) }),
  geometryGuardAbilityGroup: createGeometryGuardAbilityGroup(),
});

const createAiRuntime = (
  runtime: Omit<WorkbenchBaseRuntime, "aiAbilityGroup" | "openAbilityGroup">,
) => createAiAbilityGroup({ runtime: createLocalAiRuntimePort({ emitDebugEvent: (event) => recordAiDebugEvent(runtime as WorkbenchBaseRuntime, event) }), clock: createSystemAiClock(), modelRoster: createAiModelRosterPort(), promptRegistry: createAiPromptRegistry() });

const createOpenRuntime = (runtime: WorkbenchBaseRuntime) =>
  createOpenAbilityGroup({
    browser: {
      getSessionSnapshot: async () => runtime.browserController.getSessionState(),
      open: async (openInput) => {
        const abortPromise = new Promise<never>((_, reject) => openInput.abortSignal.addEventListener("abort", () => reject(new Error("open browser adapter aborted during navigation dispatch")), { once: true }));
        const actionResult = await Promise.race([runtime.browserController.open({ url: openInput.url, title: openInput.title ?? "" }), abortPromise]);
        return { browserActionId: actionResult.browserActionId, ok: actionResult.ok, message: actionResult.message, createdAt: actionResult.createdAt, openedUrl: openInput.url, pageTitleAfter: null, redirectChain: [openInput.url], portKind: "current-chrome-browser-controller" };
      },
    },
    profilePort: {
      resolveProfileOverride: ({ childCapabilityId }) => {
        if (childCapabilityId !== "open-local-workbench") return null;
        const workbenchUrl = new URL(runtime.options.baseUrl);
        return { defaultUrl: workbenchUrl.toString(), defaultTitle: "GrassEye Local Workbench", allowedHostnames: [workbenchUrl.hostname] };
      },
    },
  });

export const createWorkbenchBaseRuntime = (
  options: GrassEyeWorkbenchOptions,
): WorkbenchBaseRuntime => {
  const dataDir = options.dataDir ?? getDefaultLocalDataDir();
  const structuredLogBus = createStructuredLogRuntime();
  const persistence = createPersistenceRuntime(dataDir, structuredLogBus);
  const browser = createBrowserRuntime(options, dataDir);
  const partialRuntime = { options, structuredLogBus, ...persistence, ...browser } as Omit<WorkbenchBaseRuntime, "aiAbilityGroup" | "openAbilityGroup" | "mouseClickAbilityGroup" | "textInputAbilityGroup" | "mouseScrollAbilityGroup" | "pageStateAbilityGroup" | "postActionVerificationAbilityGroup" | "screenshotAbilityGroup" | "visualTargetAbilityGroup" | "geometryGuardAbilityGroup">;
  const actions = createActionRuntimes(partialRuntime as Omit<WorkbenchBaseRuntime, "aiAbilityGroup" | "openAbilityGroup">);
  const observations = createObservationRuntimes({ ...partialRuntime, ...actions } as Omit<WorkbenchBaseRuntime, "aiAbilityGroup" | "openAbilityGroup">);
  const aiAbilityGroup = createAiRuntime({ ...partialRuntime, ...actions, ...observations } as Omit<WorkbenchBaseRuntime, "aiAbilityGroup" | "openAbilityGroup">);
  const runtime = { ...partialRuntime, ...actions, ...observations, aiAbilityGroup } as WorkbenchBaseRuntime;
  return { ...runtime, openAbilityGroup: createOpenRuntime(runtime) };
};