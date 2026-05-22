import { readdirSync } from "node:fs";

import { Node } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { getRepoSourcePath, listActiveSourceFiles } from "../../shared/source-files.js";

const allowedSrcRoots = new Set(["app", "mediator", "plugins", "capabilities", "lib", "types"]);
const allowedScriptRoots = new Set(["acceptance", "audit", "startup"]);
const plannerNames = new Set(["nextAction", "actionPlan"]);
const privateCapabilityPathPattern = /^src\/capabilities\/[^/]+\/(runtime|children)\//u;
const publicCapabilityFacadePathPattern = /^src\/capabilities\/[^/]+\/index\.ts$/u;
const jobPluginPathPattern = /^src\/plugins\/[^/]+\//u;

const resolveOwnerRoot = (repoPath: string, segmentIndex: number): string | undefined => {
  const segments = repoPath.split("/");
  return segments.length > segmentIndex ? `${segments[0]}/${segments[1]}/${segments[2]}` : undefined;
};

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

  const sourceCapabilityRoot = resolveOwnerRoot(repoPath, 2);
  if (!sourceCapabilityRoot) {
    return;
  }

  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const target = importDeclaration.getModuleSpecifierSourceFile();
    if (!target) {
      continue;
    }
    const targetPath = getRepoSourcePath(target);
    if (!targetPath.startsWith("src/capabilities/")) {
      continue;
    }
    const targetCapabilityRoot = resolveOwnerRoot(targetPath, 2);
    if (!targetCapabilityRoot || targetCapabilityRoot === sourceCapabilityRoot) {
      continue;
    }
    findings.push(
      createFinding({
        checkId: "architecture/capability-cross-owner-import",
        lawId: capabilityLawId,
        filePath: repoPath,
        evidence: targetPath,
        message: `${repoPath} imports unrelated capability owner code ${targetPath}.`,
      }),
    );
  }
};

const inspectPluginImports = (
  findings: ReturnType<typeof createFinding>[],
  jobFlowLawId: string,
  repoPath: string,
  sourceFile: Parameters<typeof getRepoSourcePath>[0],
): void => {
  if (!jobPluginPathPattern.test(repoPath)) {
    return;
  }

  const sourcePluginRoot = resolveOwnerRoot(repoPath, 2);
  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const target = importDeclaration.getModuleSpecifierSourceFile();
    if (!target) {
      continue;
    }
    const targetPath = getRepoSourcePath(target);
    if (targetPath.startsWith("src/plugins/")) {
      const targetPluginRoot = resolveOwnerRoot(targetPath, 2);
      if (!targetPluginRoot || targetPluginRoot === sourcePluginRoot) {
        continue;
      }
      findings.push(
        createFinding({
          checkId: "architecture/flow-cross-job-import",
          lawId: jobFlowLawId,
          filePath: repoPath,
          evidence: targetPath,
          message: `${repoPath} imports unrelated job flow code ${targetPath}.`,
        }),
      );
      continue;
    }
    if (targetPath.startsWith("src/capabilities/") && !publicCapabilityFacadePathPattern.test(targetPath)) {
      findings.push(
        createFinding({
          checkId: "architecture/flow-non-facade-capability-import",
          lawId: jobFlowLawId,
          filePath: repoPath,
          evidence: targetPath,
          message: `${repoPath} imports non-facade capability code ${targetPath}.`,
        }),
      );
    }
  }
};

const inspectPluginRootPlacement = (
  findings: ReturnType<typeof createFinding>[],
  jobFlowLawId: string,
  repoPath: string,
): void => {
  if (!/^src\/plugins\/[^/]+\.tsx?$/u.test(repoPath)) {
    return;
  }
  findings.push(
    createFinding({
      checkId: "architecture/plugin-root-file",
      lawId: jobFlowLawId,
      filePath: repoPath,
      message: `${repoPath} is a top-level plugin file outside src/plugins/<job-id>/.`,
    }),
  );
};

