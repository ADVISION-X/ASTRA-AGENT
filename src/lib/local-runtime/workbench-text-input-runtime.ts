import { createWorkbenchTextInputAbilityGroup } from "./workbench-text-input-ability-group.js";
import { createBrowserControllerTextInputRuntimePorts } from "../browser/text-input-runtime-ports.js";

export const createTextInputRuntime = (runtime: {
  browserController: Parameters<typeof createBrowserControllerTextInputRuntimePorts>[0]["browserController"];
}) => ({
  textInputAbilityGroup: createWorkbenchTextInputAbilityGroup({
    ...createBrowserControllerTextInputRuntimePorts({ browserController: runtime.browserController }),
  }),
});