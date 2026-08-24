import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type {
  InspectorContext,
  InspectorFinding,
} from "../../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../../shared/paths.js";

const lifecyclePath = "src/plugins/xuanxue-ai-production/xuanxue-ai-production-transient-lifecycle.ts";
const workerPath = "src/plugins/xuanxue-ai-production/xuanxue-ai-production-cloud-worker.ts";

const calls = (file: SourceFile | undefined): Set<string> => new Set(
  file?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .map((call) => call.getExpression().getText()) ?? [],
);

export const inspectTransientLifecycleBehavior = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const lifecycle = context.project.getSourceFile(resolveFromRepo(lifecyclePath));
  const worker = context.project.getSourceFile(resolveFromRepo(workerPath));
  const lifecycleCalls = calls(lifecycle);
  const workerCalls = calls(worker);
  const required = [
    [lifecycle, lifecycleCalls.has("rm"), "single cleanup owner must remove derived inputs"],
    [lifecycle, lifecycleCalls.has("readdir"), "restart reconciliation must enumerate derived-input directories"],
    [worker, workerCalls.has("reconcileXuanxueAiProductionGeneratedInputOrphans"), "cloud worker must invoke restart reconciliation"],
  ] as const;
  for (const [file, passed, message] of required) {
    if (file && passed) continue;
    findings.push(createFinding({
      lawId,
      clauseId: "apex-xuanxue-001-v6-session-bound-cloud-pull",
      checkId: "xuanxue-ai-production/transient-material-lifecycle-behavior",
      filePath: file ? file.getFilePath() : lifecyclePath,
      message,
    }));
  }
};
