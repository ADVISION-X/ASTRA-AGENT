import { SyntaxKind, type Project, type SourceFile } from "ts-morph";

import { GPT_CHILD_CAPABILITY_CONTRACTS } from "../../../../../src/capabilities/gpt/contract.js";
import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath, listActiveSourceFiles } from "../../../shared/source-files.js";
import { collectResolvedModuleTargets } from "../../../shared/source-module-targets.js";

const catalogPath = "src/mediator/product-plugin-catalog.ts";
const catalogPluginPrefix = "../plugins/";
const centralAcceptancePath = "scripts/acceptance/architecture-boundary.acceptance.ts";
const neutralRuntimePath = "scripts/acceptance/product-plugin-test-runtime.ts";
const productAcceptancePrefix = "scripts/acceptance/product-plugins/";
const centralPropertyAllowlist = new Set([
  "clauses", "cwd", "encoding", "env", "evidenceMode", "locator", "observedValue",
]);
const gptChildIds = new Set<string>(Object.keys(GPT_CHILD_CAPABILITY_CONTRACTS));
const businessRecoveryDecisionContractNames = new Set([
  "nextattempt", "nextattemptdecision", "recoveryowner", "resultrevisionrearm",
  "retryafter", "retryafterseconds", "shouldretry", "stopdemand",
]);
const businessRecoveryStructure = /^(?:businessrecovery|crossattempt(?:business)?recovery)(?:adapter|coordinator|graph|helper|manager|planner|queue|scheduler|service|statemachine|store|workflow)$/u;
const forbiddenRecoveryDependency = /(?:business-recovery|cross-attempt-(?:business-)?recovery)-(?:adapter|coordinator|graph|helper|manager|planner|queue|scheduler|service|state-machine|store|workflow)(?:\.[cm]?[jt]sx?)?$/u;

type FindingContext = Readonly<{
  findings: InspectorFinding[];
  lawId: string;
}>;

const push = (input: FindingContext & Readonly<{
  checkId: string;
  evidence?: string;
  filePath: string;
  message: string;
}>): void => {
  input.findings.push(createFinding({
    evidenceMode: "static.ast",
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.filePath,
    evidence: input.evidence,
    message: input.message,
  }));
};

const pluginIdFromSourcePath = (repoPath: string): string | undefined => {
  if (!repoPath.startsWith("src/plugins/")) return undefined;
  return repoPath.split("/")[2];
};

const activePluginIds = (project: Project): readonly string[] => {
  const catalog = project.getSourceFiles().find((sourceFile) => getRepoSourcePath(sourceFile) === catalogPath);
  return [...new Set(catalog?.getImportDeclarations()
    .map((declaration) => declaration.getModuleSpecifierValue())
    .filter((specifier) => specifier.startsWith(catalogPluginPrefix))
    .map((specifier) => specifier.slice(catalogPluginPrefix.length).split("/")[0])
    .filter((pluginId): pluginId is string => Boolean(pluginId)) ?? [])].sort();
};

const owningPluginId = (repoPath: string, pluginIds: readonly string[]): string | undefined => {
  if (!repoPath.startsWith(productAcceptancePrefix)) return undefined;
  const name = repoPath.slice(productAcceptancePrefix.length);
  return pluginIds.find((pluginId) => name === `${pluginId}.acceptance.ts`
    || name.startsWith(`${pluginId}.`) || name.startsWith(`${pluginId}-`));
};

const stringLiterals = (sourceFile: SourceFile): readonly string[] => [
  ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralValue()),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral)
    .map((node) => node.getLiteralValue()),
];

const normalizedName = (value: string): string => value.toLowerCase()
  .replaceAll("_", "").replaceAll("-", "");

const centralBusinessName = (value: string): boolean => {
  const name = normalizedName(value);
  return ["prompt", "checkpoint", "recovery", "expectedresult", "reasoning", "modelprofile", "businessflow"]
    .some((term) => name.includes(term));
};

const arrayStringValues = (sourceFile: SourceFile): readonly (readonly string[])[] =>
  sourceFile.getDescendantsOfKind(SyntaxKind.ArrayLiteralExpression).map((array) =>
    array.getElements().flatMap((element) => {
      if (element.isKind(SyntaxKind.StringLiteral)
        || element.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)) return [element.getLiteralValue()];
      return [];
    }));

