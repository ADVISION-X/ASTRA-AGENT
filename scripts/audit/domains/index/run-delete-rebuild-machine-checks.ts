import { Node, SyntaxKind, type InterfaceDeclaration, type MethodSignature, type SourceFile } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getAuditProject, toRelativeSourcePath } from "../../core/ts-morph.js";
import { createEmptyPurityReport, inspectPurityMetrics } from "../code-purity/components/purity-metric-inspection.js";

const ACTIVE_ABILITY_GROUP_ROOTS = [
  "src/capabilities/ai",
  "src/capabilities/commander-console",
  "src/capabilities/forensics-persistence",
  "src/capabilities/geometry-guard",
  "src/capabilities/mouse-click",
  "src/capabilities/mouse-scroll",
  "src/capabilities/nerve-bus",
  "src/capabilities/open",
  "src/capabilities/orchestration",
  "src/capabilities/page-state",
  "src/capabilities/post-action-verification",
  "src/capabilities/screenshot",
  "src/capabilities/text-input",
  "src/capabilities/visual-target",
] as const;
const FAKE_SUCCESS_MARKER = ["fake", "success"].join(" ");
const FALLBACK_SUCCESS_MARKER = ["fallback", "success"].join(" ");
const WARNING_ONLY_MARKER = ["warning", "only"].join("-");
const NO_OP_PASS_MARKER = ["no-op", "pass"].join(" ");
const CODE_PURITY_SUCCESS_MARKER_MESSAGE = ["Fake,", "fallback,", "no-op,", "or", "TODO", "success", "markers"].join(" ");
const FORBIDDEN_SUCCESS_MARKER_MESSAGE = `Delete-rebuild principle forbids ${FAKE_SUCCESS_MARKER} or ${FALLBACK_SUCCESS_MARKER} markers in active capability source.`;
const FORBIDDEN_WARNING_MARKER_MESSAGE = `Delete-rebuild principle forbids ${WARNING_ONLY_MARKER} or ${NO_OP_PASS_MARKER} markers in active capability source.`;

const PHASE_REQUIREMENTS = [
  "K02-BLUEPRINT-02-SECTION-011-REQ-003",
  "K02-BLUEPRINT-02-SECTION-011-REQ-004",
  "K02-BLUEPRINT-02-SECTION-011-REQ-005",
  "K02-BLUEPRINT-02-SECTION-011-REQ-007",
  "K02-BLUEPRINT-02-SECTION-011-REQ-008",
  "K02-BLUEPRINT-02-SECTION-011-REQ-009",
  "K02-BLUEPRINT-02-SECTION-011-REQ-010",
  "K02-BLUEPRINT-02-SECTION-011-REQ-011",
  "K02-BLUEPRINT-02-SECTION-011-REQ-012",
  "K02-BLUEPRINT-02-SECTION-011-REQ-013",
  "K02-BLUEPRINT-02-SECTION-011-REQ-014",
  "K02-BLUEPRINT-02-SECTION-011-REQ-015",
  "K02-BLUEPRINT-02-SECTION-011-REQ-016",
  "K02-BLUEPRINT-02-SECTION-011-REQ-017",
  "K02-BLUEPRINT-02-SECTION-011-REQ-018",
  "K02-BLUEPRINT-02-SECTION-011-REQ-019",
] as const;

const isActiveCapabilityPath = (relativePath: string): boolean =>
  ACTIVE_ABILITY_GROUP_ROOTS.some((root) => relativePath === root || relativePath.startsWith(`${root}/`));

const getActiveCapabilityFiles = (): SourceFile[] =>
  getAuditProject().getSourceFiles().filter((sourceFile) => isActiveCapabilityPath(toRelativeSourcePath(sourceFile)));

const createRequirementFinding = (lawId: string, file: string, line: number, message: string): Finding =>
  createFinding({ lawId, file, line, severity: "fatal", message });

const collectPurityFindings = (sourceFiles: SourceFile[]): Finding[] => {
  const report = createEmptyPurityReport();
  const touchedPaths = new Set<string>();
  return sourceFiles.flatMap((sourceFile) => inspectPurityMetrics(sourceFile, toRelativeSourcePath(sourceFile), touchedPaths, report));
};

