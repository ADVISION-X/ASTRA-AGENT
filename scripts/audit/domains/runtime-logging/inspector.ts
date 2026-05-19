import { getAuditProject } from "../../core/ts-morph.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { runAiRuntimeLogChecks } from "./runtime-log-ai-checks.js";
import { runRuntimeLogBoundaryChecks } from "./runtime-log-boundary-checks.js";
import { runRuntimeLogFoundationChecks } from "./runtime-log-foundation-checks.js";
import type { RuntimeLoggingInspectorResult, RlogCheck } from "./runtime-log-types.js";

export type { RuntimeLoggingInspectorResult, RlogCheck, RlogStatus } from "./runtime-log-types.js";

export function runRuntimeLoggingInspector(): RuntimeLoggingInspectorResult {
  const project = getAuditProject();
  project.addSourceFilesFromTsConfig(pathFromRepoRoot("tsconfig.json"));

  const checks: RlogCheck[] = [
    ...runRuntimeLogFoundationChecks(project),
    ...runAiRuntimeLogChecks(project),
    ...runRuntimeLogBoundaryChecks(project),
  ];
  const hardFails = checks.filter((check) => check.status === "FAIL").length;
  return { checks, hardFails, pass: hardFails === 0 };
}
