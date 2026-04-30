import { createMouseScrollAbilityGroupWithPrimitivePort } from "../../capabilities/mouse-scroll/runtime/mouse-scroll-ability-group-factory.js";
import { createBrowserControllerMouseScrollPrimitivePort } from "../browser/mouse-scroll-primitive-port.js";

export const createMouseScrollRuntime = (runtime: {
  browserController: Parameters<typeof createBrowserControllerMouseScrollPrimitivePort>[0]["browserController"];
}) => ({
  mouseScrollAbilityGroup: createMouseScrollAbilityGroupWithPrimitivePort({
      primitivePort: createBrowserControllerMouseScrollPrimitivePort({ browserController: runtime.browserController }),
  }),
});