import { existsSync, readFileSync } from "node:fs";

import { resolveFromRepo } from "../../shared/paths.js";
import { findLine } from "../runtime-log-spine/source-read.js";
import { FacebookLogCoverageLaw, type FacebookLogCoverageFinding } from "./constants.js";

const navigationFiles = [
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.navigation.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.navigation-scripts.ts",
] as const;

const requiredTokens = [
  "FACEBOOK_NAVIGATION_NEXT",
  "FACEBOOK_VERIFY_NEXT_STABLE",
  "beforeSignatureHash",
  "afterSignatureHash",
  "beforeVideoKey",
  "afterVideoKey",
  "changed",
  "actionStrategy",
  "fallbackUsed",
  "recoveryTrail",
  "durationMs",
] as const;

export const collectFacebookMiningNavigationLogCoverage = (): {
  findings: FacebookLogCoverageFinding[];
  inspectedFiles: string[];
} => {
  const text = navigationFiles.map((file) => existsSync(resolveFromRepo(file)) ? readFileSync(resolveFromRepo(file), "utf8") : "").join("\n");
  const missing = requiredTokens.filter((token) => !text.includes(token));
  const findings: FacebookLogCoverageFinding[] = missing.length === 0 ? [] : [{
    checkId: "facebook-log-coverage/navigation-contract",
    lawId: FacebookLogCoverageLaw.NAVIGATION_CONTRACT,
    file: navigationFiles[0],
    line: findLine(text, "navigateToNextFacebookVideo"),
    severity: "fatal",
    message: "Facebook next navigation lacks before/action/after trace contract",
    hint: `Log before signature, action/fallback trail, after signature and stable verification result. Missing: ${missing.join(", ")}.`,
  }];
  return { findings, inspectedFiles: [...navigationFiles] };
};
