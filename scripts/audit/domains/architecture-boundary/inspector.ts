import { readdirSync } from "node:fs";

import { Node } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { getRepoSourcePath, listActiveSourceFiles } from "../../shared/source-files.js";

const allowedSrcRoots = new Set(["app", "mediator", "plugins", "capabilities", "lib", "types"]);
const allowedScriptRoots = new Set(["acceptance", "audit", "startup"]);
const plannerNames = new Set(["nextAction", "actionPlan"]);

const collectUnexpectedRoots = (rootPath: string, allowedRoots: ReadonlySet<string>): string[] =>
  readdirSync(resolveFromRepo(rootPath), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !allowedRoots.has(entry.name))
    .map((entry) => `${rootPath}/${entry.name}`)
    .sort();

const findPlannerToken = (sourceFileTextOwner: Parameters<typeof getRepoSourcePath>[0]): string | undefined => {
  const plannerNode = sourceFileTextOwner.getDescendants().find((node) => {
    if (Node.isIdentifier(node)) {
      return plannerNames.has(node.getText());
    }
    if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
      return plannerNames.has(node.getLiteralValue());
    }
    if (Node.isPropertyAssignment(node) || Node.isShorthandPropertyAssignment(node)) {
      return plannerNames.has(node.getName());
    }
    return false;
  });
  return plannerNode?.getText();
};

const pushUnexpectedRootFindings = (
  input: {
    findings: ReturnType<typeof createFinding>[];
    lawId: string;
    rootPath: string;
    allowedRoots: ReadonlySet<string>;
    checkId: "architecture/allowed-src-root" | "architecture/allowed-script-root";
    messageSuffix: string;
  },
): void => {
  for (const unexpectedRoot of collectUnexpectedRoots(input.rootPath, input.allowedRoots)) {
    input.findings.push(
      createFinding({
        checkId: input.checkId,
        lawId: input.lawId,
        filePath: unexpectedRoot,
        message: `${unexpectedRoot} ${input.messageSuffix}`,
      }),
    );
  }
};

const inspectCapabilityImports = (
  findings: ReturnType<typeof createFinding>[],
  capabilityLawId: string,
  repoPath: string,
  sourceFile: Parameters<typeof getRepoSourcePath>[0],
): void => {
  if (!repoPath.startsWith("src/capabilities/")) {
    return;
  }
  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const target = importDeclaration.getModuleSpecifierSourceFile();
    if (!target) {
      continue;
    }
    const targetPath = getRepoSourcePath(target);
    if (!targetPath.startsWith("src/plugins/")) {
      continue;
    }
    findings.push(
      createFinding({
        checkId: "architecture/capability-imports-plugin",
        lawId: capabilityLawId,
        filePath: repoPath,
        evidence: targetPath,
        message: `${repoPath} imports plugin-owned code ${targetPath}.`,
      }),
    );
  }
};

const inspectSharedImports = (
  findings: ReturnType<typeof createFinding>[],
  sharedLawId: string,
  repoPath: string,
  sourceFile: Parameters<typeof getRepoSourcePath>[0],
): void => {
  if (!repoPath.startsWith("src/lib/") || repoPath.startsWith("src/lib/local-runtime/")) {
    return;
  }
  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const target = importDeclaration.getModuleSpecifierSourceFile();
    if (!target) {
      continue;
    }
    const targetPath = getRepoSourcePath(target);
    if (!targetPath.startsWith("src/plugins/") && !targetPath.startsWith("src/capabilities/")) {
      continue;
    }
    findings.push(
      createFinding({
        checkId: "architecture/shared-owner-boundary",
        lawId: sharedLawId,
        filePath: repoPath,
        evidence: targetPath,
        message: `${repoPath} imports owner code ${targetPath} from shared infrastructure.`,
      }),
    );
  }
};

const isPlannerScope = (repoPath: string): boolean =>
  repoPath.startsWith("src/plugins/") ||
  repoPath.startsWith("src/capabilities/ai-input-gateway/") ||
  repoPath.startsWith("src/mediator/");

const inspectPlannerScope = (
  findings: ReturnType<typeof createFinding>[],
  plannerLawId: string,
  repoPath: string,
  sourceFile: Parameters<typeof getRepoSourcePath>[0],
): void => {
  if (!isPlannerScope(repoPath)) {
    return;
  }
  const plannerToken = findPlannerToken(sourceFile);
  if (!plannerToken) {
    return;
  }
  findings.push(
    createFinding({
      checkId: "architecture/ai-planner-ban",
      lawId: plannerLawId,
      filePath: repoPath,
      message: `${repoPath} contains planner token ${plannerToken}.`,
    }),
  );
};

const inspectSourceFile = (
  findings: ReturnType<typeof createFinding>[],
  inspectedFiles: Set<string>,
  sourceFile: Parameters<typeof getRepoSourcePath>[0],
  lawIds: {
    capabilityLawId: string;
    plannerLawId: string;
    sharedLawId: string;
  },
): void => {
  const repoPath = getRepoSourcePath(sourceFile);
  inspectedFiles.add(repoPath);
  inspectCapabilityImports(findings, lawIds.capabilityLawId, repoPath, sourceFile);
  inspectSharedImports(findings, lawIds.sharedLawId, repoPath, sourceFile);
  inspectPlannerScope(findings, lawIds.plannerLawId, repoPath, sourceFile);
};

const resolveArchitectureLawIds = (planEntry: InspectorContext["planEntry"]): {
  rootLawId: string;
  capabilityLawId: string;
  sharedLawId: string;
  plannerLawId: string;
} => ({
  rootLawId: selectLawId(planEntry.lawIds, "APEX-ARCH-006-V1"),
  capabilityLawId: selectLawId(planEntry.lawIds, "APEX-ARCH-004-V1"),
  sharedLawId: selectLawId(planEntry.lawIds, "APEX-ARCH-007-V1"),
  plannerLawId: selectLawId(planEntry.lawIds, "APEX-ARCH-009-V1"),
});

const inspectProjectSources = (
  project: InspectorContext["project"],
  findings: ReturnType<typeof createFinding>[],
  inspectedFiles: Set<string>,
  lawIds: {
    capabilityLawId: string;
    plannerLawId: string;
    sharedLawId: string;
  },
): void => {
  for (const sourceFile of listActiveSourceFiles(project)) {
    inspectSourceFile(findings, inspectedFiles, sourceFile, lawIds);
  }
};

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const lawIds = resolveArchitectureLawIds(context.planEntry);
  const findings: ReturnType<typeof createFinding>[] = [];
  const inspectedFiles = new Set<string>();

  pushUnexpectedRootFindings({
    findings,
    lawId: lawIds.rootLawId,
    rootPath: "src",
    allowedRoots: allowedSrcRoots,
    checkId: "architecture/allowed-src-root",
    messageSuffix: "is outside the approved src root allowlist.",
  });
  pushUnexpectedRootFindings({
    findings,
    lawId: lawIds.rootLawId,
    rootPath: "scripts",
    allowedRoots: allowedScriptRoots,
    checkId: "architecture/allowed-script-root",
    messageSuffix: "is outside the approved scripts root allowlist.",
  });

  inspectProjectSources(context.project, findings, inspectedFiles, lawIds);

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...inspectedFiles].sort(),
  };
};