import { existsSync, readFileSync } from "node:fs";

import { Node, SyntaxKind } from "ts-morph";

import { astIdentifierName } from "../../../shared/ast-node-identity.js";
import type { InspectorContext } from "../../../shared/inspector-contracts.js";
import { collectDynamicImportProblems } from "../../../shared/source-module-targets.js";
import { resolveFromRepo } from "../../../shared/paths.js";
import type { InventoryFindingCollector } from "./code-purity-finding-collector.js";
import type { GovernedFile } from "./code-purity-governed-files.js";
import type { ZombieModuleGraph, ZombieReachability } from "./zombie-module-graph.js";
import type { ZombieNamespaceUsageReport } from "./zombie-namespace-usage.js";
import type { ZombieBarrelLaunderingSurface } from "./zombie-reexport-trace.js";
import {
  isLawfulManifestEntryExport,
  type ZombieExemptionManifest,
} from "./zombie-exemption-manifest.js";
import { pushZombieFinding } from "./zombie-surface-shared.js";

const readPackageScripts = (): Record<string, string> => {
  const parsed = JSON.parse(readFileSync(resolveFromRepo("package.json"), "utf8")) as {
    scripts?: Record<string, string>;
  };
  return parsed.scripts ?? {};
};

const resolvesTo = (node: import("ts-morph").Node | undefined, declaration: import("ts-morph").Node): boolean => {
  const symbol = node?.getSymbol();
  return (symbol?.getDeclarations().includes(declaration) ?? false)
    || (symbol?.getAliasedSymbol()?.getDeclarations().includes(declaration) ?? false);
};

const resolvesToImport = (
  node: import("ts-morph").Node,
  importedName: string,
  moduleSpecifier: string,
): boolean => {
  const declarations = [
    ...(node.getSymbol()?.getDeclarations() ?? []),
    ...(node.getSymbol()?.getAliasedSymbol()?.getDeclarations() ?? []),
  ];
  return declarations.some((declaration) => Node.isImportSpecifier(declaration)
    && declaration.getName() === importedName
    && declaration.getImportDeclaration().getModuleSpecifierValue() === moduleSpecifier);
};

const findGeneratedPlanModuleUrlDeclaration = (
  governedFile: GovernedFile,
  argumentStart: number,
): import("ts-morph").VariableDeclaration | undefined => {
  if (governedFile.repoPath !== "scripts/audit/core/run-generated-plan.ts") return undefined;
  const importCall = governedFile.sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((call) => call.getExpression().getKind() === SyntaxKind.ImportKeyword
      && call.getArguments()[0]?.getStart() === argumentStart);
  const moduleUrlIdentifier = importCall?.getArguments()[0];
  return moduleUrlIdentifier && Node.isIdentifier(moduleUrlIdentifier)
    ? moduleUrlIdentifier.getSymbol()?.getDeclarations().find(Node.isVariableDeclaration)
    : undefined;
};

const resolveOwnerPathAccess = (
  moduleUrlDeclaration: import("ts-morph").VariableDeclaration,
): import("ts-morph").PropertyAccessExpression | undefined => {
  const hrefAccess = moduleUrlDeclaration.getInitializer();
  if (!hrefAccess || !Node.isPropertyAccessExpression(hrefAccess) || hrefAccess.getName() !== "href") return undefined;
  const pathToFileUrlCall = hrefAccess.getExpression();
  if (!Node.isCallExpression(pathToFileUrlCall)
    || !resolvesToImport(pathToFileUrlCall.getExpression(), "pathToFileURL", "node:url")) return undefined;
  const resolveCall = pathToFileUrlCall.getArguments()[0];
  if (!resolveCall || !Node.isCallExpression(resolveCall)
    || !resolvesToImport(resolveCall.getExpression(), "resolveFromRepo", "../shared/paths.js")) return undefined;
  const ownerPath = resolveCall.getArguments()[0];
  return ownerPath && Node.isPropertyAccessExpression(ownerPath)
    && ownerPath.getName() === "ownerInspectorPath" ? ownerPath : undefined;
};

const isGeneratedPlanOwnerImportContract = (
  governedFile: GovernedFile,
  argumentStart: number,
): boolean => {
  const moduleUrlDeclaration = findGeneratedPlanModuleUrlDeclaration(governedFile, argumentStart);
  if (!moduleUrlDeclaration) return false;
  const ownerPath = resolveOwnerPathAccess(moduleUrlDeclaration);
  if (!ownerPath) return false;
  const planEntry = ownerPath.getExpression();
  if (!Node.isIdentifier(planEntry) || astIdentifierName(planEntry) !== "planEntry") return false;
  return planEntry.getSymbol()?.getDeclarations().some((declaration) =>
    Node.isParameterDeclaration(declaration)
    && declaration.getFirstAncestor(Node.isFunctionLikeDeclaration) === moduleUrlDeclaration.getFirstAncestor(Node.isFunctionLikeDeclaration))
    ?? false;
};

