import { createAiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import type { BrowserController } from "../browser/browser-controller.js";
import type { RuntimeLogger } from "../runtime-logs/index.js";

export function createWorkbenchAiInputGateway(
  dataDir: string,
  browserController: BrowserController,
  runtimeLogger: RuntimeLogger,
) {
  return createAiInputGatewayAbilityGroup({ dataDir, runtimeLogger }, browserController);
}
