import { Node, SyntaxKind } from "ts-morph";

import { collectDynamicImportProblems } from "../../../shared/source-module-targets.js";
import type { InventoryFindingCollector } from "./code-purity-finding-collector.js";
import type { GovernedFile } from "./code-purity-governed-files.js";
import type { ZombieModuleGraph, ZombieReachability } from "./zombie-module-graph.js";
import type { ZombieNamespaceUsageReport } from "./zombie-namespace-usage.js";
import type { ZombieBarrelLaunderingSurface } from "./zombie-reexport-trace.js";
import { pushZombieFinding } from "./zombie-surface-shared.js";

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
      remediation: "Replace the namespace dynamic usage with explicit property reads backed by final symbol consumers.",
      message: `${governedFile.repoPath} uses namespace dynamic access ${dynamicUsage.sourceText} without property-level proof.`,
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
  moduleGraph: ZombieModuleGraph;
  namespaceUsage: ZombieNamespaceUsageReport;
  reachability: ZombieReachability;
}): number => {
  let findingCount = 0;
  findingCount += pushNamespaceDynamicUsageFindings(input);
  findingCount += pushDynamicImportProblemFindings({
    collector: input.collector,
    dynamicImportLawId: input.dynamicImportLawId,
    governedFiles: input.governedFiles,
    reachableFiles: input.reachability.reachableFiles,
  });

  for (const surface of input.barrelLaunderingSurfaces) {
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
