import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { FacebookLogCoverageLaw, FACEBOOK_MINING_OWNER_FILES, type FacebookLogCoverageFinding } from "./constants.js";
import { collectAstTokenCoverage, hasAstToken, hasAstTokenPart } from "./facebook-mining-ast-token-coverage.js";

const failureTokens = [
  "failed",
  "review_required",
  "skipped",
  "terminal",
  "handleProbeFailure",
  "handleDownloadFailure",
  "handleJudgmentFailure",
  "next_video_did_not_change",
  "source_tab_not_found",
] as const;
const requiredTokens = ["failureClass", "reason", "recoveryPolicy", "terminal"] as const;

export const collectFacebookMiningFailureCoverage = (context: InspectorContext): {
  findings: FacebookLogCoverageFinding[];
  inspectedFiles: string[];
} => {
  const findings: FacebookLogCoverageFinding[] = [];
  for (const file of FACEBOOK_MINING_OWNER_FILES) {
    const coverage = collectAstTokenCoverage(context, [file]);
    if (!failureTokens.some((token) => hasAstTokenPart(coverage, token))) {
      continue;
    }
    const missing = requiredTokens.filter((token) => !hasAstToken(coverage, token));
    if (missing.length === 0) {
      continue;
    }
    findings.push({
      checkId: "facebook-log-coverage/failure-contract",
      lawId: FacebookLogCoverageLaw.FAILURE_CLASS,
      file,
      line: coverage.firstLine,
      severity: "fatal",
      message: "Facebook mining failure path lacks failureClass contract",
      hint: `Classify this path with the governed failure contract. Missing: ${missing.join(", ")}.`,
    });
  }
  return { findings, inspectedFiles: [...FACEBOOK_MINING_OWNER_FILES] };
};
