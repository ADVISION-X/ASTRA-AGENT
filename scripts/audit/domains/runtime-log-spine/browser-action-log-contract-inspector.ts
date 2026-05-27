import type { InspectorContext } from "../../shared/inspector-contracts.js";
import { containsAny, containsAnyCaseInsensitive } from "../../shared/no-regex.js";
import { RuntimeLogSpineLaw, type RuntimeLogSpineFinding } from "./constants.js";
import { listRuntimeSourceFiles } from "./file-walk.js";
import { hasRuntimeLogSignal } from "./runtime-log-scope.js";
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
    exclude: (repoPath) => repoPath.startsWith("src/plugins/") && !containsAnyCaseInsensitive(repoPath, ["navigation", "not-interested", "comments"]),
  });
  for (const file of files) {
    const actionLike = containsAny(file.text, [".open(", ".evaluateActiveTab(", ".textInput(", ".scroll(", ".click(", ".fill(", ".upload("])
      || containsAnyCaseInsensitive(file.path, ["navigation", "dom", "browser", "selector", "candidate"]);
    if (!actionLike) continue;
    if (!hasRuntimeLogSignal(file.text)) continue;
    const missing = requiredBrowserTokens.filter((token) => !file.text.includes(token));
    if (missing.length === 0) continue;
    findings.push({
      checkId: "runtime-log-spine/browser-action-log-contract",
      lawId: RuntimeLogSpineLaw.BROWSER_ACTION_CONTRACT,
      file: file.path,
      line: findLine(file.text, [".open(", ".evaluateActiveTab(", ".textInput(", ".scroll(", ".click(", ".fill(", ".upload("]),
      severity: "fatal",
      message: "browser or DOM action lacks before/action/after observability",
      hint: `Add browser action log contract with beforeHash, action attempt, afterHash and failureClass. Missing: ${missing.join(", ")}.`,
    });
  }
  return { findings, inspectedFiles: files.map((file) => file.path) };
};
