import { SyntaxKind, type Project, type SourceFile } from "ts-morph";

import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";

import type { ChildCapabilityStrengthEntry } from "./child-capability-strength-builder.js";
import type { AbilityGroupScanState } from "./child-capability-strength-owner-scan.js";
import { buildBlockingReasons, hasForensicsRecordPath, resolveStrengthLevel } from "./child-capability-strength-policy.js";

type ChildBaseEntry = Omit<ChildCapabilityStrengthEntry, "strengthLevel" | "blockingReasons">;
type ChildImplementationFacts = Pick<
  ChildCapabilityStrengthEntry,
  "hasChildImplementation" | "hasExecute" | "returnsGovernedResult" | "publicExecuteThrows"
>;
type ChildContractFlags = Pick<ChildCapabilityStrengthEntry, "hasChildContract" | "hasChildSchema">;
type BuildEntriesInput = {
  project: Project;
  state: AbilityGroupScanState;
  dispatchReferences: Map<string, Set<string>>;
  actionCodesByChildKey: Map<string, Set<string>>;
  aiActionCodesByChildKey: Map<string, Set<string>>;
};

const getSourceFile = (project: Project, relativePath: string): SourceFile | null =>
  project.getSourceFile(pathFromRepoRoot(relativePath)) ?? project.addSourceFileAtPathIfExists(pathFromRepoRoot(relativePath)) ?? null;

const getSortedActionCodes = (index: Map<string, Set<string>>, key: string): string[] =>
  [...(index.get(key) ?? new Set<string>())].sort((left, right) => left.localeCompare(right));

const resolveImplementationFacts = (implementationSource: SourceFile | null): ChildImplementationFacts => ({
  hasChildImplementation: implementationSource !== null,
  hasExecute: implementationSource ? implementationSource.getDescendantsOfKind(SyntaxKind.MethodDeclaration).some((method) => method.getName() === "execute") || implementationSource.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => property.getName() === "execute") : false,
  returnsGovernedResult: implementationSource
    ? implementationSource.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
        const expressionText = call.getExpression().getText();
        return expressionText.endsWith("Schema.parse") || /^execute[A-Z]/.test(expressionText) || /^build[A-Z].*Result/.test(expressionText) || expressionText === "executeForensicsChild";
      }) || implementationSource.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => property.getName() === "status" && ["success", "failed", "review_required"].includes(property.getInitializer()?.getText().replaceAll("\"", "").replaceAll("'", "") ?? ""))
    : false,
  publicExecuteThrows: implementationSource ? implementationSource.getDescendantsOfKind(SyntaxKind.ThrowStatement).length > 0 : false,
});

const resolveChildContractFlags = async (abilityRoot: string, childCapabilityId: string): Promise<ChildContractFlags> => ({
  hasChildContract: await fileExists(pathFromRepoRoot(`${abilityRoot}/children/${childCapabilityId}/contract.ts`)),
  hasChildSchema: await fileExists(pathFromRepoRoot(`${abilityRoot}/children/${childCapabilityId}/schema.ts`)),
});

const buildChildBaseEntry = async (
  input: BuildEntriesInput,
  childCapabilityId: string,
): Promise<ChildBaseEntry> => {
  const { project, state, dispatchReferences, actionCodesByChildKey, aiActionCodesByChildKey } = input;
  const implementationSource = getSourceFile(project, `${state.abilityRoot}/children/${childCapabilityId}/implementation.ts`);
  const implementationFacts = resolveImplementationFacts(implementationSource);
  const contractFlags = await resolveChildContractFlags(state.abilityRoot, childCapabilityId);
  const key = `${state.abilityGroupId}:${childCapabilityId}`;
  const actionCodes = getSortedActionCodes(actionCodesByChildKey, key);
  const aiActionCodes = getSortedActionCodes(aiActionCodesByChildKey, key);
  return {
    abilityGroupId: state.abilityGroupId,
    childCapabilityId,
    declaredInContract: contractFlags.hasChildContract,
    declaredInSchema: state.schemaIds.has(childCapabilityId),
    registered: state.registryIds.has(childCapabilityId),
    ...contractFlags,
    ...implementationFacts,
    hasNerveBusDispatchBuilder: dispatchReferences.has(childCapabilityId),
    hasCapabilityCatalogEntry: state.registryIds.has(childCapabilityId),
    hasMuscleMemoryAction: actionCodes.length > 0,
    allowedForAiActionPlan: aiActionCodes.length > 0,
    hasForensicsRecordPath: hasForensicsRecordPath(state.abilityGroupId, childCapabilityId, dispatchReferences),
    actionCodes,
    aiActionCodes,
  };
};

const buildChildEntry = async (
  input: BuildEntriesInput,
  childCapabilityId: string,
): Promise<ChildCapabilityStrengthEntry> => {
  const baseEntry = await buildChildBaseEntry(input, childCapabilityId);
  return {
    ...baseEntry,
    strengthLevel: resolveStrengthLevel(baseEntry),
    blockingReasons: buildBlockingReasons(baseEntry),
  };
};

export const buildAbilityGroupEntries = async (input: BuildEntriesInput): Promise<ChildCapabilityStrengthEntry[]> =>
  Promise.all(input.state.childIds.map((childCapabilityId) => buildChildEntry(input, childCapabilityId)));