import { createWorkbenchMouseScrollAbilityGroup } from "./workbench-mouse-scroll-ability-group.js";
import { createBrowserControllerMouseScrollPrimitivePort } from "../browser/mouse-scroll-primitive-port.js";

export const createMouseScrollRuntime = (runtime: {
  browserController: Parameters<typeof createBrowserControllerMouseScrollPrimitivePort>[0]["browserController"];
}) => ({
  mouseScrollAbilityGroup: createWorkbenchMouseScrollAbilityGroup({
      primitivePort: createBrowserControllerMouseScrollPrimitivePort({ browserController: runtime.browserController }),
  }),
});