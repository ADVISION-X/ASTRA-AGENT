import { getDefaultPhase04LocalDataDir } from "./default-data-dir.js";
import { createBrowserRuntime } from "./workbench-browser-runtime.js";
import { createWorkbenchAiAbilityGroup } from "./workbench-ai-ability-group.js";
import type { WorkbenchBaseRuntime, GrassEyeWorkbenchOptions } from "./workbench-contract.js";
import { createMouseClickRuntime } from "./workbench-mouse-click-runtime.js";
import { createMouseScrollRuntime } from "./workbench-mouse-scroll-runtime.js";
import { createObservationRuntimes } from "./workbench-observation-runtime.js";
import { createOpenRuntime } from "./workbench-open-runtime.js";
import { createPersistenceRuntime } from "./workbench-persistence-runtime.js";
import { createTextInputRuntime } from "./workbench-text-input-runtime.js";
import { StructuredLogBus } from "./structured-log-bus.js";
import { createStructuredTerminalLogListener, isStructuredLogStdoutEnabled, resolveStructuredLogLevel } from "./structured-log-terminal.js";

const createStructuredLogRuntime = (): StructuredLogBus => {
  const structuredLogBus = new StructuredLogBus();
  if (isStructuredLogStdoutEnabled()) {
    structuredLogBus.subscribe(createStructuredTerminalLogListener(resolveStructuredLogLevel()));
  }
  return structuredLogBus;
};

export const createWorkbenchBaseRuntime = (
  options: GrassEyeWorkbenchOptions,
): WorkbenchBaseRuntime => {
  const dataDir = options.dataDir ?? getDefaultPhase04LocalDataDir();
  const normalizedOptions = options.dataDir ? options : { ...options, dataDir };
  const structuredLogBus = createStructuredLogRuntime();
  const persistence = createPersistenceRuntime(dataDir, structuredLogBus);
  const browser = createBrowserRuntime(normalizedOptions, dataDir);
  const partialRuntime = { options: normalizedOptions, structuredLogBus, ...persistence, ...browser } as Omit<WorkbenchBaseRuntime, "aiAbilityGroup" | "openAbilityGroup" | "mouseClickAbilityGroup" | "textInputAbilityGroup" | "mouseScrollAbilityGroup" | "pageStateAbilityGroup" | "postActionVerificationAbilityGroup" | "screenshotAbilityGroup" | "visualTargetAbilityGroup" | "geometryGuardAbilityGroup">;
  const actions = {
    ...createMouseClickRuntime(partialRuntime),
    ...createTextInputRuntime(partialRuntime),
    ...createMouseScrollRuntime(partialRuntime),
  };
  const observations = createObservationRuntimes(partialRuntime);
  const aiAbilityGroup = createWorkbenchAiAbilityGroup(partialRuntime);
  const runtime = { ...partialRuntime, ...actions, ...observations, aiAbilityGroup } as Omit<WorkbenchBaseRuntime, "openAbilityGroup">;
  return { ...runtime, openAbilityGroup: createOpenRuntime(runtime as WorkbenchBaseRuntime) };
};