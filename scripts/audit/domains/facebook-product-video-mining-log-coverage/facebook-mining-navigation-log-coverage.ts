import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { FacebookLogCoverageLaw, type FacebookLogCoverageFinding } from "./constants.js";
import { collectAstTokenCoverage, hasAstToken } from "./facebook-mining-ast-token-coverage.js";

const navigationFiles = [
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.navigation.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.navigation-scripts.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.navigation-support.ts",
] as const;

const requiredTokens = [
  "FACEBOOK_NAVIGATION_NEXT",
  "FACEBOOK_VERIFY_NEXT_STABLE",
  "beforeSignatureHash",
  "afterSignatureHash",
  "beforeVideoKey",
  "afterVideoKey",
  "changedSignals",
  "actionStrategy",
  "fallbackUsed",
  "recoveryTrail",
  "durationMs",
] as const;

export const collectFacebookMiningNavigationLogCoverage = (context: InspectorContext): {
  findings: FacebookLogCoverageFinding[];
  inspectedFiles: string[];
} => {
  const coverage = collectAstTokenCoverage(context, navigationFiles);
  const missing = requiredTokens.filter((token) => !hasAstToken(coverage, token));
  const findings: FacebookLogCoverageFinding[] = missing.length === 0 ? [] : [{
    checkId: "facebook-log-coverage/navigation-contract",
    lawId: FacebookLogCoverageLaw.NAVIGATION_CONTRACT,
    file: navigationFiles[0],
    line: coverage.firstLine,
    severity: "fatal",
    message: "Facebook next navigation lacks before/action/after trace contract",
    hint: `Log before signature, action/fallback trail, after signature and stable verification result. Missing: ${missing.join(", ")}.`,
  }];
  return { findings, inspectedFiles: [...navigationFiles] };
};