const zombieAcceptanceIsInPhysicalSkeleton = (context: InspectorContext): boolean => {
  const bindingSource = context.project.getSourceFile(resolveFromRepo("scripts/audit/ci-acceptance-law-bindings.ts"));
  const leafPlanSource = context.project.getSourceFile(resolveFromRepo("scripts/audit/ci-acceptance-leaf-plan.ts"));
  const bindingMap = bindingSource?.getVariableDeclaration("acceptanceLawBindings");
  const bindingExists = bindingMap?.getInitializer()?.getDescendantsOfKind(SyntaxKind.ArrayLiteralExpression)
    .some((array) => {
      const [path] = array.getElements();
      return Node.isStringLiteral(path)
        && path.getLiteralValue() === "scripts/acceptance/code-purity-zombie-deep.acceptance.ts";
    }) ?? false;
  const importedBinding = leafPlanSource?.getImportDeclarations()
    .find((declaration) => declaration.getModuleSpecifierValue() === "./ci-acceptance-law-bindings.js")
    ?.getNamedImports().find((specifier) => specifier.getName() === "acceptanceLawBindings");
  const skeletonBuilder = leafPlanSource?.getVariableDeclaration("buildAcceptancePackageSkeletons")
    ?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const skeletonBindings = skeletonBuilder?.getParameters()[1];
  const closure = leafPlanSource?.getVariableDeclaration("assertAcceptanceBindingClosure");
  const closureBindings = closure?.getInitializerIfKind(SyntaxKind.ArrowFunction)?.getParameters()[1];
  const keyCall = closure?.getInitializer()?.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => {
    const callee = call.getExpression();
    return Node.isPropertyAccessExpression(callee) && callee.getName() === "has"
      && closureBindings !== undefined && resolvesTo(callee.getExpression(), closureBindings);
  });
  const closureCall = skeletonBuilder?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((call) => closure !== undefined && resolvesTo(call.getExpression(), closure));
  const defaultBindingIsImported = skeletonBindings !== undefined && importedBinding !== undefined
    && resolvesTo(skeletonBindings.getInitializer(), importedBinding);
  const skeletonBindingIsPassed = closureCall?.getArguments().some((argument) =>
    skeletonBindings !== undefined && resolvesTo(argument, skeletonBindings)) ?? false;
  return bindingExists && keyCall !== undefined && closureCall !== undefined
    && defaultBindingIsImported && skeletonBindingIsPassed;
};

const pushVoidKeepaliveFindings = (
  collector: InventoryFindingCollector,
  governedFiles: readonly GovernedFile[],
  reachableFiles: ReadonlySet<string>,
  antiEvasionLawId: string,
): number => {
  let findingCount = 0;
  for (const governedFile of governedFiles) {
    if (!reachableFiles.has(governedFile.repoPath)) {
      continue;
    }
    for (const voidExpression of governedFile.sourceFile.getDescendantsOfKind(SyntaxKind.VoidExpression)) {
      const expression = voidExpression.getExpression();
      if (!Node.isIdentifier(expression) && !Node.isPropertyAccessExpression(expression)) {
        continue;
      }
      pushZombieFinding(collector, {
        checkId: "code-purity/void-keepalive-evasion",
        governedFile,
        lawId: antiEvasionLawId,
        reason: `Void expression ${voidExpression.getText()} looks like a keepalive escape instead of real usage proof.`,
        remediation: "Delete the void keepalive escape and reconnect the symbol through real runtime or type usage.",
        message: `${governedFile.repoPath} uses ${voidExpression.getText()} as a keepalive-looking escape.`,
      });
      findingCount += 1;
    }
  }
  return findingCount;
};

const pushNamespaceDynamicUsageFindings = (input: {
  antiEvasionLawId: string;
  collector: InventoryFindingCollector;
  moduleGraph: ZombieModuleGraph;
  namespaceUsage: ZombieNamespaceUsageReport;
}): number => {
  let findingCount = 0;
  for (const dynamicUsage of input.namespaceUsage.dynamicUsages) {
    const governedFile = input.moduleGraph.filesByPath.get(dynamicUsage.consumerFilePath);
    if (!governedFile) {
      continue;
    }
    pushZombieFinding(input.collector, {
      checkId: "code-purity/namespace-dynamic-usage",
      governedFile,
      lawId: input.antiEvasionLawId,
      reason: `Namespace import reads ${dynamicUsage.sourceText} without property-level proof of which export is live.`,
      remediation: "Replace the namespace dynamic usage with explicit property reads or add a lawful dynamic namespace manifest exemption.",
      message: `${governedFile.repoPath} uses namespace dynamic access ${dynamicUsage.sourceText} without lawful exemption.`,
    });
    findingCount += 1;
  }
  return findingCount;
};

