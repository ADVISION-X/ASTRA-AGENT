import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { FacebookLogCoverageLaw, type FacebookLogCoverageFinding } from "./constants.js";
import { collectAstTokenCoverage, hasAstToken } from "./facebook-mining-ast-token-coverage.js";

const aiFiles = [
  "src/plugins/facebook-product-video-mining/facebook-product-video-mining.ai-judge.ts",
  "src/capabilities/ai-input-gateway/ability-group.ts",
  "src/capabilities/ai-input-gateway/runtime/feed-provider-once.ts",
] as const;

const requiredTokens = [
  "FACEBOOK_AI_UPLOAD",
  "FACEBOOK_AI_RESPONSE_WAIT",
  "FACEBOOK_AI_PARSE",
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

export const collectFacebookMiningAiLogCoverage = (context: InspectorContext): {
  findings: FacebookLogCoverageFinding[];
  inspectedFiles: string[];
} => {
  const coverage = collectAstTokenCoverage(context, aiFiles);
  const missing = requiredTokens.filter((token) => !hasAstToken(coverage, token));
  const findings: FacebookLogCoverageFinding[] = missing.length === 0 ? [] : [{
    checkId: "facebook-log-coverage/ai-contract",
    lawId: FacebookLogCoverageLaw.AI_CONTRACT,
    file: aiFiles[0],
    line: coverage.firstLine,
    severity: "fatal",
    message: "Facebook AI judgment path lacks upload/response/parse trace logs",
    hint: `Add AI upload, response wait and parse stage logs with provider proof, rawOutputRef/hash and schema validation status. Missing: ${missing.join(", ")}.`,
  }];
  return { findings, inspectedFiles: [...aiFiles] };
};
