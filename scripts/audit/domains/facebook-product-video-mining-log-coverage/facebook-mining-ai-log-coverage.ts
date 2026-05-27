import { existsSync, readFileSync } from "node:fs";

import { resolveFromRepo } from "../../shared/paths.js";
import { findLine } from "../runtime-log-spine/source-read.js";
import { FacebookLogCoverageLaw, type FacebookLogCoverageFinding } from "./constants.js";

const aiFiles = [
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.ai-judge.ts",
  "src/capabilities/ai-input-gateway/ability-group.ts",
  "src/capabilities/ai-input-gateway/runtime/feed-provider-once.ts",
] as const;

const requiredStages = ["FACEBOOK_AI_UPLOAD", "FACEBOOK_AI_RESPONSE_WAIT", "FACEBOOK_AI_PARSE"] as const;
const requiredFields = [
  "providerKind",
  "modelName",
  "videoFileHash",
  "videoByteSize",
  "promptHash",
  "rawOutputRef",
  "rawOutputHash",
  "parseStatus",
  "schemaValidationStatus",
  "durationMs",
] as const;

export const collectFacebookMiningAiLogCoverage = (): {
  findings: FacebookLogCoverageFinding[];
  inspectedFiles: string[];
} => {
  const findings: FacebookLogCoverageFinding[] = [];
  const text = aiFiles.map((file) => existsSync(resolveFromRepo(file)) ? readFileSync(resolveFromRepo(file), "utf8") : "").join("\n");
  const missing = [...requiredStages, ...requiredFields].filter((token) => !text.includes(token));
  if (missing.length > 0) {
    findings.push({
      checkId: "facebook-log-coverage/ai-contract",
      lawId: FacebookLogCoverageLaw.AI_CONTRACT,
      file: aiFiles[0],
      line: findLine(text, ["judgeFacebookProductVideo", "buildAiFeedRequest"]),
      severity: "fatal",
      message: "Facebook AI judgment path lacks upload/response/parse trace logs",
      hint: `Add AI upload, response wait and parse stage logs with provider proof, rawOutputRef/hash and schema validation status. Missing: ${missing.join(", ")}.`,
    });
  }
  return { findings, inspectedFiles: [...aiFiles] };
};
