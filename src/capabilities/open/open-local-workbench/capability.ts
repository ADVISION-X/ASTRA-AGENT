import type { OpenCapability, OpenCapabilityInput } from "../contract.js";
import { executeBrowserOpenCapability } from "../shared/browser-open-support.js";

export const DEFAULT_LOCAL_WORKBENCH_TITLE = "GrassEye Local Workbench";

export function createOpenLocalWorkbenchCapability(): OpenCapability {
  return {
    drawer: "open",
    childCapabilityId: "open-local-workbench",
    targetKind: "local-workbench",
    open(input: OpenCapabilityInput) {
      return executeBrowserOpenCapability({
        childCapabilityId: "open-local-workbench",
        targetKind: "local-workbench",
        browserController: input.browserController,
        targetUrl: input.targetUrl,
        targetTitle: input.targetTitle,
        roundId: input.roundId ?? null,
      });
    },
  };
}