const collectMetadataOnlyChildFindings = (sourceFiles: SourceFile[]): Finding[] => sourceFiles
  .filter((sourceFile) => toRelativeSourcePath(sourceFile).includes("/children/") && toRelativeSourcePath(sourceFile).endsWith("/implementation.ts"))
  .flatMap((sourceFile) => {
    const relativePath = toRelativeSourcePath(sourceFile);
    const hasRuntimeBody = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).length > 0
      || sourceFile.getDescendantsOfKind(SyntaxKind.AwaitExpression).length > 0
      || sourceFile.getDescendantsOfKind(SyntaxKind.IfStatement).length > 0
      || sourceFile.getDescendantsOfKind(SyntaxKind.SwitchStatement).length > 0;
    return hasRuntimeBody
      ? []
      : [createRequirementFinding("K02-BLUEPRINT-02-SECTION-011-REQ-009", relativePath, 1, "Delete-rebuild principle forbids metadata-only child implementations without governed runtime behavior.")];
  });

const collectCopiedChildImplementationFindings = (sourceFiles: SourceFile[]): Finding[] => {
  const normalizedToFile = new Map<string, string>();
  const findings: Finding[] = [];
  for (const sourceFile of sourceFiles.filter((file) => toRelativeSourcePath(file).includes("/children/") && toRelativeSourcePath(file).endsWith("/implementation.ts"))) {
    const relativePath = toRelativeSourcePath(sourceFile);
    const normalized = sourceFile.getFullText().replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").replace(/\s+/g, " ").trim();
    const existing = normalizedToFile.get(normalized);
    if (existing) {
      findings.push(createRequirementFinding("K02-BLUEPRINT-02-SECTION-011-REQ-010", relativePath, 1, `Delete-rebuild principle forbids copied child implementations; duplicate shape also appears in ${existing}.`));
      continue;
    }
    normalizedToFile.set(normalized, relativePath);
  }
  return findings;
};

const hasBroadPortMethod = (method: MethodSignature): boolean => {
  const returnText = method.getReturnTypeNode()?.getText() ?? "";
  if (["unknown", "any", "Record<string, unknown>"].includes(returnText)) {
    return true;
  }

  return method.getParameters().some((parameter) => {
    const parameterText = parameter.getTypeNode()?.getText() ?? "";
    return ["unknown", "any", "Record<string, unknown>"].includes(parameterText);
  });
};

const findBroadPortInterface = (sourceFile: SourceFile): InterfaceDeclaration | undefined => {
  return sourceFile.getInterfaces().find((iface) => iface.getMethods().length > 5 || iface.getMethods().some(hasBroadPortMethod));
};

const collectBroadPortFindings = (sourceFiles: SourceFile[]): Finding[] => sourceFiles
  .filter((sourceFile) => toRelativeSourcePath(sourceFile).includes("/ports/"))
  .flatMap((sourceFile) => {
    const relativePath = toRelativeSourcePath(sourceFile);
    const broadInterface = findBroadPortInterface(sourceFile);
    return broadInterface
      ? [createRequirementFinding("K02-BLUEPRINT-02-SECTION-011-REQ-012", relativePath, broadInterface.getStartLineNumber(), "Delete-rebuild principle forbids primitive ports with broad any/unknown/Record payloads or oversized method surfaces.")]
      : [];
  });

const collectRecordPassthroughFindings = (sourceFiles: SourceFile[]): Finding[] => sourceFiles.flatMap((sourceFile) => {
  const relativePath = toRelativeSourcePath(sourceFile);
  const exportedRecordAlias = sourceFile.getTypeAliases().find((alias) => alias.isExported() && alias.getTypeNode()?.getText() === "Record<string, unknown>");
  const exportedRecordInterface = sourceFile.getInterfaces().find((iface) => iface.isExported() && iface.getProperties().some((property) => property.getTypeNode()?.getText() === "Record<string, unknown>"));
  if (exportedRecordAlias) {
    return [createRequirementFinding("K02-BLUEPRINT-02-SECTION-011-REQ-013", relativePath, exportedRecordAlias.getStartLineNumber(), "Delete-rebuild principle forbids exported Record<string, unknown> passthrough contracts in active capability source.")];
  }
  if (exportedRecordInterface) {
    return [createRequirementFinding("K02-BLUEPRINT-02-SECTION-011-REQ-013", relativePath, exportedRecordInterface.getStartLineNumber(), "Delete-rebuild principle forbids exported Record<string, unknown> passthrough contracts in active capability source.")];
  }
  return [];
});

