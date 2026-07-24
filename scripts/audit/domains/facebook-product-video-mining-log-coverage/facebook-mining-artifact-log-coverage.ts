import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { FacebookLogCoverageLaw, type FacebookLogCoverageFinding } from "./constants.js";
import { collectAstTokenCoverage, hasAstToken, hasAstTokenPart } from "./facebook-mining-ast-token-coverage.js";

const artifactFiles = [
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.video.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.round-outcomes.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.candidate-record.ts",
] as const;

const operationTokens = ["promote", "delete", "save", "comments", "judgment", "debug"] as const;
const requiredTokens = ["artifactRef", "sha256", "byteSize", "contentType", "disposition", "candidateId", "roundId", "runId"] as const;

export const collectFacebookMiningArtifactLogCoverage = (context: InspectorContext): {
  findings: FacebookLogCoverageFinding[];
  inspectedFiles: string[];
} => {
  const coverage = collectAstTokenCoverage(context, artifactFiles);
  const missingOperations = operationTokens.filter((token) => !hasAstTokenPart(coverage, token));
  const missingFields = requiredTokens.filter((token) => !hasAstToken(coverage, token));
  const findings: FacebookLogCoverageFinding[] = missingOperations.length === 0 && missingFields.length === 0 ? [] : [{
    checkId: "facebook-log-coverage/artifact-refs",
    lawId: FacebookLogCoverageLaw.ARTIFACT_REFS,
    file: artifactFiles[0],
    line: coverage.firstLine,
    severity: "fatal",
    message: "Facebook artifact operation lacks refs/hashes observability",
    hint: `Log artifactRef, sha256, byteSize, disposition and candidateId. Missing operations: ${missingOperations.join(", ") || "none"}; missing fields: ${missingFields.join(", ") || "none"}.`,
  }];
  return { findings, inspectedFiles: [...artifactFiles] };
};
