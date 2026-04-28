import { assertCapabilityCheck, createFakeBrowserController } from "../shared/capability-check-support.js";
import { createOpenLocalWorkbenchCapability, DEFAULT_LOCAL_WORKBENCH_TITLE } from "./capability.js";

export async function verifyOpenLocalWorkbenchCapability(): Promise<void> {
  const capability = createOpenLocalWorkbenchCapability();
  const targetUrl = "http://127.0.0.1:4173";
  const controller = createFakeBrowserController({
    currentUrlAfterOpen: `${targetUrl}/operator`,
    pageTitleAfterOpen: DEFAULT_LOCAL_WORKBENCH_TITLE,
    loginStateAfterOpen: "logged_in",
  });

  const result = await capability.open({
    browserController: controller,
    reason: "capability-check",
    targetUrl,
    targetTitle: DEFAULT_LOCAL_WORKBENCH_TITLE,
  });

  assertCapabilityCheck(result.status === "success", "open-local-workbench should succeed when the local console becomes reachable");
}