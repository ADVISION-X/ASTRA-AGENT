import { createAiInputGatewayAbilityGroup } from "../../capabilities/ai-input-gateway/index.js";
import type { RuntimeLogger } from "../runtime-logs/index.js";

export function createWorkbenchAiInputGateway(
  dataDir: string,
  runtimeLogger: RuntimeLogger,
) {
  return createAiInputGatewayAbilityGroup(
    { dataDir, runtimeLogger },
  );
}
