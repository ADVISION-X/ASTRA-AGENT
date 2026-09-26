import { Node } from "ts-morph";

import type { InspectorContext } from "../../../shared/inspector-contracts.js";
import {
  isPluginOwnerPath,
  isPrivateCapabilityRuntimePath,
  isPublicCapabilityFacadePath as isSharedPublicCapabilityFacadePath,
} from "../../../shared/no-regex.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

export type ArchitectureSourceFile = Parameters<typeof getRepoSourcePath>[0];

export type ArchitectureLawIds = {
  singleLineLawId: string;
  rootLawId: string;
  jobFlowLawId: string;
  mediatorLawId: string;
  capabilityLawId: string;
  childAbilityLawId: string;
  sharedLawId: string;
  plannerLawId: string;
  pluginStageLawId: string;
  productionBoundaryLawId: string;
  intakeLawId: string;
  lawFirstChangeLawId: string;
  targetAuthorityLawId: string;
};

export const isPrivateCapabilityPath = isPrivateCapabilityRuntimePath;
export const isPublicCapabilityFacadePath = isSharedPublicCapabilityFacadePath;
export const isJobPluginPath = isPluginOwnerPath;

const plannerNames = new Set(["nextAction", "actionPlan"]);

export const resolveOwnerRoot = (repoPath: string, segmentIndex: number): string | undefined => {
  const segments = repoPath.split("/");
  return segments.length > segmentIndex ? `${segments[0]}/${segments[1]}/${segments[2]}` : undefined;
};

const isPlannerToken = (node: Node): boolean => {
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
};

export const findPlannerToken = (sourceFile: ArchitectureSourceFile): string | undefined =>
  sourceFile.getDescendants().find(isPlannerToken)?.getText();

export const isPlannerScope = (repoPath: string): boolean =>
  repoPath.startsWith("src/plugins/") ||
  repoPath.startsWith("src/capabilities/gpt/") ||
  repoPath.startsWith("src/mediator/");

export const resolveArchitectureLawIds = (planEntry: InspectorContext["planEntry"]): ArchitectureLawIds => {
  const lawId = planEntry.lawIds[0]!;
  const targetAuthorityLawId = planEntry.lawIds.find((candidate) =>
    candidate.startsWith("LAW-ARCHITECTURE-BOUNDARY-002-"));
  if (!targetAuthorityLawId) throw new Error("LAW-ARCHITECTURE-BOUNDARY-002 must be part of the architecture-boundary plan.");
  return {
    singleLineLawId: lawId,
    rootLawId: lawId,
    jobFlowLawId: lawId,
    mediatorLawId: lawId,
    capabilityLawId: lawId,
    childAbilityLawId: lawId,
    sharedLawId: lawId,
    plannerLawId: lawId,
    pluginStageLawId: lawId,
    productionBoundaryLawId: lawId,
    intakeLawId: lawId,
    lawFirstChangeLawId: lawId,
    targetAuthorityLawId,
  };
};
