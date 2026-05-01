import { createWorkbenchMouseClickAbilityGroup } from "./workbench-mouse-click-ability-group.js";
import { createBrowserControllerMouseClickPrimitivePort } from "../browser/mouse-click-primitive-port.js";

export const createMouseClickRuntime = (runtime: {
  browserController: Parameters<typeof createBrowserControllerMouseClickPrimitivePort>[0]["browserController"];
}) => ({
  mouseClickAbilityGroup: createWorkbenchMouseClickAbilityGroup({
      primitivePort: createBrowserControllerMouseClickPrimitivePort({ browserController: runtime.browserController }),
  }),
});