import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { FacebookLogCoverageLaw, FACEBOOK_MINING_OWNER_FILES, type FacebookLogCoverageFinding } from "./constants.js";
import { collectAstTokenCoverage, hasAstToken, hasAstTokenPart } from "./facebook-mining-ast-token-coverage.js";

const recoveryTokens = ["fallback", "retry", "restore", "recover", "focusExistingFacebookVideoTab", "closeCommentSurface", "ArrowDown", "scroll", "reopen"] as const;
const requiredTokens = ["recoveryTrail", "action", "status", "reason", "durationMs", "beforeHash", "afterHash"] as const;

export const collectFacebookMiningRecoveryLogCoverage = (context: InspectorContext): {
  findings: FacebookLogCoverageFinding[];
  inspectedFiles: string[];
} => {
  const findings: FacebookLogCoverageFinding[] = [];
  for (const file of FACEBOOK_MINING_OWNER_FILES) {
    const coverage = collectAstTokenCoverage(context, [file]);
    if (!recoveryTokens.some((token) => hasAstTokenPart(coverage, token))) {
      continue;
    }
    const missing = requiredTokens.filter((token) => !hasAstToken(coverage, token));
    if (missing.length === 0) {
      continue;
    }
    findings.push({
      checkId: "facebook-log-coverage/recovery-trail",
      lawId: FacebookLogCoverageLaw.RECOVERY_TRAIL,
      file,
      line: coverage.firstLine,
      severity: "fatal",
      message: "Facebook recovery path lacks recoveryTrail logging",
      hint: `Add recovery events linked to the original failure. Missing: ${missing.join(", ")}.`,
    });
  }
  return { findings, inspectedFiles: [...FACEBOOK_MINING_OWNER_FILES] };
};
