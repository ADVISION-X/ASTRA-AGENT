import { assertCapabilityCheck, createFakeBrowserController } from "../shared/capability-check-support.js";
import { createOpenTikTokCapability, DEFAULT_TIKTOK_OPEN_TITLE, DEFAULT_TIKTOK_OPEN_URL } from "./capability.js";

export async function verifyOpenTikTokCapability(): Promise<void> {
  const capability = createOpenTikTokCapability();

  const successController = createFakeBrowserController({
    currentUrlAfterOpen: DEFAULT_TIKTOK_OPEN_URL,
    pageTitleAfterOpen: DEFAULT_TIKTOK_OPEN_TITLE,
    loginStateAfterOpen: "logged_in",
  });
  const successResult = await capability.open({
    browserController: successController,
    reason: "capability-check",
    targetUrl: DEFAULT_TIKTOK_OPEN_URL,
    targetTitle: DEFAULT_TIKTOK_OPEN_TITLE,
  });
  assertCapabilityCheck(successResult.status === "success", "open-tiktok should succeed when TikTok feed opens cleanly");

  const blockedController = createFakeBrowserController({
    currentUrlAfterOpen: "https://www.tiktok.com/login",
    pageTitleAfterOpen: "Login",
    loginStateAfterOpen: "login_required",
  });
  const blockedResult = await capability.open({
    browserController: blockedController,
    reason: "capability-check",
    targetUrl: DEFAULT_TIKTOK_OPEN_URL,
    targetTitle: DEFAULT_TIKTOK_OPEN_TITLE,
  });
  assertCapabilityCheck(blockedResult.status === "failed", "open-tiktok should fail when a login wall is detected");
}