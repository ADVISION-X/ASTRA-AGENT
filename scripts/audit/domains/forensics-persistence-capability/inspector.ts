import { relative } from "node:path";

import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorEvaluation, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { repoRoot, resolveFromRepo } from "../../shared/paths.js";
import { staticClauses, staticEvidenceRefs, validateStaticInspection } from "../../shared/static-inspection-contract.js";

type Finding = ReturnType<typeof createFinding>;

const requiredCapabilityFiles = [
  "src/capabilities/forensics-persistence/index.ts",
  "src/capabilities/forensics-persistence/ability-group.ts",
  "src/capabilities/forensics-persistence/schema.ts",
  "src/capabilities/forensics-persistence/storage-adapter.ts",
  "src/capabilities/forensics-persistence/storage-port.ts",
] as const;

const requiredStorageFiles = [
  "src/lib/storage/index.ts",
  "src/lib/storage/file-storage.ts",
  "src/lib/storage/schema.ts",
  "src/lib/storage/storage-port.ts",
] as const;

const legacySchemaNames = new Set([
  "ProductDiscoveryEvidencePacket",
  "LocalAiTaskResult",
  "ActionLog",
  "AgentRound",
  "TaskRun",
  "RuntimeDeliveryState",
  "ProductOpportunityCandidate",
]);

const secretFieldNames = new Set([
  "cookie",
  "cookies",
  "token",
  "password",
  "authorization",
  "apiKey",
  "localStorage",
  "sessionStorage",
]);

const repoPathOf = (source: SourceFile): string => relative(repoRoot, source.getFilePath()).split("\\").join("/");

const sourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const pushFinding = (
  findings: Finding[],
  lawId: string,
  clauseId: string,
  filePath: string,
  checkId: string,
  message: string,
): void => {
  findings.push(createFinding({ lawId, clauseId, filePath, checkId, message }));
};

const inspectRequiredFiles = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
  clauseId: string,
  inspectedFiles: Set<string>,
  requiredFiles: readonly string[],
): void => {
  for (const repoPath of requiredFiles) {
    if (!context.targetPaths.includes(repoPath)) continue;
    inspectedFiles.add(repoPath);
    if (sourceFile(context, repoPath)) continue;
    pushFinding(findings, lawId, clauseId, repoPath, "forensics/required-file", `${repoPath} must exist in the audit project.`);
  }
};

const inspectCapabilityRequiredFiles = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
  inspectedFiles: Set<string>,
): void => inspectRequiredFiles(
  context, findings, lawId, "grasseye-evidence-001-v2-requirement", inspectedFiles, requiredCapabilityFiles,
);

const inspectStorageRequiredFiles = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
  inspectedFiles: Set<string>,
): void => inspectRequiredFiles(
  context, findings, lawId, "grasseye-local-persistence-schema-001-requirement", inspectedFiles, requiredStorageFiles,
);

const inspectOwnerImports = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
  clauseId: string,
  inspectedFiles: Set<string>,
): void => {
  const owned = context.project.getSourceFiles().filter((source) => {
    const repoPath = repoPathOf(source);
    return repoPath.startsWith("src/capabilities/forensics-persistence/") || repoPath.startsWith("src/lib/storage/");
  });
  for (const source of owned) {
    const repoPath = repoPathOf(source);
    inspectedFiles.add(repoPath);
    for (const declaration of source.getImportDeclarations()) {
      const target = declaration.getModuleSpecifierSourceFile();
      if (!target) continue;
      const targetPath = repoPathOf(target);
      if (!targetPath.startsWith("src/plugins/")) continue;
      pushFinding(findings, lawId, clauseId, repoPath, "forensics/plugin-import", `${repoPath} must not import business plugin ${targetPath}.`);
    }
  }
};

const inspectPublicFacade = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
  clauseId: string,
  inspectedFiles: Set<string>,
): void => {
  const repoPath = "src/capabilities/forensics-persistence/index.ts";
  const source = sourceFile(context, repoPath);
  if (!source) return;
  inspectedFiles.add(repoPath);
  const allowed = new Set(["./ability-group.js", "./contract.js"]);
  for (const declaration of source.getExportDeclarations()) {
    const specifier = declaration.getModuleSpecifierValue();
    if (!specifier || allowed.has(specifier)) continue;
    pushFinding(findings, lawId, clauseId, repoPath, "forensics/public-facade", `Forensics public facade must not export private module ${specifier}.`);
  }
};

