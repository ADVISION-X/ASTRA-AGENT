import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { Project } from "ts-morph";

import { loadGeneratedAuditPlan } from "../audit/core/load-audit-plan.js";
import { createInspectorCheckSession } from "../audit/shared/inspector-check-session.js";
import type { InspectorContext, InspectorFinding } from "../audit/shared/inspector-contracts.js";
import { resolveFromRepo, toRepoPath } from "../audit/shared/paths.js";

export const RUNTIME_ROOT = resolveFromRepo("tmp/audit-truth-acceptance-runtime");
export const LAW_IDS = [
  "APEX-AUDIT-TRUTH-001-V1",
  "GRASSEYE-AUDIT-META-QUALITY-AST-SYMBOL-NO-REGEX-V1",
  "APEX-AUDIT-TRUTH-002-V1",
];

export const createBindings = (lawIds: readonly string[], ownerInspectorPath: string) =>
  lawIds.map((lawId) => ({
    lawId,
    clauseId: `${lawId.toLowerCase()}-fixture-requirement`,
    evidenceMode: "static" as const,
    checkIds: ["fixture/check"],
    sourceEvidence: [{ filePath: ownerInspectorPath, symbolName: "inspectDomain" }],
  }));

export const createRuntimeProject = (caseName: string, files: Record<string, string>): { project: Project; runtimeRepoPath: string } => {
  const runtimeDir = path.join(RUNTIME_ROOT, caseName);
  rmSync(runtimeDir, { force: true, recursive: true });
  mkdirSync(runtimeDir, { recursive: true });
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(runtimeDir, relativePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content);
  }
  writeFileSync(
    path.join(runtimeDir, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          module: "ESNext",
          moduleResolution: "Bundler",
          strict: true,
          target: "ES2022",
        },
        include: ["scripts/**/*.ts"],
      },
      null,
      2,
    )}\n`,
  );
  return {
    project: new Project({ tsConfigFilePath: path.join(runtimeDir, "tsconfig.json") }),
    runtimeRepoPath: toRepoPath(runtimeDir),
  };
};

export const createContext = (
  project: Project,
  generatedPlan: InspectorContext["generatedPlan"],
): InspectorContext => {
  const planEntry = loadGeneratedAuditPlan().find((entry) => entry.capabilityDomain === "audit-truth");
  if (!planEntry) throw new Error("audit-truth plan entry is missing.");
  const controller = createInspectorCheckSession(planEntry, "acceptance-run:audit-truth-coverage");
  return {
    checks: controller.checks,
    completedReports: {},
    generatedPlan,
    planEntry,
    project,
  };
};

export const hasFinding = (
  findings: readonly InspectorFinding[],
  input: { checkId: string; fileIncludes: string },
): boolean =>
  findings.some(
    (finding) => finding.checkId === input.checkId && finding.filePath?.includes(input.fileIncludes),
  );
