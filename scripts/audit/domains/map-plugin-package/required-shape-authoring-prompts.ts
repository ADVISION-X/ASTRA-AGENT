import { Node, SyntaxKind, type Expression, type Project } from "ts-morph";

import { buildCapabilityCatalog } from "../../../../src/map-plugins/authoring/capability-catalog/index.js";

import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";
import { getSource } from "./audit-project.js";
import { MAP_PLUGIN_LAWS, MAP_PLUGIN_PATHS } from "./constants.js";

const { ROOT } = MAP_PLUGIN_PATHS;

const AUTHORING_TEMPLATE_PATH = `${ROOT}/authoring/map-authoring-template.ts`;
const AUTHORING_GOVERNED_CATALOGS_PATH = `${ROOT}/authoring/map-authoring-governed-catalogs.ts`;
const AUTHORING_PROMPT_BUILDER_PATH = `${ROOT}/authoring/map-authoring-prompt-builder.ts`;
const AUTHORING_DRAFT_CHAIN_PATH = `${ROOT}/authoring/map-authoring-draft-chain.ts`;
const EXTERNAL_PROVIDER_RUNTIME_MESSAGES_PATH = "src/capabilities/ai/runtime-adapters/external-provider-runtime-messages.ts";

const KNOWN_CAPABILITY_ROUTE_LITERALS = Array.from(
  new Set(
    buildCapabilityCatalog().entries.map((entry) => `${entry.abilityGroupId}/${entry.childCapabilityId}`),
  ),
);

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hasQuotedLiteral = (sourceText: string, literal: string): boolean => {
  const escapedLiteral = escapeRegExp(literal);
  return new RegExp(`["'\`][^"'\`]*${escapedLiteral}[^"'\`]*["'\`]`).test(sourceText);
};

const collectAuthoringTemplateCatalogAssemblyFindings = (
  templateSource: ReturnType<typeof getSource>,
): Finding[] => {
  return hasCallExpression(templateSource, "buildCapabilityCatalog") || hasCallExpression(templateSource, "listPromptContractCatalogEntries")
    ? [createFinding({ lawId: MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE, file: AUTHORING_TEMPLATE_PATH, line: 1, severity: "fatal", message: "Map authoring prompt template must consume governed catalog input and must not assemble catalog truth internally." })]
    : [];
};

const collectAuthoringTemplateLiteralFindings = (sourceText: string): Finding[] => {
  const hardcodedCapabilityLiteral = KNOWN_CAPABILITY_ROUTE_LITERALS.find((literal) => hasQuotedLiteral(sourceText, literal));

  return hardcodedCapabilityLiteral
    ? [createFinding({ lawId: MAP_PLUGIN_LAWS.CAPABILITY_CATALOG_DETAIL, file: AUTHORING_TEMPLATE_PATH, line: 1, severity: "fatal", message: `Map authoring prompt template must not hardcode catalog literal ${hardcodedCapabilityLiteral}.` })]
    : [];
};

const getTemplateArray = (templateSource: ReturnType<typeof getSource>) => {
  const templateDeclaration = templateSource.getVariableDeclaration("buildMapAuthoringTemplate");
  const templateInitializer = templateDeclaration?.getInitializer();
  const joinCall = templateInitializer && Node.isArrowFunction(templateInitializer)
    ? templateInitializer.getDescendantsOfKind(SyntaxKind.ReturnStatement)[0]?.getExpression()
    : undefined;

  if (!joinCall || !Node.isCallExpression(joinCall)) {
    return undefined;
  }

  const joinExpression = joinCall.getExpression();
  if (!Node.isPropertyAccessExpression(joinExpression) || joinExpression.getName() !== "join") {
    return undefined;
  }

  const arrayExpression = joinExpression.getExpression();
  return Node.isArrayLiteralExpression(arrayExpression)
    ? arrayExpression
    : undefined;
};

