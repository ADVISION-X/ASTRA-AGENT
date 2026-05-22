import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { RuntimeLogSpineLaw, type RuntimeLogSpineFinding } from "./constants.js";
import { listRuntimeSourceFiles } from "./file-walk.js";
import { findLine } from "./source-read.js";

const requiredAiTokens = [
  "providerKind",
  "modelName",
  "promptHash",
  "inputRefs",
  "expectedOutputSchemaRef",
  "timeoutMs",
  "rawOutputRef",
  "rawOutputHash",
  "parseStatus",
  "schemaValidationStatus",
] as const;

export const collectAiLogContractFindings = (_context: InspectorContext): {
  findings: RuntimeLogSpineFinding[];
  inspectedFiles: string[];
} => {
  const findings: RuntimeLogSpineFinding[] = [];
  const files = listRuntimeSourceFiles({
    roots: ["src/capabilities/ai-input-gateway", "src/plugins"],
    exclude: (repoPath) => repoPath.startsWith("src/plugins/") && !/ai/i.test(repoPath),
  });
  for (const file of files) {
    const aiLike = /ai|provider|feed|prompt|rawOutput|parse/i.test(file.path + file.text);
    if (!aiLike) continue;
    const missing = requiredAiTokens.filter((token) => !file.text.includes(token));
    if (missing.length === 0) continue;
    findings.push({
      checkId: "runtime-log-spine/ai-log-contract",
      lawId: RuntimeLogSpineLaw.AI_CONTRACT,
      file: file.path,
      line: findLine(file.text, /ai|provider|feed|prompt|parse/iu),
      severity: "fatal",
      message: "AI request/response/parse path lacks required observability contract",
      hint: `Add AI_REQUEST/AI_UPLOAD/AI_RESPONSE/AI_PARSE logs with refs, hashes, parse status and provider proof. Missing: ${missing.join(", ")}.`,
    });
  }
  return { findings, inspectedFiles: files.map((file) => file.path) };
};
