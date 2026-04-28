import { assertCapabilityCheck, createFakeBrowserController } from "../shared/capability-check-support.js";
import { createOpenFacebookCapability, DEFAULT_FACEBOOK_OPEN_TITLE, DEFAULT_FACEBOOK_OPEN_URL } from "./capability.js";

export async function verifyOpenFacebookCapability(): Promise<void> {
  const capability = createOpenFacebookCapability();

  const successController = createFakeBrowserController({
    currentUrlAfterOpen: DEFAULT_FACEBOOK_OPEN_URL,
    pageTitleAfterOpen: DEFAULT_FACEBOOK_OPEN_TITLE,
    loginStateAfterOpen: "logged_in",
  });
  const successResult = await capability.open({
    browserController: successController,
    reason: "capability-check",
    targetUrl: DEFAULT_FACEBOOK_OPEN_URL,
    targetTitle: DEFAULT_FACEBOOK_OPEN_TITLE,
  });
  assertCapabilityCheck(successResult.status === "success", "open-facebook should succeed when Facebook reel opens cleanly");

  const blockedController = createFakeBrowserController({
    currentUrlAfterOpen: "https://www.facebook.com/login",
    pageTitleAfterOpen: "Facebook Login",
    loginStateAfterOpen: "login_required",
  });
  const blockedResult = await capability.open({
    browserController: blockedController,
    reason: "capability-check",
    targetUrl: DEFAULT_FACEBOOK_OPEN_URL,
    targetTitle: DEFAULT_FACEBOOK_OPEN_TITLE,
  });
  assertCapabilityCheck(blockedResult.status === "failed", "open-facebook should fail when a login wall is detected");
}