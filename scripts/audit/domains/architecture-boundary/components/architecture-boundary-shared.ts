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
  rootLawId: string;
  jobFlowLawId: string;
  mediatorLawId: string;
  capabilityLawId: string;
  childAbilityLawId: string;
  sharedLawId: string;
  plannerLawId: string;
  pluginStageLawId: string;
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
  repoPath.startsWith("src/capabilities/ai-input-gateway/") ||
  repoPath.startsWith("src/mediator/");

export const resolveArchitectureLawIds = (planEntry: InspectorContext["planEntry"]): ArchitectureLawIds => ({
  rootLawId: selectLawId(planEntry.lawIds, "APEX-ARCH-006-V1"),
  jobFlowLawId: selectLawId(planEntry.lawIds, "APEX-ARCH-003-V1"),
  mediatorLawId: selectLawId(planEntry.lawIds, "APEX-ARCH-002-V1"),
  capabilityLawId: selectLawId(planEntry.lawIds, "APEX-ARCH-004-V1"),
  childAbilityLawId: selectLawId(planEntry.lawIds, "APEX-ARCH-005-V1"),
  sharedLawId: selectLawId(planEntry.lawIds, "APEX-ARCH-007-V1"),
  plannerLawId: selectLawId(planEntry.lawIds, "APEX-ARCH-009-V1"),
  pluginStageLawId: selectLawId(planEntry.lawIds, "APEX-ARCH-011-V1"),
});
