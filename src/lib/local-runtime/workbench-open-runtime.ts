import { createOpenAbilityGroup } from "../../capabilities/open/index.js";
import type { WorkbenchBaseRuntime } from "./workbench-contract.js";

export const createOpenRuntime = (runtime: WorkbenchBaseRuntime) =>
  createOpenAbilityGroup({
    browser: {
      getSessionSnapshot: async () => runtime.browserController.getSessionState(),
      open: async (openInput) => {
        const abortPromise = new Promise<never>((_, reject) => openInput.abortSignal.addEventListener("abort", () => reject(new Error("open browser adapter aborted during navigation dispatch")), { once: true }));
        const actionResult = await Promise.race([runtime.browserController.open({ url: openInput.url, title: openInput.title ?? "" }), abortPromise]);
        return {
          browserActionId: actionResult.browserActionId,
          ok: actionResult.ok,
          message: actionResult.message,
          createdAt: actionResult.createdAt,
          openedUrl: openInput.url,
          pageTitleAfter: null,
          redirectChain: [openInput.url],
          portKind: "current-chrome-browser-controller",
        };
      },
    },
    profilePort: {
      resolveProfileOverride: ({ childCapabilityId }) => {
        if (childCapabilityId !== "open-local-workbench") return null;
        const workbenchUrl = new URL(runtime.options.baseUrl);
        return {
          defaultUrl: workbenchUrl.toString(),
          defaultTitle: "GrassEye Local Workbench",
          allowedHostnames: [workbenchUrl.hostname],
        };
      },
    },
  });