const inspectMediatorImports = (
  findings: ReturnType<typeof createFinding>[],
  mediatorLawId: string,
  repoPath: string,
  sourceFile: Parameters<typeof getRepoSourcePath>[0],
): void => {
  if (!repoPath.startsWith("src/mediator/")) {
    return;
  }

  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const target = importDeclaration.getModuleSpecifierSourceFile();
    if (!target) {
      continue;
    }
    const targetPath = getRepoSourcePath(target);
    if (
      targetPath.startsWith("src/lib/browser/") ||
      targetPath.startsWith("src/capabilities/") ||
      privateCapabilityPathPattern.test(targetPath)
    ) {
      findings.push(
        createFinding({
          checkId: "architecture/mediator-runtime-import",
          lawId: mediatorLawId,
          filePath: repoPath,
          evidence: targetPath,
          message: `${repoPath} imports runtime action surface ${targetPath}.`,
        }),
      );
    }
  }
};

const inspectChildAbilityImports = (
  findings: ReturnType<typeof createFinding>[],
  childAbilityLawId: string,
  repoPath: string,
  sourceFile: Parameters<typeof getRepoSourcePath>[0],
): void => {
  if (!privateCapabilityPathPattern.test(repoPath)) {
    return;
  }

  const sourceCapabilityRoot = resolveOwnerRoot(repoPath, 2);
  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const target = importDeclaration.getModuleSpecifierSourceFile();
    if (!target) {
      continue;
    }
    const targetPath = getRepoSourcePath(target);
    if (!targetPath.startsWith("src/capabilities/")) {
      continue;
    }
    const targetCapabilityRoot = resolveOwnerRoot(targetPath, 2);
    if (!targetCapabilityRoot || targetCapabilityRoot === sourceCapabilityRoot) {
      continue;
    }
    findings.push(
      createFinding({
        checkId: "architecture/child-ability-cross-owner-import",
        lawId: childAbilityLawId,
        filePath: repoPath,
        evidence: targetPath,
        message: `${repoPath} imports unrelated capability owner code ${targetPath}.`,
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
    jobFlowLawId: string;
    mediatorLawId: string;
    capabilityLawId: string;
    childAbilityLawId: string;
    plannerLawId: string;
    sharedLawId: string;
  },
): void => {
  const repoPath = getRepoSourcePath(sourceFile);
  inspectedFiles.add(repoPath);
  inspectPluginRootPlacement(findings, lawIds.jobFlowLawId, repoPath);
  inspectPluginImports(findings, lawIds.jobFlowLawId, repoPath, sourceFile);
  inspectMediatorImports(findings, lawIds.mediatorLawId, repoPath, sourceFile);
  inspectCapabilityImports(findings, lawIds.capabilityLawId, repoPath, sourceFile);
  inspectChildAbilityImports(findings, lawIds.childAbilityLawId, repoPath, sourceFile);
  inspectSharedImports(findings, lawIds.sharedLawId, repoPath, sourceFile);
  inspectPlannerScope(findings, lawIds.plannerLawId, repoPath, sourceFile);
};

const resolveArchitectureLawIds = (planEntry: InspectorContext["planEntry"]): {
  rootLawId: string;
  jobFlowLawId: string;
  mediatorLawId: string;
  capabilityLawId: string;
  childAbilityLawId: string;
  sharedLawId: string;
  plannerLawId: string;
} => ({
  rootLawId: selectLawId(planEntry.lawIds, "APEX-ARCH-006-V1"),
  jobFlowLawId: selectLawId(planEntry.lawIds, "APEX-ARCH-003-V1"),
  mediatorLawId: selectLawId(planEntry.lawIds, "APEX-ARCH-002-V1"),
  capabilityLawId: selectLawId(planEntry.lawIds, "APEX-ARCH-004-V1"),
  childAbilityLawId: selectLawId(planEntry.lawIds, "APEX-ARCH-005-V1"),
  sharedLawId: selectLawId(planEntry.lawIds, "APEX-ARCH-007-V1"),
  plannerLawId: selectLawId(planEntry.lawIds, "APEX-ARCH-009-V1"),
});

const inspectProjectSources = (
  project: InspectorContext["project"],
  findings: ReturnType<typeof createFinding>[],
  inspectedFiles: Set<string>,
  lawIds: {
    jobFlowLawId: string;
    mediatorLawId: string;
    capabilityLawId: string;
    childAbilityLawId: string;
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