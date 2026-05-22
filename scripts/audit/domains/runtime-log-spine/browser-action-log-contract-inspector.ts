import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { RuntimeLogSpineLaw, type RuntimeLogSpineFinding } from "./constants.js";
import { listRuntimeSourceFiles } from "./file-walk.js";
import { findLine } from "./source-read.js";

const requiredBrowserTokens = [
  "before",
  "after",
  "action",
  "durationMs",
  "failureClass",
  "fallback",
] as const;

export const collectBrowserActionLogContractFindings = (_context: InspectorContext): {
  findings: RuntimeLogSpineFinding[];
  inspectedFiles: string[];
} => {
  const findings: RuntimeLogSpineFinding[] = [];
  const files = listRuntimeSourceFiles({
    roots: ["src/lib/browser", "src/capabilities/dom-automation", "src/plugins"],
    exclude: (repoPath) => repoPath.startsWith("src/plugins/") && !/(navigation|not-interested|comments)/iu.test(repoPath),
  });
  for (const file of files) {
    const actionLike = /\.(?:open|evaluateActiveTab|textInput|scroll|click|fill|upload)\s*\(/u.test(file.text)
      || /\b(?:navigation|dom|browser|selector|candidate)\b/iu.test(file.path);
    if (!actionLike) continue;
    const missing = requiredBrowserTokens.filter((token) => !file.text.includes(token));
    if (missing.length === 0) continue;
    findings.push({
      checkId: "runtime-log-spine/browser-action-log-contract",
      lawId: RuntimeLogSpineLaw.BROWSER_ACTION_CONTRACT,
      file: file.path,
      line: findLine(file.text, /\.(?:open|evaluateActiveTab|textInput|scroll|click|fill|upload)\s*\(/u),
      severity: "fatal",
      message: "browser or DOM action lacks before/action/after observability",
      hint: `Add browser action log contract with beforeHash, action attempt, afterHash and failureClass. Missing: ${missing.join(", ")}.`,
    });
  }
  return { findings, inspectedFiles: files.map((file) => file.path) };
};