const collectChildDateFindings = (sourceFiles: SourceFile[]): Finding[] => sourceFiles
  .filter((sourceFile) => toRelativeSourcePath(sourceFile).includes("/children/"))
  .flatMap((sourceFile) => {
    const relativePath = toRelativeSourcePath(sourceFile);
    const findings: Finding[] = [];
    const newDate = sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression).find((expression) => expression.getExpression().getText() === "Date");
    if (newDate) {
      findings.push(createRequirementFinding("K02-BLUEPRINT-02-SECTION-011-REQ-014", relativePath, newDate.getStartLineNumber(), "Delete-rebuild principle forbids scattering new Date inside child implementations."));
    }
    const dateParse = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((expression) => Node.isPropertyAccessExpression(expression.getExpression()) && expression.getExpression().getText() === "Date.parse");
    if (dateParse) {
      findings.push(createRequirementFinding("K02-BLUEPRINT-02-SECTION-011-REQ-015", relativePath, dateParse.getStartLineNumber(), "Delete-rebuild principle forbids Date.parse duration calculations inside child implementations."));
    }
    return findings;
  });

const collectExecuteThrowFindings = (sourceFiles: SourceFile[]): Finding[] => sourceFiles.flatMap((sourceFile) => {
  const relativePath = toRelativeSourcePath(sourceFile);
  const executeMethod = [...sourceFile.getFunctions(), ...sourceFile.getDescendantsOfKind(SyntaxKind.MethodDeclaration)]
    .find((node) => "getName" in node && typeof node.getName === "function" && node.getName() === "execute");
  const throwStatement = executeMethod?.getDescendantsOfKind(SyntaxKind.ThrowStatement)[0];
  return throwStatement
    ? [createRequirementFinding("K02-BLUEPRINT-02-SECTION-011-REQ-016", relativePath, throwStatement.getStartLineNumber(), "Delete-rebuild principle forbids naked throw escaping through public execute boundaries.")]
    : [];
});

const collectWarningOnlyFindings = (sourceFiles: SourceFile[]): Finding[] => sourceFiles.flatMap((sourceFile) => {
  const relativePath = toRelativeSourcePath(sourceFile);
  const warningLiteral = sourceFile.getDescendants().find((node) => {
    if (!Node.isStringLiteral(node) && !Node.isNoSubstitutionTemplateLiteral(node)) {
      return false;
    }
    const text = node.getLiteralText().toLowerCase();
    return text.includes(WARNING_ONLY_MARKER) || text.includes(NO_OP_PASS_MARKER);
  });
  return warningLiteral
    ? [createRequirementFinding("K02-BLUEPRINT-02-SECTION-011-REQ-018", relativePath, warningLiteral.getStartLineNumber(), FORBIDDEN_WARNING_MARKER_MESSAGE)]
    : [];
});

const createAggregateFinding = (lawId: string, file: string, message: string, dependentFindings: Finding[]): Finding[] =>
  dependentFindings.length === 0 ? [] : [createRequirementFinding(lawId, file, 1, message)];

