import { Node, SyntaxKind } from "ts-morph";

import { getRegisteredInspector } from "../../../core/inspector-registry.js";
import { createFinding, createPhase } from "../../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";
import { getAuditProject, getNodeLine, getObjectLiteralString, getSourceFileOrThrow, toRelativeSourcePath } from "../../../core/ts-morph.js";

const RUN_DOMAIN_OWNER_IMPORT = "../_shared/owner-foundation-inspection.js";
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

const getSharedOwnerOptions = (sourceFile: ReturnType<typeof getSourceFileOrThrow>) => {
  const runDomainOwnerLocalName = getImportedLocalName(sourceFile, RUN_DOMAIN_OWNER_IMPORT, "runDomainOwnerInspection");
  const pendingOwnerLocalName = getImportedLocalName(sourceFile, PENDING_DOMAIN_OWNER_IMPORT, "createPendingDomainInspector");

  return {
    runDomainOwnerOptions: getCallObjectLiteral(sourceFile, runDomainOwnerLocalName, 1),
    pendingOwnerOptions: getCallObjectLiteral(sourceFile, pendingOwnerLocalName, 0),
  };
};

const createMissingSharedOwnerInspectionFinding = (relativePath: string): Finding =>
  createFinding({
    lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
    file: relativePath,
    line: 1,
    severity: "error",
    message: "Owner inspector must call shared owner inspection.",
  });

const collectSharedOwnerLiteralFindings = (
  owner: InspectorContext["enforcementMatrix"]["owners"][number],
  relativePath: string,
  sharedOwnerOptions: NonNullable<ReturnType<typeof getCallObjectLiteral>>,
  runDomainOwnerOptions: ReturnType<typeof getCallObjectLiteral>,
): Finding[] => {
  const findings: Finding[] = [];
  const capabilityDomain = getObjectLiteralString(sharedOwnerOptions, "capabilityDomain");
  const inspectorId = getObjectLiteralString(sharedOwnerOptions, "inspectorId");
  const inspectorEntry = getObjectLiteralString(sharedOwnerOptions, "inspectorEntry");

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

  return findings;
};

const collectSharedOwnerOptionFindings = (
  owner: InspectorContext["enforcementMatrix"]["owners"][number],
  relativePath: string,
  sharedOwnerOptions: ReturnType<typeof getCallObjectLiteral>,
  runDomainOwnerOptions: ReturnType<typeof getCallObjectLiteral>,
): Finding[] => {
  if (!sharedOwnerOptions) {
    return [createMissingSharedOwnerInspectionFinding(relativePath)];
  }

  return collectSharedOwnerLiteralFindings(owner, relativePath, sharedOwnerOptions, runDomainOwnerOptions);
};

const collectFinalizeResultFindings = (
  sourceFile: ReturnType<typeof getSourceFileOrThrow>,
  owner: InspectorContext["enforcementMatrix"]["owners"][number],
  relativePath: string,
): Finding[] => {
  const finalizeResultLocalName = getImportedLocalName(sourceFile, "../../core/result.js", "finalizeInspectorResult");
  if (!finalizeResultLocalName) {
    return [];
  }

  const finalizeOptions = getCallObjectLiteral(sourceFile, finalizeResultLocalName, 0);
  const finalizedCapabilityDomain = finalizeOptions
    ? getObjectLiteralString(finalizeOptions, "capabilityDomain")
    : undefined;
  if (!finalizeOptions || finalizedCapabilityDomain === owner.capabilityDomain) {
    return [];
  }

  return [
    createFinding({
      lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
      file: relativePath,
      line: getNodeLine(finalizeOptions),
      severity: "error",
      message: "Finalized inspector result capabilityDomain does not match its manifest.",
    }),
  ];
};

const collectRegistryEntrypointFindings = (
  owner: InspectorContext["enforcementMatrix"]["owners"][number],
  relativePath: string,
): Finding[] => {
  if (getRegisteredInspector(owner.entry) !== null) {
    return [];
  }

  return [
    createFinding({
      lawId: "GRASSEYE-AUDIT-SYSTEM-001-V1",
      file: relativePath,
      line: 1,
      severity: "error",
      message: "Owner inspector entry must be registered in the static audit inspector registry.",
    }),
  ];
};

const collectOwnerEvidenceFindings = (
  project: ReturnType<typeof getAuditProject>,
  owner: InspectorContext["enforcementMatrix"]["owners"][number],
): Finding[] => {
  const sourceFile = getSourceFileOrThrow(project, owner.entry);
  const relativePath = toRelativeSourcePath(sourceFile);
  const { runDomainOwnerOptions, pendingOwnerOptions } = getSharedOwnerOptions(sourceFile);
  const sharedOwnerOptions = runDomainOwnerOptions ?? pendingOwnerOptions;

  return [
    ...collectSharedOwnerOptionFindings(owner, relativePath, sharedOwnerOptions, runDomainOwnerOptions),
    ...collectFinalizeResultFindings(sourceFile, owner, relativePath),
    ...collectRegistryEntrypointFindings(owner, relativePath),
  ];
};

const createOwnerEvidencePhase = (findings: Finding[]): InspectorPhase =>
  createPhase(
    "owner-evidence",
    findings.length === 0 ? "PASS" : "FAKE ENFORCEMENT",
    findings.length === 0,
    findings.length === 0
      ? "Every owner inspector exposes shared owner evidence and static registry alignment."
      : "Some owner inspectors do not provide authentic owner evidence.",
  );

export const validateOwnerEvidence = async (
  context: InspectorContext,
): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const findings: Finding[] = [];
  const project = getAuditProject();

  for (const owner of context.enforcementMatrix.owners) {
    findings.push(...collectOwnerEvidenceFindings(project, owner));
  }

  return { findings, phases: [createOwnerEvidencePhase(findings)] };
};