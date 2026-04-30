import { createMouseClickAbilityGroupWithPrimitivePort } from "../../capabilities/mouse-click/runtime/mouse-click-ability-group-factory.js";
import { createBrowserControllerMouseClickPrimitivePort } from "../browser/mouse-click-primitive-port.js";

export const createMouseClickRuntime = (runtime: {
  browserController: Parameters<typeof createBrowserControllerMouseClickPrimitivePort>[0]["browserController"];
}) => ({
  mouseClickAbilityGroup: createMouseClickAbilityGroupWithPrimitivePort({
      primitivePort: createBrowserControllerMouseClickPrimitivePort({ browserController: runtime.browserController }),
  }),
});