const collectAuthoringTemplateSectionFindings = (templateSource: ReturnType<typeof getSource>): Finding[] => {
  const templateArray = getTemplateArray(templateSource);
  if (!templateArray) {
    return [createFinding({ lawId: MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE, file: AUTHORING_TEMPLATE_PATH, line: 1, severity: "fatal", message: "Map authoring prompt template must keep its top-level section assembly parseable for governed catalog enforcement." })];
  }

  const elements = templateArray.getElements();
  const completeInputPackageIndex = elements.findIndex((element: Expression) => Node.isStringLiteral(element) && element.getLiteralValue() === "Complete Map Authoring Input Package JSON:");
  const outputRequirementsIndex = elements.findIndex((element: Expression) => Node.isStringLiteral(element) && element.getLiteralValue() === "Output Requirements:");
  const inputPackageSectionElements = completeInputPackageIndex >= 0 && outputRequirementsIndex > completeInputPackageIndex
    ? elements.slice(completeInputPackageIndex + 1, outputRequirementsIndex)
    : [];
  const inputPackageJsonIsGoverned = inputPackageSectionElements.length === 1
    && Node.isCallExpression(inputPackageSectionElements[0])
    && inputPackageSectionElements[0].getExpression().getText() === "JSON.stringify";

  return inputPackageJsonIsGoverned
    ? []
    : [createFinding({ lawId: MAP_PLUGIN_LAWS.CAPABILITY_CATALOG_DETAIL, file: AUTHORING_TEMPLATE_PATH, line: 1, severity: "fatal", message: "Map authoring prompt template must use the complete Map Authoring Input Package JSON as the only catalog truth source." })];
};

const inspectAuthoringTemplateSingleTruth = (project: Project): Finding[] => {
  const templateSource = getSource(project, AUTHORING_TEMPLATE_PATH);
  const sourceText = templateSource.getFullText();
  return [
    ...collectAuthoringTemplateCatalogAssemblyFindings(templateSource),
    ...collectAuthoringTemplateLiteralFindings(sourceText),
    ...collectAuthoringTemplateSectionFindings(templateSource),
  ];
};

const inspectAuthoringCatalogGateSource = (project: Project): Finding[] => {
  const governedCatalogSource = getSource(project, AUTHORING_GOVERNED_CATALOGS_PATH);
  const sourceText = governedCatalogSource.getFullText();
  return hasCallExpression(governedCatalogSource, "buildCapabilityCatalog")
    && hasCallExpression(governedCatalogSource, "readFileSync")
    && sourceText.includes("BLOCKED_CAPABILITY_CATALOG_STALE")
    ? []
    : [createFinding({ lawId: MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE, file: AUTHORING_GOVERNED_CATALOGS_PATH, line: 1, severity: "fatal", message: "Map authoring must gate governed capability catalog freshness and block stale catalog truth." })];
};

const inspectAuthoringCatalogConsumers = (project: Project): Finding[] => {
  const findings: Finding[] = [];
  const catalogConsumerFiles = [
    AUTHORING_PROMPT_BUILDER_PATH,
    AUTHORING_DRAFT_CHAIN_PATH,
    EXTERNAL_PROVIDER_RUNTIME_MESSAGES_PATH,
  ] as const;

  for (const filePath of catalogConsumerFiles) {
    const source = getSource(project, filePath);
    if (hasCallExpression(source, "buildMapAuthoringGovernedCatalogs")) {
      findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE, file: filePath, line: 1, severity: "fatal", message: "Map authoring prompt consumers must not rebuild governed catalogs once a complete input package exists." }));
      continue;
    }

    if (filePath === AUTHORING_PROMPT_BUILDER_PATH && !hasCallExpressionPath(source, ["MapAuthoringInputPackageSchema", "parse"])) {
      findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE, file: filePath, line: 1, severity: "fatal", message: "Map authoring prompt builder must parse a full input package before building prompt text." }));
      continue;
    }

    if (!source.getFullText().includes("inputPackage") && !source.getFullText().includes("request.input")) {
      findings.push(createFinding({ lawId: MAP_PLUGIN_LAWS.AUTHORING_INPUT_PACKAGE, file: filePath, line: 1, severity: "fatal", message: "Map authoring prompt consumers must receive governed input package data before building prompt text." }));
    }
  }

  return findings;
};

export const inspectAuthoringPromptSources = (project: Project): Finding[] => {
  return [
    ...inspectAuthoringTemplateSingleTruth(project),
    ...inspectAuthoringCatalogGateSource(project),
    ...inspectAuthoringCatalogConsumers(project),
  ];
};