const collectDeleteRebuildRequirementFindings = (sourceFiles: SourceFile[], purityFindings: Finding[]): Finding[] => {
  const exportBarrelFindings = purityFindings.filter((finding) => finding.message === "export * is forbidden in active source truth.")
    .map((finding) => createRequirementFinding("K02-BLUEPRINT-02-SECTION-011-REQ-011", finding.file, finding.line, "Delete-rebuild principle forbids export * barrels in active capability packages."));
  const fakeSuccessFindings = purityFindings.filter((finding) => finding.lawId === "GRASSEYE-CODE-PURITY-008-V1" && finding.message.includes(CODE_PURITY_SUCCESS_MARKER_MESSAGE))
    .map((finding) => createRequirementFinding("K02-BLUEPRINT-02-SECTION-011-REQ-017", finding.file, finding.line, FORBIDDEN_SUCCESS_MARKER_MESSAGE));
  const escapeFindings = purityFindings.filter((finding) => finding.lawId === "GRASSEYE-CODE-PURITY-012-V1")
    .map((finding) => createRequirementFinding("K02-BLUEPRINT-02-SECTION-011-REQ-019", finding.file, finding.line, "Delete-rebuild principle forbids any/unknown/suppression escape hatches in active capability source."));
  const facadePressureFindings = purityFindings.filter((finding) => ["GRASSEYE-CODE-PURITY-001-V1", "GRASSEYE-CODE-PURITY-003-V1", "GRASSEYE-CODE-PURITY-004-V1", "GRASSEYE-CODE-PURITY-007-V1"].includes(finding.lawId) && !finding.file.toLowerCase().includes("adapter"))
    .map((finding) => createRequirementFinding("K02-BLUEPRINT-02-SECTION-011-REQ-007", finding.file, finding.line, "Delete-rebuild principle still allows a God Facade growth pattern in active capability source."));
  const adapterPressureFindings = purityFindings.filter((finding) => ["GRASSEYE-CODE-PURITY-001-V1", "GRASSEYE-CODE-PURITY-003-V1", "GRASSEYE-CODE-PURITY-004-V1", "GRASSEYE-CODE-PURITY-007-V1"].includes(finding.lawId) && finding.file.toLowerCase().includes("adapter"))
    .map((finding) => createRequirementFinding("K02-BLUEPRINT-02-SECTION-011-REQ-008", finding.file, finding.line, "Delete-rebuild principle still allows a God Adapter growth pattern in active capability source."));

  return [
    ...facadePressureFindings,
    ...adapterPressureFindings,
    ...collectMetadataOnlyChildFindings(sourceFiles),
    ...collectCopiedChildImplementationFindings(sourceFiles),
    ...exportBarrelFindings,
    ...collectBroadPortFindings(sourceFiles),
    ...collectRecordPassthroughFindings(sourceFiles),
    ...collectChildDateFindings(sourceFiles),
    ...collectExecuteThrowFindings(sourceFiles),
    ...fakeSuccessFindings,
    ...collectWarningOnlyFindings(sourceFiles),
    ...escapeFindings,
  ];
};

const collectAggregateRequirementFindings = (findings: Finding[]): Finding[] => [
  ...createAggregateFinding("K02-BLUEPRINT-02-SECTION-011-REQ-003", "src/capabilities", "Delete-rebuild principle forbids a third implementation path besides delete or delete-after-rebuild; active capability source still shows banned residual patterns.", findings),
  ...createAggregateFinding("K02-BLUEPRINT-02-SECTION-011-REQ-004", "src/capabilities", "Delete-rebuild principle forbids patch-style remediation; active capability source still carries banned residual patterns.", findings),
  ...createAggregateFinding("K02-BLUEPRINT-02-SECTION-011-REQ-005", "src/capabilities", "Delete-rebuild principle forbids stacking more functions, if branches, helpers, or exceptions onto legacy files; active capability source still shows banned residual patterns.", findings),
];

const buildDeleteRebuildMachinePhases = (findings: Finding[]): InspectorPhase[] => PHASE_REQUIREMENTS.map((requirementId) => {
  const requirementFindings = findings.filter((finding) => finding.lawId === requirementId);
  return createPhase(
    `delete-rebuild-machine-${requirementId.toLowerCase()}`,
    requirementFindings.length === 0 ? "PASS" : "CODE VIOLATION",
    requirementFindings.length === 0,
    requirementFindings.length === 0
      ? `${requirementId} remains enforced in active capability source.`
      : `${requirementId} drifted in active capability source.`,
  );
});

export async function runDeleteRebuildMachineChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  const sourceFiles = getActiveCapabilityFiles();
  const purityFindings = collectPurityFindings(sourceFiles);
  const findings = collectDeleteRebuildRequirementFindings(sourceFiles, purityFindings);
  findings.push(...collectAggregateRequirementFindings(findings));

  return {
    findings,
    phases: buildDeleteRebuildMachinePhases(findings),
  };
}