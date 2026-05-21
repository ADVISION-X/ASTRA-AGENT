import type { ForensicsPersistenceAbilityGroup } from "../forensics-persistence/contract.js";
import type { ScreenshotAbilityGroup } from "../screenshot/index.js";
import type { AiAbilityGroup } from "../ai/index.js";
import type { GeometryGuardAbilityGroup } from "../geometry-guard/index.js";
import type { OpenAbilityGroup } from "../open/index.js";
import type { MouseScrollAbilityGroup } from "../mouse-scroll/contract.js";
import type { NerveBusAbilityGroup } from "../nerve-bus/contract.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import type { BrowserController } from "../../lib/browser/browser-controller.js";

export type OrchestrationChildrenContext = {
  dataDir: string;
  browserController: BrowserController;
  nerveBus: NerveBusAbilityGroup;
  forensics: ForensicsPersistenceAbilityGroup;
  screenshotAbilityGroup: ScreenshotAbilityGroup;
  aiAbilityGroup: AiAbilityGroup;
  geometryGuard: GeometryGuardAbilityGroup;
  openAbilityGroup: OpenAbilityGroup;
  mouseScrollAbilityGroup: MouseScrollAbilityGroup;
  runtimeLogger: RuntimeLogger;
};
