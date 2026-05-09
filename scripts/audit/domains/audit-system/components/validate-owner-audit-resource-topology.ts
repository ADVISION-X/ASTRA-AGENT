import { listFilesRecursive, readTextFile } from "../../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../../core/paths.js";
import { createAuditSystemFinding, createAuditSystemPhase } from "./audit-system-component-support.js";
import type { AuditSystemInspectionContext, AuditSystemInspectionResult } from "./audit-system-ts-morph-support.js";

type SourceText = {
  relativePath: string;
  text: string;
};

const OWNER_RUNNER = "scripts/audit/core/owner-audit-runner.ts";

const createFinding = (file: string, message: string) =>
  createAuditSystemFinding({
    file,
    line: 1,
    severity: "error",
    message,
  });

const loadAuditSources = async (): Promise<SourceText[]> => {
  const files = await listFilesRecursive(pathFromRepoRoot("scripts/audit"), { extensions: [".ts"] });
  return Promise.all(files.map(async (file) => ({
    relativePath: toRepoRelativePath(file),
    text: await readTextFile(file),
  })));
};

const isOwnerRunInspector = (source: SourceText): boolean =>
  source.relativePath.startsWith("scripts/audit/domains/")
  && source.relativePath.endsWith("/run-inspector.ts")
  && !source.relativePath.includes("/code-purity/");

const inspectRunInspector = (source: SourceText) => {
  if (!isOwnerRunInspector(source)) {
    return [];
  }
  const findings = [];
  if (!source.text.includes("runOwnerInspector")) {
    findings.push(createFinding(source.relativePath, "Owner run-inspector must call shared runOwnerInspector so artifact loading, resource logging, and negative-proof isolation stay centralized."));
  }
  if (source.text.includes("buildAuditArtifacts")) {
    findings.push(createFinding(source.relativePath, "Owner run-inspector must not build audit artifacts directly; only shared owner-audit-runner may rebuild under GRASSEYE_OWNER_BUILD_ARTIFACTS=1."));
  }
  if (source.text.includes("loadGeneratedArtifacts") || source.text.includes("createInspectorContext")) {
    findings.push(createFinding(source.relativePath, "Owner run-inspector must not hand-roll artifact/context loading; use shared owner-audit-runner for resource logging and limits."));
  }
  if (source.text.includes("runWithStandaloneHeartbeat")) {
    findings.push(createFinding(source.relativePath, "Owner run-inspector must not use standalone heartbeat wrappers; shared owner-audit-runner provides the governed execution envelope."));
  }
  return findings;
};

const inspectNegativeProofIsolation = (source: SourceText, allSources: SourceText[]) => {
  if (!isOwnerRunInspector(source) || !source.text.includes("runOwnerInspector")) {
    return [];
  }
  const domainDir = source.relativePath.slice(0, source.relativePath.lastIndexOf("/"));
  const negativeProofEntry = `${domainDir}/run-negative-proof.ts`;
  const hasSeparateNegativeProofEntry = allSources.some((candidate) => candidate.relativePath === negativeProofEntry);
  if (source.text.includes("negativeProofScript") && !source.text.includes("run-negative-proof.ts")) {
    return [createFinding(source.relativePath, "Owner negative proof must use a separate run-negative-proof.ts entrypoint instead of wiring the harness file directly.")];
  }
  const inspector = allSources.find((candidate) => candidate.relativePath === `${domainDir}/inspector.ts`);
  if (inspector?.text.includes("runNegativeProofHarness") && !hasSeparateNegativeProofEntry) {
    return [createFinding(source.relativePath, "Owner negative proof must be split into a separate run-negative-proof.ts entrypoint.")];
  }
  if (inspector?.text.includes("runNegativeProofHarness") && !source.text.includes("skipNegativeProofEnv")) {
    return [createFinding(source.relativePath, "Owner inspector imports negative proof; run-inspector must set skipNegativeProofEnv and run the harness in a child process.")];
  }
  return [];
};

const inspectAstProjectPolicy = (source: SourceText) => {
  if (!source.text.includes("skipAddingFilesFromTsConfig: false")) {
    return [];
  }
  return source.text.includes("GRASSEYE_AUDIT_ALLOW_FULL_TSCONFIG_PROJECT")
    && source.text.includes("owner:")
    && source.text.includes("reason:")
    && source.text.includes("bounded")
    ? []
    : [createFinding(source.relativePath, "Audit AST helpers must default to skipAddingFilesFromTsConfig:true; full tsconfig projects require GRASSEYE_AUDIT_ALLOW_FULL_TSCONFIG_PROJECT with owner/reason/bounded file-count documentation.")];
};

const inspectCiFull = (source: SourceText) => {
  if (source.relativePath !== "scripts/audit/ci-full.ts") {
    return [];
  }
  const findings = [];
  if (source.text.includes("Promise.all(stage.steps.map")) {
    findings.push(createFinding(source.relativePath, "ci:full must not launch owner audits through unbounded Promise.all over stage.steps."));
  }
  if (!source.text.includes("GRASSEYE_CI_FULL_MAX_CONCURRENCY") || !source.text.includes("ABILITY_GROUP_SAFE_MAX_CONCURRENCY")) {
    findings.push(createFinding(source.relativePath, "ci:full must expose bounded owner concurrency controls."));
  }
  if (!source.text.includes("readProcessTreeRssMB") && !source.text.includes("pgrep")) {
    findings.push(createFinding(source.relativePath, "ci:full resource guard must account for owner audit process trees, not only direct child PIDs."));
  }
  return findings;
};

const inspectOwnerRunner = (source: SourceText) => {
  if (source.relativePath !== OWNER_RUNNER) {
    return [];
  }
  const required = ["GRASSEYE_OWNER_AUDIT_MAX_RSS_MB", "AUDIT_RESOURCE_LIMIT_EXCEEDED", "rssMB", "heapUsedMB", "durationMs", "GRASSEYE_OWNER_BUILD_ARTIFACTS", "readProcessTreeRssMB", "process.pid"];
  return required.every((token) => source.text.includes(token))
    ? []
    : [createFinding(source.relativePath, "Shared owner-audit-runner must log resource metrics, sample the process tree, and enforce GRASSEYE_OWNER_AUDIT_MAX_RSS_MB with AUDIT_RESOURCE_LIMIT_EXCEEDED fail-fast.")];
};

const createPhase = (findingCount: number) => [
  createAuditSystemPhase(
    "owner-audit-resource-topology",
    findingCount === 0 ? "PASS" : "SCRIPT OVERREACH",
    findingCount === 0,
    findingCount === 0
      ? "Owner audit entries use shared resource-bounded runner, isolated negative proof, and bounded AST project loading."
      : "Owner audit resource topology can still rebuild, over-load AST projects, run inline negative proof, or miss resource limits.",
  ),
];

export const validateOwnerAuditResourceTopology = async (
  _context: AuditSystemInspectionContext,
): Promise<AuditSystemInspectionResult> => {
  const sources = await loadAuditSources();
  const findings = sources.flatMap((source) => [
    ...inspectRunInspector(source),
    ...inspectNegativeProofIsolation(source, sources),
    ...inspectAstProjectPolicy(source),
    ...inspectCiFull(source),
    ...inspectOwnerRunner(source),
  ]);
  return {
    findings,
    phases: createPhase(findings.length),
  };
};