const inspectCentralCardinality = (input: FindingContext & Readonly<{
  filePath: string;
  sourceFile: SourceFile;
}>): void => {
  for (const call of input.sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const args = call.getArguments();
    const fixedCount = args.some((argument) => argument.isKind(SyntaxKind.NumericLiteral));
    const lengthRead = args.some((argument) => argument.isKind(SyntaxKind.PropertyAccessExpression)
      && argument.getName() === "length");
    if (!fixedCount || !lengthRead) continue;
    push({ ...input, checkId: "architecture/central-product-fixed-cardinality", evidence: call.getText(),
      message: `${input.filePath} hard-codes a discovered Product or Plugin cardinality.` });
  }
};

const inspectCentralBusinessContent = (input: FindingContext & Readonly<{
  filePath: string;
  sourceFile: SourceFile;
  strict: boolean;
}>): void => {
  for (const declaration of input.sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    const name = declaration.getName();
    const initializer = declaration.getInitializer();
    const normalized = normalizedName(name);
    if (input.strict && centralBusinessName(name)) {
      push({ ...input, checkId: "architecture/central-product-business-content", evidence: name,
        message: `${input.filePath} declares central Product business content ${name}.` });
    }
    if (!initializer?.isKind(SyntaxKind.ArrayLiteralExpression)
      || !["sequence", "flow", "steps", "children"].some((term) => normalized.includes(term))) continue;
    push({ ...input, checkId: "architecture/central-product-sequence", evidence: name,
      message: `${input.filePath} declares a central Product step or Child sequence.` });
  }
  for (const values of arrayStringValues(input.sourceFile)) {
    if (values.filter((value) => gptChildIds.has(value)).length < 2) continue;
    push({ ...input, checkId: "architecture/central-product-sequence", evidence: values.join(","),
      message: `${input.filePath} embeds a canonical GPT Child sequence.` });
  }
  if (!input.strict) return;
  inspectCentralCardinality(input);
  for (const value of stringLiterals(input.sourceFile).filter((literal) => /prompt/i.test(literal))) {
    push({ ...input, checkId: "architecture/central-product-business-content", evidence: value,
      message: `${input.filePath} embeds Product Prompt content.` });
  }
  for (const property of input.sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
    if (centralPropertyAllowlist.has(property.getName())) continue;
    push({ ...input, checkId: "architecture/central-product-business-content", evidence: property.getText(),
      message: `${input.filePath} embeds Product business, Child, checkpoint, recovery or expected-result fields.` });
  }
};

const inspectImportEdges = (input: FindingContext & Readonly<{
  acceptancePluginId: string | undefined;
  filePath: string;
  pluginIds: readonly string[];
  sourceFile: SourceFile;
  sourcePluginId: string | undefined;
}>): void => {
  for (const edge of collectResolvedModuleTargets(input.sourceFile)) {
    if (input.sourcePluginId && edge.targetPath.startsWith("scripts/acceptance/")) {
      push({ ...input, checkId: "architecture/product-imports-acceptance", evidence: edge.targetPath,
        message: `${input.filePath} imports acceptance code ${edge.targetPath}.` });
    }
    if (!input.acceptancePluginId) continue;
    const targetPluginId = pluginIdFromSourcePath(edge.targetPath);
    if (targetPluginId && targetPluginId !== input.acceptancePluginId) {
      push({ ...input, checkId: "architecture/product-acceptance-cross-plugin-import", evidence: edge.targetPath,
        message: `${input.filePath} imports another Product Plugin ${edge.targetPath}.` });
    }
    const targetAcceptanceId = owningPluginId(edge.targetPath, input.pluginIds);
    if (targetAcceptanceId && targetAcceptanceId !== input.acceptancePluginId) {
      push({ ...input, checkId: "architecture/product-acceptance-cross-product-helper", evidence: edge.targetPath,
        message: `${input.filePath} imports another Product acceptance ${edge.targetPath}.` });
    }
  }
};

