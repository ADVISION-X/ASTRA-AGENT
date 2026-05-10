import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { getNodeLine } from "../../../../core/ts-morph.js";
import { getZombieProtectedSeamForRouteStepId } from "../../../../../../src/audit-support/code-purity/protected-seams.js";
import { collectAssetFamilyCandidates } from "./zombie-catalog-assets.js";
import { collectLocalCodeZombieCandidates } from "./zombie-catalog-exports.js";
import type { ZombieCandidate, ZombieGraph } from "./zombie-scan-types.js";

const CHILD_REGISTRY_PATH_SUFFIX = "/registry.ts";
const CAPABILITY_CHILD_ROOT = "src/capabilities/";
const ROUTE_PLAN_ROOT = "src/map-plugins/route-plans/";

const getStringLiteralValue = (expression: Node | undefined): string | undefined => {
  if (!expression) {
    return undefined;
  }
  if (Node.isStringLiteral(expression) || Node.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.getLiteralText();
  }
  if (Node.isIdentifier(expression)) {
    const declaration = expression.getDefinitions()[0]?.getDeclarationNode();
    if (declaration && Node.isVariableDeclaration(declaration)) {
      return getStringLiteralValue(declaration.getInitializer());
    }
  }
  return undefined;
};

const mergeCandidate = (candidates: Map<string, ZombieCandidate>, candidate: ZombieCandidate): void => {
  const key = `${candidate.kind}:${candidate.symbolName}:${candidate.file}`;
  if (!candidates.has(key)) {
    candidates.set(key, candidate);
  }
};

const isCapabilityRegistryFile = (relativePath: string): boolean =>
  relativePath.startsWith(CAPABILITY_CHILD_ROOT)
  && relativePath.endsWith(CHILD_REGISTRY_PATH_SUFFIX)
  && !relativePath.includes("/prompt-contracts/");

const isRoutePlanFile = (relativePath: string): boolean => relativePath.startsWith(ROUTE_PLAN_ROOT) && relativePath.endsWith(".ts");

type RegistryChildCapabilityEntry = {
  value: string;
  line: number;
  disabledPolicy: string | undefined;
};

const collectRegistryChildCapabilityEntries = (sourceFile: SourceFile): RegistryChildCapabilityEntry[] => {
  const entries: RegistryChildCapabilityEntry[] = [];

  for (const property of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
    if (property.getName() !== "childCapabilityId") {
      continue;
    }

    const value = getStringLiteralValue(property.getInitializer() ?? undefined);
    if (!value) {
      continue;
    }

    const parentObject = property.getFirstAncestorByKind(SyntaxKind.ObjectLiteralExpression);
    const disabledProperty = parentObject?.getProperty("disabledPolicy");
    const disabledPolicy = disabledProperty && Node.isPropertyAssignment(disabledProperty)
      ? getStringLiteralValue(disabledProperty.getInitializer())
      : undefined;

    entries.push({ value, line: getNodeLine(property), disabledPolicy });
  }

  return entries;
};

const buildChildCapabilityCandidate = (relativePath: string, entry: RegistryChildCapabilityEntry): ZombieCandidate => ({
  kind: "unused-child-capability",
  symbolName: entry.value,
  file: relativePath,
  line: entry.line,
  value: entry.value,
  excludedFiles: [relativePath],
  excludedPathPrefixes: [`src/capabilities/${relativePath.split("/")[2]}/children/${entry.value}/`],
  protectedSeam: null,
  recommendedAction: `Delete ${entry.value} or wire it into a lawful caller outside its child implementation bundle.`,
});

const collectChildCapabilityCandidates = (graph: ZombieGraph, candidates: Map<string, ZombieCandidate>): void => {
  for (const [relativePath, sourceFile] of graph.sourceFilesByPath.entries()) {
    if (!isCapabilityRegistryFile(relativePath)) {
      continue;
    }

    for (const entry of collectRegistryChildCapabilityEntries(sourceFile)) {
      if (entry.disabledPolicy && entry.disabledPolicy !== "enabled") {
        continue;
      }

      mergeCandidate(candidates, buildChildCapabilityCandidate(relativePath, entry));
    }
  }
};

const collectRoutePlanStepCandidates = (graph: ZombieGraph, candidates: Map<string, ZombieCandidate>): void => {
  for (const [relativePath, sourceFile] of graph.sourceFilesByPath.entries()) {
    if (!isRoutePlanFile(relativePath)) {
      continue;
    }

    for (const property of sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
      if (property.getName() !== "stepId") {
        continue;
      }

      const value = getStringLiteralValue(property.getInitializer() ?? undefined);
      if (!value) {
        continue;
      }

      const protectedSeam = getZombieProtectedSeamForRouteStepId(value);
      if (protectedSeam) {
        continue;
      }

      mergeCandidate(candidates, {
        kind: "unused-route-plan-step",
        symbolName: value,
        file: relativePath,
        line: getNodeLine(property),
        value,
        excludedFiles: [relativePath],
        excludedPathPrefixes: [],
        protectedSeam: null,
        recommendedAction: `Wire ${value} into a lawful transition or delete the dormant route step.`,
      });
    }
  }
};

export const collectZombieCandidates = async (graph: ZombieGraph): Promise<ZombieCandidate[]> => {
  const candidates = new Map<string, ZombieCandidate>();

  collectChildCapabilityCandidates(graph, candidates);
  collectRoutePlanStepCandidates(graph, candidates);
  await collectAssetFamilyCandidates(graph, candidates);
  collectLocalCodeZombieCandidates(graph, candidates);

  return [...candidates.values()];
};
