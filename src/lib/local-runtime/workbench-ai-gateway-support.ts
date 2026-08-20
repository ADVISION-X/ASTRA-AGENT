import { createAiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import type { BrowserTargetLease } from "../browser/browser-authority-api.js";
import type { RuntimeLogger } from "../runtime-logs/index.js";

export function createWorkbenchAiInputGateway(
  dataDir: string,
  browser: BrowserTargetLease | null,
  runtimeLogger: RuntimeLogger,
) {
  return createAiInputGatewayAbilityGroup(
    { dataDir, runtimeLogger },
    browser ?? undefined,
  );
}
