import { Node, SyntaxKind } from "ts-morph";

import { createFinding, createPhase } from "../../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";
import { getAuditProject, getNodeLine, getObjectLiteralString, getSourceFileOrThrow, toRelativeSourcePath } from "../../../core/ts-morph.js";

const RUN_DOMAIN_OWNER_IMPORT = "../_shared/run-domain-owner-inspection.js";
const PENDING_DOMAIN_OWNER_IMPORT = "../_shared/create-pending-domain-inspector.js";

const getImportedLocalName = (
  sourceFile: ReturnType<typeof getSourceFileOrThrow>,
  moduleSpecifier: string,
  importName: string,
): string | undefined => {
  const importDeclaration = sourceFile
    .getImportDeclarations()
    .find((declaration) => declaration.getModuleSpecifierValue() === moduleSpecifier);
  const namedImport = importDeclaration?.getNamedImports().find((specifier) => specifier.getName() === importName);
  return namedImport?.getAliasNode()?.getText() ?? namedImport?.getName();
};

const getCallObjectLiteral = (
  sourceFile: ReturnType<typeof getSourceFileOrThrow>,
  localName: string | undefined,
  argumentIndex: number,
) => {
  if (!localName) {
    return undefined;
  }

  const callExpression = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => {
    const expression = call.getExpression();
    return Node.isIdentifier(expression) && expression.getText() === localName;
  });
  const argument = callExpression?.getArguments()[argumentIndex];
  return argument && Node.isObjectLiteralExpression(argument) ? argument : undefined;
};

export const validateOwnerEvidence = async (
  context: InspectorContext,
): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const findings: Finding[] = [];
  const phases: InspectorPhase[] = [];
  const project = getAuditProject();
  const typeChecker = project.getTypeChecker();

  for (const owner of context.enforcementMatrix.owners) {
    const sourceFile = getSourceFileOrThrow(project, owner.entry);
    const relativePath = toRelativeSourcePath(sourceFile);
    const runDomainOwnerLocalName = getImportedLocalName(sourceFile, RUN_DOMAIN_OWNER_IMPORT, "runDomainOwnerInspection");
    const pendingOwnerLocalName = getImportedLocalName(sourceFile, PENDING_DOMAIN_OWNER_IMPORT, "createPendingDomainInspector");

    const runDomainOwnerOptions = getCallObjectLiteral(sourceFile, runDomainOwnerLocalName, 1);
    const pendingOwnerOptions = getCallObjectLiteral(sourceFile, pendingOwnerLocalName, 0);
    const sharedOwnerOptions = runDomainOwnerOptions ?? pendingOwnerOptions;

    if (!sharedOwnerOptions) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
          file: relativePath,
          line: 1,
          severity: "error",
          message: "Owner inspector must call shared owner inspection.",
        }),
      );
      continue;
    }

    const capabilityDomain = getObjectLiteralString(sharedOwnerOptions, "capabilityDomain");
    if (capabilityDomain !== owner.capabilityDomain) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
          file: relativePath,
          line: getNodeLine(sharedOwnerOptions),
          severity: "error",
          message: "Owner inspector capabilityDomain literal does not match its manifest.",
        }),
      );
    }

    const inspectorId = getObjectLiteralString(sharedOwnerOptions, "inspectorId");
    if (inspectorId !== owner.inspectorId) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
          file: relativePath,
          line: getNodeLine(sharedOwnerOptions),
          severity: "error",
          message: "Owner inspectorId literal does not match its manifest.",
        }),
      );
    }

    const inspectorEntry = getObjectLiteralString(sharedOwnerOptions, "inspectorEntry");
    if (runDomainOwnerOptions && inspectorEntry !== owner.entry) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
          file: relativePath,
          line: getNodeLine(sharedOwnerOptions),
          severity: "error",
          message: "Owner inspectorEntry literal does not match its manifest.",
        }),
      );
    }

    const finalizeResultLocalName = getImportedLocalName(sourceFile, "../../core/result.js", "finalizeInspectorResult");
    if (finalizeResultLocalName) {
      const finalizeOptions = getCallObjectLiteral(sourceFile, finalizeResultLocalName, 0);
      const finalizedCapabilityDomain = finalizeOptions
        ? getObjectLiteralString(finalizeOptions, "capabilityDomain")
        : undefined;
      if (finalizeOptions && finalizedCapabilityDomain !== owner.capabilityDomain) {
        findings.push(
          createFinding({
            lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
            file: relativePath,
            line: getNodeLine(finalizeOptions),
            severity: "error",
            message: "Finalized inspector result capabilityDomain does not match its manifest.",
          }),
        );
      }
    }

    const defaultExportSymbol = sourceFile.getDefaultExportSymbol();
    if (!defaultExportSymbol) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
          file: relativePath,
          line: 1,
          severity: "error",
          message: "Owner inspector must export one default inspection entrypoint.",
        }),
      );
      continue;
    }

    const defaultExportDeclaration = defaultExportSymbol.getDeclarations()[0];
    const defaultExportType = defaultExportDeclaration
      ? typeChecker.getTypeOfSymbolAtLocation(defaultExportSymbol, defaultExportDeclaration)
      : undefined;
    if (!defaultExportType || defaultExportType.getCallSignatures().length === 0) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
          file: relativePath,
          line: getNodeLine(defaultExportDeclaration ?? sourceFile),
          severity: "error",
          message: "Owner inspector default export must resolve to a callable inspector type.",
        }),
      );
    }
  }

  phases.push(
    createPhase(
      "owner-evidence",
      findings.length === 0 ? "PASS" : "FAKE ENFORCEMENT",
      findings.length === 0,
      findings.length === 0
        ? "Every owner inspector exposes shared owner evidence and domain alignment."
        : "Some owner inspectors do not provide authentic owner evidence.",
    ),
  );

  return { findings, phases };
};