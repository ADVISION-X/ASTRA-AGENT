import { getDefaultLocalDataDir } from "./default-data-dir.js";
import { createAiRuntime } from "./workbench-ai-runtime.js";
import { createBrowserRuntime } from "./workbench-browser-runtime.js";
import type { WorkbenchBaseRuntime, GrassEyeWorkbenchOptions } from "./workbench-contract.js";
import { createMouseClickRuntime } from "./workbench-mouse-click-runtime.js";
import { createMouseScrollRuntime } from "./workbench-mouse-scroll-runtime.js";
import { createObservationRuntimes } from "./workbench-observation-runtime.js";
import { createOpenRuntime } from "./workbench-open-runtime.js";
import { createPersistenceRuntime } from "./workbench-persistence-runtime.js";
import { createTextInputRuntime } from "./workbench-text-input-runtime.js";
import { createStructuredTerminalLogListener, isStructuredLogStdoutEnabled, resolveStructuredLogLevel, StructuredLogBus } from "./structured-log-bus.js";

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
  const dataDir = options.dataDir ?? getDefaultLocalDataDir();
  const structuredLogBus = createStructuredLogRuntime();
  const persistence = createPersistenceRuntime(dataDir, structuredLogBus);
  const browser = createBrowserRuntime(options, dataDir);
  const partialRuntime = { options, structuredLogBus, ...persistence, ...browser } as Omit<WorkbenchBaseRuntime, "aiAbilityGroup" | "openAbilityGroup" | "mouseClickAbilityGroup" | "textInputAbilityGroup" | "mouseScrollAbilityGroup" | "pageStateAbilityGroup" | "postActionVerificationAbilityGroup" | "screenshotAbilityGroup" | "visualTargetAbilityGroup" | "geometryGuardAbilityGroup">;
  const actions = {
    ...createMouseClickRuntime(partialRuntime),
    ...createTextInputRuntime(partialRuntime),
    ...createMouseScrollRuntime(partialRuntime),
  };
  const observations = createObservationRuntimes(partialRuntime);
  const aiAbilityGroup = createAiRuntime({ ...partialRuntime, ...observations });
  const runtime = { ...partialRuntime, ...actions, ...observations, aiAbilityGroup } as Omit<WorkbenchBaseRuntime, "openAbilityGroup">;
  return { ...runtime, openAbilityGroup: createOpenRuntime(runtime as WorkbenchBaseRuntime) };
};