const inspectProductAcceptanceIdentity = (input: FindingContext & Readonly<{
  acceptancePluginId: string | undefined;
  embeddedPluginIds: readonly string[];
  filePath: string;
}>): void => {
  if (!input.filePath.endsWith(".acceptance.ts") || !input.acceptancePluginId) return;
  if (input.embeddedPluginIds.length === 1 && input.embeddedPluginIds[0] === input.acceptancePluginId) return;
  push({ ...input, checkId: "architecture/product-acceptance-identity-drift",
    evidence: input.embeddedPluginIds.join(","),
    message: `${input.filePath} must contain only its own Product Plugin identity.` });
};

export const inspectProductAcceptanceBoundaries = (input: FindingContext & Readonly<{
  inspectedFiles: Set<string>;
  project: Project;
}>): void => {
  const pluginIds = activePluginIds(input.project);
  for (const sourceFile of listActiveSourceFiles(input.project)) {
    const filePath = getRepoSourcePath(sourceFile);
    const sourcePluginId = pluginIdFromSourcePath(filePath);
    const acceptancePluginId = owningPluginId(filePath, pluginIds);
    const shared = filePath === centralAcceptancePath || filePath === neutralRuntimePath;
    if (!sourcePluginId && !acceptancePluginId && !shared) continue;
    input.inspectedFiles.add(filePath);
    inspectImportEdges({ ...input, acceptancePluginId, filePath, pluginIds, sourceFile, sourcePluginId });
    const embeddedPluginIds = pluginIds.filter((pluginId) => stringLiterals(sourceFile).includes(pluginId));
    if (shared && embeddedPluginIds.length) {
      push({ ...input, filePath, evidence: embeddedPluginIds.join(","),
        checkId: "architecture/central-product-identity-table",
        message: `${filePath} embeds Product Plugin identities instead of discovering them.` });
    }
    if (shared) inspectCentralBusinessContent({ ...input, filePath, sourceFile,
      strict: filePath === centralAcceptancePath });
    inspectProductAcceptanceIdentity({ ...input, acceptancePluginId, embeddedPluginIds, filePath });
  }
};

const declarationName = (node: import("ts-morph").Node): string | undefined => {
  if (node.isKind(SyntaxKind.ClassDeclaration) || node.isKind(SyntaxKind.FunctionDeclaration)
    || node.isKind(SyntaxKind.InterfaceDeclaration) || node.isKind(SyntaxKind.TypeAliasDeclaration)
    || node.isKind(SyntaxKind.MethodDeclaration) || node.isKind(SyntaxKind.PropertyDeclaration)
    || node.isKind(SyntaxKind.PropertySignature) || node.isKind(SyntaxKind.VariableDeclaration)) {
    return node.getName();
  }
  return undefined;
};

export const inspectBusinessRecoveryAuthorityBoundaries = (input: FindingContext & Readonly<{
  inspectedFiles: Set<string>;
  project: Project;
}>): void => {
  for (const sourceFile of listActiveSourceFiles(input.project)) {
    const filePath = getRepoSourcePath(sourceFile);
    if (!filePath.startsWith("src/")) continue;
    input.inspectedFiles.add(filePath);
    for (const node of sourceFile.getDescendants()) {
      const name = declarationName(node);
      if (!name) continue;
      const normalized = normalizedName(name);
      if (businessRecoveryStructure.test(normalized)) {
        push({ ...input, checkId: "architecture/business-recovery-authority-resurrected",
          evidence: name, filePath,
          message: `${filePath} resurrects a non-Website cross-attempt business recovery authority as ${name}.` });
      }
      if ((filePath.startsWith("src/plugins/") || filePath.startsWith("src/capabilities/gpt/"))
        && businessRecoveryDecisionContractNames.has(normalized)) {
        push({ ...input, checkId: "architecture/product-business-recovery-decision-contract",
          evidence: name, filePath,
          message: `${filePath} exposes forbidden cross-attempt business recovery decision field ${name}.` });
      }
    }
    for (const declaration of sourceFile.getImportDeclarations()) {
      const target = declaration.getModuleSpecifierValue();
      if (!forbiddenRecoveryDependency.test(target)) continue;
      push({ ...input, checkId: "architecture/business-recovery-authority-dependency",
        evidence: target, filePath,
        message: `${filePath} depends on a forbidden cross-attempt business recovery authority module.` });
    }
  }
};
