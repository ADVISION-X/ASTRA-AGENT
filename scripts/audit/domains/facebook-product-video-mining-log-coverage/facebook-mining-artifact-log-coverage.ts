import { existsSync, readFileSync } from "node:fs";

import { resolveFromRepo } from "../../shared/paths.js";
import { findLine } from "../runtime-log-spine/source-read.js";
import { FacebookLogCoverageLaw, type FacebookLogCoverageFinding } from "./constants.js";

const artifactFiles = [
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.video.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.round-outcomes.ts",
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.candidate-record.ts",
] as const;

const operationTokens = ["promote", "delete", "save", "comments", "judgment", "debug"] as const;
const requiredTokens = ["artifactRef", "sha256", "byteSize", "contentType", "disposition", "candidateId", "roundId", "runId"] as const;

export const collectFacebookMiningArtifactLogCoverage = (): {
  findings: FacebookLogCoverageFinding[];
  inspectedFiles: string[];
} => {
  const findings: FacebookLogCoverageFinding[] = [];
  const text = artifactFiles.map((file) => existsSync(resolveFromRepo(file)) ? readFileSync(resolveFromRepo(file), "utf8") : "").join("\n");
  const missingOperations = operationTokens.filter((token) => !new RegExp(token, "iu").test(text));
  const missingFields = requiredTokens.filter((token) => !text.includes(token));
  if (missingOperations.length > 0 || missingFields.length > 0) {
    findings.push({
      checkId: "facebook-log-coverage/artifact-refs",
      lawId: FacebookLogCoverageLaw.ARTIFACT_REFS,
      file: artifactFiles[0],
      line: findLine(text, /promote|delete|save|artifact/u),
      severity: "fatal",
      message: "Facebook artifact operation lacks refs/hashes observability",
      hint: `Log artifactRef, sha256, byteSize, disposition and candidateId. Missing operations: ${missingOperations.join(", ") || "none"}; missing fields: ${missingFields.join(", ") || "none"}.`,
    });
  }
  return { findings, inspectedFiles: [...artifactFiles] };
};