const pushBlockedDynamicImportFindings = (input: {
  collector: InventoryFindingCollector;
  dynamicImportLawId: string;
  moduleGraph: ZombieModuleGraph;
  reachability: ZombieReachability;
}): number => {
  let findingCount = 0;
  for (const blockedDynamicImport of input.reachability.blockedDynamicImports) {
    const governedFile = input.moduleGraph.filesByPath.get(blockedDynamicImport.sourcePath);
    if (!governedFile) {
      continue;
    }
    pushZombieFinding(input.collector, {
      checkId: "code-purity/dynamic-import-without-manifest",
      governedFile,
      lawId: input.dynamicImportLawId,
      reason: `Dynamic import to ${blockedDynamicImport.targetPath} is not declared in the lawful live entry manifest.`,
      remediation: "Make the import static or declare the dynamic entry in the lawful zombie exemption manifest.",
      message: `${governedFile.repoPath} dynamically imports ${blockedDynamicImport.targetPath} without lawful manifest proof.`,
    });
    findingCount += 1;
  }
  return findingCount;
};

const pushBlockedSideEffectImportFindings = (input: {
  collector: InventoryFindingCollector;
  moduleGraph: ZombieModuleGraph;
  reachability: ZombieReachability;
  sideEffectImportLawId: string;
}): number => {
  let findingCount = 0;
  for (const blockedSideEffectImport of input.reachability.blockedSideEffectImports) {
    const governedFile = input.moduleGraph.filesByPath.get(blockedSideEffectImport.sourcePath);
    if (!governedFile) {
      continue;
    }
    pushZombieFinding(input.collector, {
      checkId: "code-purity/side-effect-import-without-manifest",
      governedFile,
      lawId: input.sideEffectImportLawId,
      reason: `Side-effect import to ${blockedSideEffectImport.targetPath} is not declared in the lawful live entry manifest.`,
      remediation: "Delete the side-effect import, convert it to a lawful static import, or declare the side-effect edge explicitly in the manifest.",
      message: `${governedFile.repoPath} side-effect imports ${blockedSideEffectImport.targetPath} without lawful manifest proof.`,
    });
    findingCount += 1;
  }
  return findingCount;
};

const pushDynamicImportProblemFindings = (input: {
  collector: InventoryFindingCollector;
  dynamicImportLawId: string;
  governedFiles: readonly GovernedFile[];
  reachableFiles: ReadonlySet<string>;
}): number => {
  let findingCount = 0;
  for (const governedFile of input.governedFiles) {
    if (!input.reachableFiles.has(governedFile.repoPath)) {
      continue;
    }
    for (const problem of collectDynamicImportProblems(governedFile.sourceFile)) {
      if (isGeneratedPlanOwnerImportContract(governedFile, problem.argumentStart)) {
        continue;
      }
      const argumentKind = SyntaxKind[problem.argumentKind];
      pushZombieFinding(input.collector, {
        checkId: "code-purity/dynamic-import-nonliteral",
        governedFile,
        lawId: input.dynamicImportLawId,
        reason: `Dynamic import uses non-literal ${argumentKind} specifier; owner and liveness truth cannot be proven from runtime-computed targets.`,
        remediation: "Replace the computed dynamic import with a literal import target or an explicit owner-local loader map.",
        message: `${governedFile.repoPath} uses non-literal dynamic import at ${problem.line}:${problem.column}.`,
      });
      findingCount += 1;
    }
  }
  return findingCount;
};

