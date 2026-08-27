import { Node } from "ts-morph";

import { selectLawId } from "../../../shared/finding-utils.js";
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

export const resolveArchitectureLawIds = (planEntry: InspectorContext["planEntry"]): ArchitectureLawIds => ({
  singleLineLawId: selectLawId(planEntry.lawIds, "LAW-ARCHITECTURE-BOUNDARY-001-V1"),
  rootLawId: selectLawId(planEntry.lawIds, "LAW-ARCHITECTURE-BOUNDARY-001-V1"),
  jobFlowLawId: selectLawId(planEntry.lawIds, "LAW-ARCHITECTURE-BOUNDARY-001-V1"),
  mediatorLawId: selectLawId(planEntry.lawIds, "LAW-ARCHITECTURE-BOUNDARY-001-V1"),
  capabilityLawId: selectLawId(planEntry.lawIds, "LAW-ARCHITECTURE-BOUNDARY-001-V1"),
  childAbilityLawId: selectLawId(planEntry.lawIds, "LAW-ARCHITECTURE-BOUNDARY-001-V1"),
  sharedLawId: selectLawId(planEntry.lawIds, "LAW-ARCHITECTURE-BOUNDARY-001-V1"),
  plannerLawId: selectLawId(planEntry.lawIds, "LAW-ARCHITECTURE-BOUNDARY-001-V1"),
  pluginStageLawId: selectLawId(planEntry.lawIds, "LAW-ARCHITECTURE-BOUNDARY-001-V1"),
  productionBoundaryLawId: selectLawId(planEntry.lawIds, "LAW-ARCHITECTURE-BOUNDARY-001-V1"),
  intakeLawId: selectLawId(planEntry.lawIds, "LAW-ARCHITECTURE-BOUNDARY-001-V1"),
  lawFirstChangeLawId: selectLawId(planEntry.lawIds, "LAW-ARCHITECTURE-BOUNDARY-001-V1"),
});
