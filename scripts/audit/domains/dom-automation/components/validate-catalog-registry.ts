import { readFileSync } from "node:fs";

import { Node, SyntaxKind } from "ts-morph";

import { pathFromRepoRoot } from "../../../core/paths.js";
import { createFinding } from "../../../core/result.js";
import type { Finding } from "../../../core/schema.js";
import {
  getSourceFileAtRepoPath,
  objectLiteralPropertyNames,
  buildValidationResult,
  type DomAutomationAuditProject,
  type DomAutomationValidationResult,
} from "./collect-dom-automation-project.js";

const REQUIRED_ACTION_CODES = [
  "READ_DOM_SNAPSHOT_ONCE",
  "LOCATE_DOM_ELEMENT_ONCE",
  "FILL_DOM_ELEMENT_ONCE",
  "CLICK_DOM_ELEMENT_ONCE",
  "UPLOAD_APPROVED_FILE_ONCE",
  "VERIFY_DOM_STATE_ONCE",
  "WAIT_FOR_DOM_STATE_ONCE",
] as const;

const catalogFinding = (
  lawId: string,
  file: string,
  line: number,
  message: string,
  hint: string,
): Finding => createFinding({
  lawId,
  file,
  line,
  severity: "fatal",
  message,
  hint,
});

const validateDomCatalogEntries = (
  auditProject: DomAutomationAuditProject,
): Finding[] => {
  const repoPath = "src/capabilities/dom-automation/manifest.ts";
  const sourceFile = getSourceFileAtRepoPath(auditProject.project, repoPath);
  if (!sourceFile) {
    return [catalogFinding("GRASSEYE-DOM-001-V1", repoPath, 1, "DOM catalog manifest file is missing", "Restore DOM catalog entries under the DOM owner.")];
  }
  const declaration = sourceFile.getVariableDeclaration("DOM_AUTOMATION_CATALOG_ENTRIES");
  const initializer = declaration?.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression);
  if (!initializer) {
    return [catalogFinding("GRASSEYE-DOM-001-V1", repoPath, 1, "DOM_AUTOMATION_CATALOG_ENTRIES is missing or not an array literal", "Keep DOM catalog entries in source code, not generated output.")];
  }
  const actionCodes = new Set<string>();
  const childKeys = new Set<string>();
  const findings: Finding[] = [];
  for (const element of initializer.getElements()) {
    if (!Node.isObjectLiteralExpression(element)) {
      continue;
    }
    const actionCodeProperty = element.getProperty("actionCode");
    const abilityGroupProperty = element.getProperty("abilityGroupId");
    const childCapabilityProperty = element.getProperty("childCapabilityId");
    const actionCode = Node.isPropertyAssignment(actionCodeProperty) && Node.isStringLiteral(actionCodeProperty.getInitializerIfKindOrThrow(SyntaxKind.StringLiteral))
      ? actionCodeProperty.getInitializerIfKindOrThrow(SyntaxKind.StringLiteral).getLiteralText()
      : null;
    const abilityGroupId = Node.isPropertyAssignment(abilityGroupProperty) && Node.isStringLiteral(abilityGroupProperty.getInitializerIfKindOrThrow(SyntaxKind.StringLiteral))
      ? abilityGroupProperty.getInitializerIfKindOrThrow(SyntaxKind.StringLiteral).getLiteralText()
      : null;
    const childCapabilityId = Node.isPropertyAssignment(childCapabilityProperty) && Node.isStringLiteral(childCapabilityProperty.getInitializerIfKindOrThrow(SyntaxKind.StringLiteral))
      ? childCapabilityProperty.getInitializerIfKindOrThrow(SyntaxKind.StringLiteral).getLiteralText()
      : null;
    if (!actionCode || !abilityGroupId || !childCapabilityId) {
      findings.push(catalogFinding("GRASSEYE-DOM-001-V1", repoPath, element.getStartLineNumber(), "DOM catalog entry is missing actionCode or child ownership fields", "Keep DOM catalog entries fully declared in source."));
      continue;
    }
    actionCodes.add(actionCode);
    const childKey = `${abilityGroupId}:${childCapabilityId}`;
    if (childKeys.has(childKey)) {
      findings.push(catalogFinding("GRASSEYE-DOM-001-V1", repoPath, element.getStartLineNumber(), `duplicate DOM ability child pair: ${childKey}`, "Keep every DOM catalog entry bound to one unique child capability."));
    }
    childKeys.add(childKey);
  }
  for (const actionCode of REQUIRED_ACTION_CODES) {
    if (!actionCodes.has(actionCode)) {
      findings.push(catalogFinding("GRASSEYE-DOM-001-V1", repoPath, 1, `DOM catalog entry is missing actionCode: ${actionCode}`, "Register all seven DOM action codes in DOM_AUTOMATION_CATALOG_ENTRIES."));
    }
  }
  return findings;
};

