import { createTextInputAbilityGroupWithPorts } from "../../capabilities/text-input/runtime/text-input-ability-group-factory.js";
import { createBrowserControllerTextInputRuntimePorts } from "../browser/text-input-runtime-ports.js";

export const createTextInputRuntime = (runtime: {
  browserController: Parameters<typeof createBrowserControllerTextInputRuntimePorts>[0]["browserController"];
}) => ({
  textInputAbilityGroup: createTextInputAbilityGroupWithPorts({
    ...createBrowserControllerTextInputRuntimePorts({ browserController: runtime.browserController }),
  }),
});