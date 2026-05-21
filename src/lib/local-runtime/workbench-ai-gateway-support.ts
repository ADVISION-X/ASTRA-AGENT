import { createAiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import type { BrowserController } from "../browser/browser-controller.js";

export function createWorkbenchAiInputGateway(
  dataDir: string,
  browserController: BrowserController,
) {
  return createAiInputGatewayAbilityGroup({ dataDir }, browserController);
}