const validateCatalogMergeSource = (
  auditProject: DomAutomationAuditProject,
): Finding[] => {
  const findings: Finding[] = [];
  const catalogFile = getSourceFileAtRepoPath(auditProject.project, "src/muscle-memory/catalog.ts");
  const mergeFile = getSourceFileAtRepoPath(auditProject.project, "src/muscle-memory/catalog-merge.ts");
  if (!catalogFile || !mergeFile) {
    return [catalogFinding("GRASSEYE-DOM-001-V1", "src/muscle-memory/catalog.ts", 1, "MuscleMemory source catalog files are missing", "Keep DOM catalog merge in source registry code.")];
  }
  const domImport = catalogFile.getImportDeclarations().find((importDeclaration) => {
    const target = importDeclaration.getModuleSpecifierSourceFile();
    return target?.getFilePath().endsWith("/src/capabilities/dom-automation/manifest.ts") === true;
  });
  if (!domImport) {
    findings.push(catalogFinding("GRASSEYE-DOM-001-V1", "src/muscle-memory/catalog.ts", 1, "catalog.ts does not import DOM_AUTOMATION_CATALOG_ENTRIES from source manifest", "Join DOM entries through source registry imports only."));
  }
  const mergeCall = catalogFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === "mergeCapabilityCatalogEntries";
  });
  const mergeArgs = mergeCall?.getArguments().map((argument) => argument.getText()) ?? [];
  if (!mergeArgs.includes("DOM_AUTOMATION_CATALOG_ENTRIES")) {
    findings.push(catalogFinding("GRASSEYE-DOM-001-V1", "src/muscle-memory/catalog.ts", 1, "catalog.ts does not merge DOM_AUTOMATION_CATALOG_ENTRIES into the source registry", "Merge DOM entries through mergeCapabilityCatalogEntries."));
  }
  const hasThrow = mergeFile.getDescendantsOfKind(SyntaxKind.ThrowStatement).length > 0;
  const hasActionDuplicateGuard = mergeFile.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((callExpression) => callExpression.getExpression().getText() === "actionCodes.has");
  const hasChildDuplicateGuard = mergeFile.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((callExpression) => callExpression.getExpression().getText() === "childKeys.has");
  const hasDuplicateMessageSymbol = mergeFile.getFunction("duplicateMessage") != null
    || mergeFile.getVariableDeclaration("duplicateMessage") != null;
  if (!hasDuplicateMessageSymbol || !hasActionDuplicateGuard || !hasChildDuplicateGuard || !hasThrow) {
    findings.push(catalogFinding("GRASSEYE-DOM-001-V1", "src/muscle-memory/catalog-merge.ts", 1, "catalog merge does not prove duplicate guards for actionCode and ability child keys", "Fail fast on duplicate actionCode and abilityGroupId:childCapabilityId merges."));
  }
  return findings;
};

const validateGeneratedCatalog = (): Finding[] => {
  const generated = JSON.parse(readFileSync(pathFromRepoRoot("src/muscle-memory/generated-catalog.json"), "utf8")) as {
    entries?: Array<{ actionCode?: string; abilityGroupId?: string }>;
  };
  const manualDomEntry = (generated.entries ?? []).find((entry) => entry.abilityGroupId === "dom-automation" || REQUIRED_ACTION_CODES.includes((entry.actionCode ?? "") as (typeof REQUIRED_ACTION_CODES)[number]));
  return manualDomEntry
    ? [catalogFinding("GRASSEYE-DOM-001-V1", "src/muscle-memory/generated-catalog.json", 1, "generated catalog contains hand-inserted DOM entries", "Keep DOM abilities out of generated-catalog.json and merge them from source only." )]
    : [];
};

export const validateCatalogRegistry = (
  auditProject: DomAutomationAuditProject,
): DomAutomationValidationResult => {
  const findings = [
    ...validateDomCatalogEntries(auditProject),
    ...validateCatalogMergeSource(auditProject),
    ...validateGeneratedCatalog(),
  ];
  return buildValidationResult({
    name: "catalog-registry",
    findings,
    coveredClauseIds: [
      "GRASSEYE-DOM-001-V1",
      "BLUEPRINT-07",
    ],
    passSummary: "DOM catalog entries join the MuscleMemory source registry with duplicate guards and no generated stuffing.",
    failSummary: "DOM catalog registry proof is incomplete.",
  });
};
