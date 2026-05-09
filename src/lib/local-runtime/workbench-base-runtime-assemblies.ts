import { createBrowserRuntime } from "./workbench-browser-runtime.js";
import { createWorkbenchAiAbilityGroup } from "./workbench-ai-ability-group.js";
import type { WorkbenchBaseRuntime, GrassEyeWorkbenchOptions } from "./workbench-contract.js";
import { createMouseClickRuntime } from "./workbench-mouse-click-runtime.js";
import { createMouseScrollRuntime } from "./workbench-mouse-scroll-runtime.js";
import { createObservationRuntimes } from "./workbench-observation-runtime.js";
import { createOpenRuntime } from "./workbench-open-runtime.js";
import { createPersistenceRuntime } from "./workbench-persistence-runtime.js";
import { createPostActionRuntime } from "./workbench-post-action-runtime.js";
import { createTextInputRuntime } from "./workbench-text-input-runtime.js";
import { StructuredLogBus } from "./structured-log-bus.js";
import { createStructuredTerminalLogListener, isStructuredLogStdoutEnabled, resolveStructuredLogLevel } from "./structured-log-terminal.js";

type WorkbenchPartialRuntime = Omit<WorkbenchBaseRuntime, "aiAbilityGroup" | "openAbilityGroup" | "mouseClickAbilityGroup" | "textInputAbilityGroup" | "mouseScrollAbilityGroup" | "pageStateAbilityGroup" | "screenshotAbilityGroup" | "visualTargetAbilityGroup" | "geometryGuardAbilityGroup" | "postActionVerificationAbilityGroup">;

type WorkbenchRuntimeWithoutOpenAbilityGroup = Omit<WorkbenchBaseRuntime, "openAbilityGroup">;

const createStructuredLogRuntime = (): StructuredLogBus => {
  const structuredLogBus = new StructuredLogBus();
  if (isStructuredLogStdoutEnabled()) {
    structuredLogBus.subscribe(createStructuredTerminalLogListener(resolveStructuredLogLevel()));
  }
  return structuredLogBus;
};

const createWorkbenchPartialRuntime = (options: GrassEyeWorkbenchOptions, dataDir: string): WorkbenchPartialRuntime => {
  const structuredLogBus = createStructuredLogRuntime();
  const persistence = createPersistenceRuntime(dataDir, structuredLogBus);
  const browser = createBrowserRuntime(options, dataDir);
  return {
    options,
    structuredLogBus,
    ...persistence,
    ...browser,
  } as WorkbenchPartialRuntime;
};

const createWorkbenchActionRuntime = (partialRuntime: WorkbenchPartialRuntime) => ({
  ...createMouseClickRuntime(partialRuntime),
  ...createTextInputRuntime(partialRuntime),
  ...createMouseScrollRuntime(partialRuntime),
});

export const createWorkbenchRuntimeAssemblies = (
  options: GrassEyeWorkbenchOptions,
  dataDir: string,
): WorkbenchBaseRuntime => {
  const partialRuntime = createWorkbenchPartialRuntime(options, dataDir);
  const actions = createWorkbenchActionRuntime(partialRuntime);
  const observations = createObservationRuntimes(partialRuntime);
  const postAction = createPostActionRuntime();
  const aiAbilityGroup = createWorkbenchAiAbilityGroup(partialRuntime);
  const runtime = {
    ...partialRuntime,
    ...actions,
    ...observations,
    ...postAction,
    aiAbilityGroup,
  } as WorkbenchRuntimeWithoutOpenAbilityGroup;

  return {
    ...runtime,
    openAbilityGroup: createOpenRuntime(runtime as WorkbenchBaseRuntime),
  };
};