const inspectStoragePort = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
  clauseId: string,
  inspectedFiles: Set<string>,
): void => {
  const repoPath = "src/lib/storage/storage-port.ts";
  const source = sourceFile(context, repoPath);
  if (!source) return;
  inspectedFiles.add(repoPath);
  const storagePort = source.getInterface("GrassEyeStoragePort");
  const actual = storagePort?.getMethods().map((method) => method.getName()).sort() ?? [];
  const expected = ["appendArtifact", "appendRecord", "readRecord"];
  if (actual.length === expected.length && actual.every((name, index) => name === expected[index])) return;
  pushFinding(findings, lawId, clauseId, repoPath, "forensics/storage-port", "GrassEyeStoragePort must expose only appendArtifact, appendRecord, and readRecord.");
};

const inspectSchemaVocabulary = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
  clauseId: string,
  inspectedFiles: Set<string>,
): void => {
  for (const repoPath of ["src/capabilities/forensics-persistence/schema.ts"] as const) {
    const source = sourceFile(context, repoPath);
    if (!source) continue;
    inspectedFiles.add(repoPath);
    for (const identifier of source.getDescendantsOfKind(SyntaxKind.Identifier)) {
      const name = identifier.getText();
      if (legacySchemaNames.has(name)) {
        pushFinding(findings, lawId, clauseId, repoPath, "forensics/legacy-schema", `${repoPath} restores retired schema name ${name}.`);
      }
      if (secretFieldNames.has(name) && Node.isPropertyNamed(identifier.getParent())) {
        pushFinding(findings, lawId, clauseId, repoPath, "forensics/secret-field", `${repoPath} must not persist secret-bearing field ${name}.`);
      }
    }
  }
};

const inspectDomainEvaluation = async (context: InspectorContext): Promise<InspectorEvaluation> => {
  const evidenceLaw = selectLawId(context.planEntry.lawIds, "LAW-FORENSICS-PERSISTENCE-CAPABILITY-001-V3");
  const schemaBoundaryLaw = selectLawId(context.planEntry.lawIds, "LAW-FORENSICS-PERSISTENCE-CAPABILITY-002-V3");
  const schemaVocabularyLaw = selectLawId(context.planEntry.lawIds, "LAW-FORENSICS-PERSISTENCE-CAPABILITY-003-V3");
  const findings: Finding[] = [];
  const inspectedFiles = new Set<string>();

  inspectCapabilityRequiredFiles(context, findings, evidenceLaw, inspectedFiles);
  inspectStorageRequiredFiles(context, findings, schemaBoundaryLaw, inspectedFiles);
  inspectOwnerImports(context, findings, evidenceLaw, "grasseye-evidence-001-v2-requirement", inspectedFiles);
  inspectPublicFacade(context, findings, evidenceLaw, "grasseye-evidence-001-v2-requirement", inspectedFiles);
  inspectStoragePort(context, findings, schemaBoundaryLaw, "grasseye-local-persistence-schema-001-requirement", inspectedFiles);
  inspectSchemaVocabulary(context, findings, schemaVocabularyLaw, "grasseye-local-persistence-schema-002-v2-requirement", inspectedFiles);

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...context.targetPaths],
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  const evaluation = await inspectDomainEvaluation(context);
  const lawResult = (lawId: string) => {
    const findings = evaluation.findings.filter((finding) => finding.lawId === lawId);
    const passed = findings.length === 0;
    return { lawId, assertions: ["static.ast", "static.contract"].map((evidenceMode) => ({
      clauses: staticClauses(), evidenceMode, passed, refs: staticEvidenceRefs(context, lawId, evidenceMode),
    })), findings };
  };
  return validateStaticInspection(context, {
    capabilityDomain: evaluation.capabilityDomain, reportedLawIds: evaluation.reportedLawIds,
    lawResults: [lawResult("LAW-FORENSICS-PERSISTENCE-CAPABILITY-001-V3"),
      lawResult("LAW-FORENSICS-PERSISTENCE-CAPABILITY-002-V3"),
      lawResult("LAW-FORENSICS-PERSISTENCE-CAPABILITY-003-V3")], inspectedFiles: evaluation.inspectedFiles,
  });
};