export const scanZombieAntiEvasion = (input: {
  antiEvasionLawId: string;
  dynamicImportLawId: string;
  barrelLaunderingSurfaces: readonly ZombieBarrelLaunderingSurface[];
  collector: InventoryFindingCollector;
  governedFiles: readonly GovernedFile[];
  manifest: ZombieExemptionManifest;
  moduleGraph: ZombieModuleGraph;
  namespaceUsage: ZombieNamespaceUsageReport;
  reachability: ZombieReachability;
  sideEffectImportLawId: string;
}): number => {
  let findingCount = 0;
  findingCount += pushNamespaceDynamicUsageFindings(input);
  findingCount += pushBlockedDynamicImportFindings(input);
  findingCount += pushBlockedSideEffectImportFindings(input);
  findingCount += pushDynamicImportProblemFindings({
    collector: input.collector,
    dynamicImportLawId: input.dynamicImportLawId,
    governedFiles: input.governedFiles,
    reachableFiles: input.reachability.reachableFiles,
  });

  for (const surface of input.barrelLaunderingSurfaces) {
    if (isLawfulManifestEntryExport(
      input.manifest,
      surface.exportingFile,
      surface.exportName,
    )) {
      continue;
    }
    const governedFile = input.moduleGraph.filesByPath.get(surface.exportingFile);
    if (!governedFile) {
      continue;
    }
    pushZombieFinding(input.collector, {
      checkId: "code-purity/barrel-reexport-laundering",
      declarationKind: "re-export",
      governedFile,
      lawId: input.antiEvasionLawId,
      reason: `Barrel re-export ${surface.exportName} forwards ${surface.declaringFile} without any final reachable consumer.`,
      remediation: "Delete the unused re-export or reconnect a real final consumer for the symbol.",
      symbolName: surface.exportName,
      usageKind: "re-export",
      message: `${governedFile.repoPath} re-exports ${surface.exportName} without any final reachable consumer.`,
    });
    findingCount += 1;
  }

  findingCount += pushVoidKeepaliveFindings(
    input.collector,
    input.governedFiles,
    input.reachability.reachableFiles,
    input.antiEvasionLawId,
  );

  return findingCount;
};

export const scanZombieInspectorSelfProof = (input: {
  antiEvasionLawId: string;
  collector: InventoryFindingCollector;
  context: InspectorContext;
  inspectedFileCount: number;
}): number => {
  const selfProofProblems: string[] = [];
  const phaseRunnerSource = input.context.project.getSourceFile(resolveFromRepo("scripts/audit/domains/code-purity/components/code-purity-phase-runner.ts"));
  const zombieSurfaceSource = input.context.project.getSourceFile(resolveFromRepo("scripts/audit/domains/code-purity/components/scan-zombie-surfaces.ts"));
  const scripts = readPackageScripts();

  if (!zombieSurfaceSource?.getImportDeclarations().some((declaration) => declaration.getModuleSpecifierValue() === "./zombie-symbol-graph.js")) {
    selfProofProblems.push("scan-zombie-surfaces.ts does not import the symbol graph implementation.");
  }
  if (zombieSurfaceSource?.getImportDeclarations().some((declaration) => declaration.getModuleSpecifierValue() === "./zombie-surface-shared.js" && declaration.getNamedImports().some((namedImport) => namedImport.getName() === "buildZombieGraph"))) {
    selfProofProblems.push("scan-zombie-surfaces.ts still depends on the shallow buildZombieGraph path.");
  }
  if (!phaseRunnerSource?.getImportDeclarations().some((declaration) => declaration.getModuleSpecifierValue() === "./scan-code-purity-no-regex.js")) {
    selfProofProblems.push("code-purity phase runner does not wire the no-regex scanner.");
  }
  if (scripts["acceptance:code-purity-zombie-deep"] === undefined) {
    selfProofProblems.push("package.json is missing acceptance:code-purity-zombie-deep.");
  }
  if (!zombieAcceptanceIsInPhysicalSkeleton(input.context)) {
    selfProofProblems.push("ci-full runner does not execute acceptance:code-purity-zombie-deep.");
  }
  if (!input.context.planEntry.lawIds.includes("APEX-CODE-PURITY-017-V1") || !input.context.planEntry.lawIds.includes("APEX-CODE-PURITY-018-V1")) {
    selfProofProblems.push("code-purity planEntry lawIds do not include both APEX-CODE-PURITY-017-V1 and APEX-CODE-PURITY-018-V1.");
  }
  if (input.inspectedFileCount === 0) {
    selfProofProblems.push("code-purity inspectedFiles is empty.");
  }
  if (!existsSync(resolveFromRepo("scripts/acceptance/code-purity-zombie-deep.acceptance.ts")) || !existsSync(resolveFromRepo("scripts/acceptance/fixtures/code-purity-zombie-deep"))) {
    selfProofProblems.push("code-purity zombie deep acceptance fixture or acceptance entry is missing.");
  }

  if (selfProofProblems.length === 0) {
    return 0;
  }

  input.collector.push(
    {
      checkId: "code-purity/zombie-inspector-self-proof",
      filePath: "scripts/audit/domains/code-purity/components/scan-zombie-surfaces.ts",
      lawId: input.antiEvasionLawId,
      owner: "audit:code-purity",
      reason: selfProofProblems.join(" | "),
      remediation: "Wire symbol graph, no-regex, deep acceptance, and ci-full self-proof before claiming zombie inspector readiness.",
      role: "audit-phase",
      verificationCommand: "npm run ci:full",
    },
    "Code-purity zombie inspector self-proof is incomplete.",
  );
  return 1;
};
