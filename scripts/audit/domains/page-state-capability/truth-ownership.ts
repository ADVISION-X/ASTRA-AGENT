import type { Project, SourceFile } from "ts-morph";

import { toRepoRelativePath } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getPageStateSources } from "./audit-project.js";

const HIGH_RISK_ROOTS = [
  "src/app",
  "src/capabilities/ai",
  "src/capabilities/open",
  "src/capabilities/orchestration",
  "src/capabilities/post-action-verification",
  "src/capabilities/screenshot",
  "src/capabilities/visual-target",
  "src/features/platform-action",
  "src/lib/browser",
  "src/lib/local-runtime",
] as const;

const TRUTH_OWNER_SUBJECT_TOKENS = [
  "pagestate",
  "feedready",
  "loginwall",
  "safetywall",
  "platformpagekind",
  "modaloverlay",
  "commentpanel",
  "pageabnormal",
  "videostable",
] as const;

const TRUTH_OWNER_ROLE_TOKENS = [
  "classifier",
  "classification",
  "truth",
  "truthhelper",
  "statesummary",
  "summaryhelper",
] as const;

const ACTION_COMPLETION_MARKERS = ["action_completion", "actioncompletion"] as const;

function toRepoPath(sourceFile: SourceFile): string {
  return toRepoRelativePath(sourceFile.getFilePath());
}

function isHighRiskExternalSource(sourceFile: SourceFile): boolean {
  const repoPath = toRepoPath(sourceFile);
  return HIGH_RISK_ROOTS.some((root) => repoPath.startsWith(`${root}/`));
}

function collectDeclaredNames(sourceFile: SourceFile): string[] {
  return [
    ...sourceFile.getFunctions().map((declaration) => declaration.getName()),
    ...sourceFile.getVariableDeclarations().map((declaration) => declaration.getName()),
    ...sourceFile.getClasses().map((declaration) => declaration.getName()),
    ...sourceFile.getInterfaces().map((declaration) => declaration.getName()),
    ...sourceFile.getTypeAliases().map((declaration) => declaration.getName()),
  ].filter((name): name is string => Boolean(name));
}

function normalizeToken(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function isTruthOwnershipName(name: string): boolean {
  const normalizedName = normalizeToken(name);
  const hasSubject = TRUTH_OWNER_SUBJECT_TOKENS.some((token) => normalizedName.includes(token));
  const hasRole = TRUTH_OWNER_ROLE_TOKENS.some((token) => normalizedName.includes(token));
  return (hasSubject && hasRole) || (normalizedName.startsWith("classify") && hasSubject);
}

function collectExternalTruthOwnershipFindings(project: Project): Finding[] {
  return project.getSourceFiles().flatMap((sourceFile) => {
    if (!isHighRiskExternalSource(sourceFile)) {
      return [];
    }

    const matchedName = collectDeclaredNames(sourceFile).find(isTruthOwnershipName);
    return matchedName
      ? [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-001-V2", file: toRepoPath(sourceFile), line: 1, severity: "fatal", message: "External owners must not declare Page State truth classifiers or truth helpers.", detail: `symbol=${matchedName}` })]
      : [];
  });
}

function hasActionCompletionMarker(sourceFile: SourceFile): boolean {
  const normalizedSource = normalizeToken(sourceFile.getFullText());
  return ACTION_COMPLETION_MARKERS.some((marker) => normalizedSource.includes(normalizeToken(marker)));
}

function collectActionCompletionProofFindings(project: Project): Finding[] {
  return getPageStateSources(project).flatMap((sourceFile) =>
    hasActionCompletionMarker(sourceFile)
      ? [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-001-V2", file: toRepoPath(sourceFile), line: 1, severity: "fatal", message: "Page State must not accept action completion as governed page-state proof." })]
      : [],
  );
}

export function runTruthOwnership(project: Project): { findings: Finding[]; phase: InspectorPhase } {
  const findings = [
    ...collectExternalTruthOwnershipFindings(project),
    ...collectActionCompletionProofFindings(project),
  ];

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase("page-state-truth-ownership", phasePassed ? "PASS" : "CODE VIOLATION", phasePassed, phasePassed ? "Page State truth ownership remains exclusive to the Page State ability group." : "Page State truth ownership drifted outside the governed boundary."),
  };
}