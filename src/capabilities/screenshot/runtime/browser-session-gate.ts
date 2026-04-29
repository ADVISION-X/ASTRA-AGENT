import type { ScreenshotAbilityContext, ScreenshotChildRegistryEntry, ScreenshotBrowserSessionSnapshot } from "../contract.js";
import { createScreenshotFailure } from "../shared/screenshot-failure.js";

export async function runBrowserSessionGate(input: {
  registryEntry: ScreenshotChildRegistryEntry;
  context: ScreenshotAbilityContext;
}): Promise<{
  decision: { status: "passed" | "failed" | "review_required" | "not_applicable"; reason: string | null };
  sessionSnapshot: ScreenshotBrowserSessionSnapshot | null;
  browserSessionRef: string | null;
  failure: ReturnType<typeof createScreenshotFailure> | null;
}> {
  if (!input.registryEntry.requiresBrowserSession) {
    return {
      decision: { status: "not_applicable", reason: null },
      sessionSnapshot: null,
      browserSessionRef: null,
      failure: null,
    };
  }

  try {
    const sessionSnapshot = await input.context.capturePort.getBrowserSessionSnapshot();
    if (sessionSnapshot.browserMode !== "real_chrome_persistent") {
      return {
        decision: { status: "failed", reason: "real_chrome_session_required" },
        sessionSnapshot,
        browserSessionRef: `${sessionSnapshot.browserProfileRef}:${sessionSnapshot.currentUrl}`,
        failure: createScreenshotFailure({
          code: "browser_session_invalid",
          message: "Screenshot browser capture requires a real Chrome persistent session.",
        }),
      };
    }
    if (sessionSnapshot.profileStatus !== "profile_ready" && sessionSnapshot.profileStatus !== "logged_in") {
      return {
        decision: { status: "review_required", reason: "browser_profile_not_ready" },
        sessionSnapshot,
        browserSessionRef: `${sessionSnapshot.browserProfileRef}:${sessionSnapshot.currentUrl}`,
        failure: createScreenshotFailure({
          code: "browser_session_invalid",
          message: "Screenshot browser session is not in profile_ready state.",
          detail: sessionSnapshot.profileStatus,
        }),
      };
    }
    return {
      decision: { status: "passed", reason: null },
      sessionSnapshot,
      browserSessionRef: `${sessionSnapshot.browserProfileRef}:${sessionSnapshot.currentUrl}`,
      failure: null,
    };
  } catch (error) {
    return {
      decision: { status: "review_required", reason: "browser_session_read_failed" },
      sessionSnapshot: null,
      browserSessionRef: null,
      failure: createScreenshotFailure({
        code: "browser_session_invalid",
        message: "Screenshot failed to read browser session snapshot.",
        detail: error instanceof Error ? error.message : String(error),
      }),
    };
  }
}
