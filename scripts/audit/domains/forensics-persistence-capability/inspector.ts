import { existsSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";

import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import { type InspectorContext, type InspectorEvaluation, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { repoRoot, resolveFromRepo } from "../../shared/paths.js";
import { producerModePassed, recordStaticCheck, staticClauses, staticEvidenceRefs, validateStaticInspection } from "../../shared/static-inspection-contract.js";

type Finding = ReturnType<typeof createFinding>;

const requiredCapabilityFiles = [
  "src/capabilities/forensics-persistence/index.ts",
  "src/capabilities/forensics-persistence/contract.ts",
  "src/capabilities/forensics-persistence/ability-group.ts",
  "src/capabilities/forensics-persistence/schema.ts",
  "src/capabilities/forensics-persistence/storage-adapter.ts",
  "src/capabilities/forensics-persistence/storage-port.ts",
] as const;

const FORENSICS_ROOT = "src/capabilities/forensics-persistence";
const FORENSICS_CHILDREN_ROOT = `${FORENSICS_ROOT}/children`;

const requiredStorageFiles = [
  "src/lib/storage/index.ts",
  "src/lib/storage/file-storage.ts",
  "src/lib/storage/refs.ts",
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
  evidenceMode: "static.ast" | "static.contract" = "static.ast",
): void => {
  findings.push(createFinding({ evidenceMode, lawId, clauseId, filePath, checkId, message }));
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
    pushFinding(findings, lawId, clauseId, repoPath, "forensics/public-facade", `Forensics public facade must not export private module ${specifier}.`, "static.contract");
  }
};

const forensicsContractIds = (context: InspectorContext): string[] => {
  const schema = sourceFile(context, `${FORENSICS_ROOT}/schema.ts`);
  const call = schema?.getVariableDeclaration("ForensicsChildCapabilityIdSchema")
    ?.getInitializerIfKind(SyntaxKind.CallExpression);
  const values = call?.getArguments()[0];
  return Node.isArrayLiteralExpression(values)
    ? values.getElements().flatMap((element) => Node.isStringLiteral(element) ? [element.getLiteralValue()] : []).sort()
    : [];
};

const forensicsSwitchIds = (context: InspectorContext): string[] => sourceFile(
  context, `${FORENSICS_ROOT}/ability-group.ts`,
)?.getDescendantsOfKind(SyntaxKind.CaseClause).flatMap((clause) => {
  const expression = clause.getExpression();
  return Node.isStringLiteral(expression) ? [expression.getLiteralValue()] : [];
}).sort() ?? [];

const inspectChildLayout = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
  inspectedFiles: Set<string>,
): void => {
  const expected = forensicsContractIds(context);
  const root = resolve(context.sealedRoot, FORENSICS_CHILDREN_ROOT);
  const directories = existsSync(root) ? readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort() : [];
  const mapped = forensicsSwitchIds(context);
  const report = (checkId: string, message: string): void => pushFinding(
    findings, lawId, `${lawId.toLowerCase()}-requirement`, FORENSICS_CHILDREN_ROOT,
    checkId, message, "static.contract",
  );
  if (expected.length !== 4 || new Set(expected).size !== 4) {
    report("forensics/exact-child-denominator", `Forensics contract must define four unique Child ids; found ${expected.length}/${new Set(expected).size}.`);
  }
  if (JSON.stringify(expected) !== JSON.stringify(directories)) {
    report("forensics/one-directory-per-child", `Contract and directories differ: contract=${expected.join(",")}; directories=${directories.join(",")}.`);
  }
  if (JSON.stringify(expected) !== JSON.stringify(mapped)) {
    report("forensics/one-ability-group-mapping-per-child", `Contract and ability-group switch differ: contract=${expected.join(",")}; mapped=${mapped.join(",")}.`);
  }
  for (const id of directories) {
    const directory = resolve(root, id);
    const files = readdirSync(directory).filter((name) => name !== ".DS_Store").sort();
    const handlerPath = `${FORENSICS_CHILDREN_ROOT}/${id}/handler.ts`;
    inspectedFiles.add(handlerPath);
    const handler = sourceFile(context, handlerPath)?.getFullText() ?? "";
    if (JSON.stringify(files) !== JSON.stringify(["handler.ts"]) || !handler.includes(`childCapabilityId: "${id}"`)) {
      report("forensics/one-handler-file-per-child", `${id} must contain only one handler.ts bound to its exact childCapabilityId; found ${files.join(",") || "none"}.`);
    }
  }
  for (const id of expected) {
    const retired = resolve(context.sealedRoot, FORENSICS_CHILDREN_ROOT, `${id}.ts`);
    if (existsSync(retired)) report("forensics/flat-child-handler-retired", `Retired flat Child handler must be absent: ${FORENSICS_CHILDREN_ROOT}/${id}.ts.`);
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
  const expected = ["appendArtifact", "appendRecord", "readArtifact", "readRecord"];
  if (actual.length === expected.length && actual.every((name, index) => name === expected[index])) return;
  pushFinding(findings, lawId, clauseId, repoPath, "forensics/storage-port", "GrassEyeStoragePort must expose only appendArtifact, appendRecord, readArtifact, and readRecord.", "static.contract");
};

const inspectSchemaContract = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
  clauseId: string,
  inspectedFiles: Set<string>,
): void => {
  const capabilityPath = "src/capabilities/forensics-persistence/schema.ts";
  const storagePath = "src/lib/storage/schema.ts";
  const capability = sourceFile(context, capabilityPath);
  const storage = sourceFile(context, storagePath);
  for (const repoPath of [capabilityPath, storagePath]) inspectedFiles.add(repoPath);
  if (!capability || !storage) {
    pushFinding(findings, lawId, clauseId, capabilityPath, "forensics/schema-contract",
      "Forensics capability and storage envelope schemas must both remain present.", "static.contract");
    return;
  }
  const declarations = new Set(capability.getTypeAliases().map((declaration) => declaration.getName()));
  for (const required of [
    "ForensicsAppendRecordInput", "ForensicsAppendArtifactInput",
    "ForensicsReadRecordRefInput", "ForensicsReadArtifactRefInput",
    "ForensicsAppendRecordResult", "ForensicsAppendArtifactResult",
    "ForensicsReadRecordResult", "ForensicsReadArtifactResult",
  ]) if (!declarations.has(required)) pushFinding(findings, lawId, clauseId, capabilityPath,
    "forensics/schema-contract", `Forensics schema contract is missing ${required}.`, "static.contract");
  const storageFields = (name: string): Set<string> => new Set(storage.getTypeAlias(name)
    ?.getDescendantsOfKind(SyntaxKind.PropertySignature).map((property) => property.getName()) ?? []);
  const recordFields = storageFields("RecordEnvelope");
  const artifactFields = storageFields("ArtifactEnvelope");
  for (const required of ["recordType", "payload", "artifactRefs", "idempotencyKey", "createdAt"]) {
    if (!recordFields.has(required)) pushFinding(findings, lawId, clauseId, storagePath,
      "forensics/record-envelope-contract", `RecordEnvelope is missing ${required}.`, "static.contract");
  }
  for (const required of ["artifactType", "content", "idempotencyKey", "createdAt"]) {
    if (!artifactFields.has(required)) pushFinding(findings, lawId, clauseId, storagePath,
      "forensics/artifact-envelope-contract", `ArtifactEnvelope is missing ${required}.`, "static.contract");
  }
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

const inspectExactCallEvidenceOwner = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
  inspectedFiles: Set<string>,
): void => {
  const paths = [
    "src/capabilities/forensics-persistence/contract.ts",
    "src/capabilities/forensics-persistence/ability-group.ts",
    "src/capabilities/forensics-persistence/storage-port.ts",
  ] as const;
  const sources = paths.map((repoPath) => {
    inspectedFiles.add(repoPath);
    return sourceFile(context, repoPath);
  });
  const text = sources.map((source) => source?.getFullText() ?? "").join("\n");
  for (const required of [
    "readExactCallEvidence", "readRecordByIdentity", "exactCallIdentityHash",
    "gpt-call-evidence:v1:", "gpt-call-terminal-evidence:v1:", "recordRef",
  ]) if (!text.includes(required)) pushFinding(
    findings, lawId, `${lawId.toLowerCase()}-requirement`, paths[0],
    "forensics/exact-call-readback", `The unique Forensics Owner is missing ${required}.`, "static.contract",
  );
  const method = sources[1]?.getDescendantsOfKind(SyntaxKind.MethodDeclaration)
    .find((candidate) => candidate.getName() === "readExactCallEvidence");
  const methodText = method?.getFullText() ?? "";
  const reads = methodText.match(/storage\.readRecordByIdentity\s*\(/gu)?.length ?? 0;
  if (reads !== 2
    || methodText.indexOf("gpt-call-terminal-evidence:v1:") > methodText.indexOf("gpt-call-evidence:v1:")
    || !/return\s+terminal\s*\?\?\s*storage\.readRecordByIdentity\s*\(/u.test(methodText)) {
    pushFinding(findings, lawId, `${lawId.toLowerCase()}-requirement`, paths[1],
      "forensics/exact-call-evidence-lifecycle",
      `Exact-call evidence readback must read terminal then initial with exactly two identities; found ${reads} reads.`,
      "static.contract");
  }
  for (const forbidden of ["gpt-call-invocation-evidence", "recoveryGeneration", "evidenceVersion"]) {
    if (!text.includes(forbidden)) continue;
    pushFinding(findings, lawId, `${lawId.toLowerCase()}-requirement`, paths[1],
      "forensics/exact-call-evidence-lifecycle",
      `Exact-call evidence must not add a third lifecycle identity through ${forbidden}.`, "static.contract");
  }
};

const inspectDeterministicRecordIdentity = (
  context: InspectorContext,
  findings: Finding[],
  lawId: string,
  inspectedFiles: Set<string>,
): void => {
  const paths = [
    "src/capabilities/forensics-persistence/storage-adapter.ts",
    "src/lib/storage/refs.ts",
    "src/lib/storage/file-storage.ts",
  ] as const;
  const text = paths.map((repoPath) => {
    inspectedFiles.add(repoPath);
    return sourceFile(context, repoPath)?.getFullText() ?? "";
  }).join("\n");
  for (const required of [
    "createIdempotentRecordRef", "missionId", "runId", "idempotencyKey",
    "FORENSICS_IDEMPOTENCY_CONFLICT", "readRecord",
  ]) if (!text.includes(required)) pushFinding(
    findings, lawId, `${lawId.toLowerCase()}-requirement`, paths[0],
    "forensics/deterministic-record-identity", `Deterministic record identity/readback is missing ${required}.`, "static.ast",
  );
};

const inspectDomainEvaluation = async (context: InspectorContext): Promise<InspectorEvaluation> => {
  const evidenceLaw = selectLawId(context.planEntry.lawIds, "LAW-FORENSICS-PERSISTENCE-CAPABILITY-001-V5");
  const schemaBoundaryLaw = selectLawId(context.planEntry.lawIds, "LAW-FORENSICS-PERSISTENCE-CAPABILITY-002-V5");
  const schemaVocabularyLaw = selectLawId(context.planEntry.lawIds, "LAW-FORENSICS-PERSISTENCE-CAPABILITY-003-V4");
  const findings: Finding[] = [];
  const inspectedFiles = new Set<string>();
  const staticCheckReceipts: InspectorEvaluation["staticCheckReceipts"] = [];
  const run = (check: string, lawId: string, implementation: (...args: never[]) => unknown,
    action: () => void): void => recordStaticCheck({
    check, findings, implementation, lawIds: [lawId], receipts: staticCheckReceipts, run: action,
  });

  run("inspectCapabilityRequiredFiles", evidenceLaw, inspectCapabilityRequiredFiles, () => inspectCapabilityRequiredFiles(context, findings, evidenceLaw, inspectedFiles));
  run("inspectStorageRequiredFiles", schemaBoundaryLaw, inspectStorageRequiredFiles, () => inspectStorageRequiredFiles(context, findings, schemaBoundaryLaw, inspectedFiles));
  run("inspectOwnerImports", evidenceLaw, inspectOwnerImports, () => inspectOwnerImports(context, findings, evidenceLaw, "grasseye-evidence-001-v2-requirement", inspectedFiles));
  run("inspectPublicFacade", evidenceLaw, inspectPublicFacade, () => inspectPublicFacade(context, findings, evidenceLaw, "grasseye-evidence-001-v2-requirement", inspectedFiles));
  run("inspectChildLayout", evidenceLaw, inspectChildLayout,
    () => inspectChildLayout(context, findings, evidenceLaw, inspectedFiles));
  run("inspectStoragePort", schemaBoundaryLaw, inspectStoragePort, () => inspectStoragePort(context, findings, schemaBoundaryLaw, "grasseye-local-persistence-schema-001-requirement", inspectedFiles));
  run("inspectSchemaVocabulary", schemaVocabularyLaw, inspectSchemaVocabulary, () => inspectSchemaVocabulary(context, findings, schemaVocabularyLaw, "grasseye-local-persistence-schema-002-v2-requirement", inspectedFiles));
  run("inspectSchemaContract", schemaVocabularyLaw, inspectSchemaContract, () => inspectSchemaContract(context, findings, schemaVocabularyLaw,
    "grasseye-local-persistence-schema-002-v2-requirement", inspectedFiles));
  run("inspectExactCallEvidenceOwner", evidenceLaw, inspectExactCallEvidenceOwner,
    () => inspectExactCallEvidenceOwner(context, findings, evidenceLaw, inspectedFiles));
  run("inspectDeterministicRecordIdentity", schemaBoundaryLaw, inspectDeterministicRecordIdentity,
    () => inspectDeterministicRecordIdentity(context, findings, schemaBoundaryLaw, inspectedFiles));

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...context.targetPaths],
    staticCheckReceipts,
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  const evaluation = await inspectDomainEvaluation(context);
  const semanticChecks = (lawId: string, evidenceMode: string): string[] => lawId.endsWith("001-V5")
    ? evidenceMode === "static.ast" ? ["inspectCapabilityRequiredFiles", "inspectOwnerImports"] : ["inspectPublicFacade", "inspectExactCallEvidenceOwner", "inspectChildLayout"]
    : lawId.endsWith("002-V5")
      ? evidenceMode === "static.ast" ? ["inspectStorageRequiredFiles", "inspectDeterministicRecordIdentity"] : ["inspectStoragePort"]
      : evidenceMode === "static.ast" ? ["inspectSchemaVocabulary"] : ["inspectSchemaContract"];
  const lawResult = (lawId: string) => {
    const findings = evaluation.findings.filter((finding) => finding.lawId === lawId);
      return { lawId, assertions: ["static.ast", "static.contract"].map((evidenceMode) => {
      const checks = semanticChecks(lawId, evidenceMode);
      return ({
      clauses: staticClauses(0), evidenceMode, passed: producerModePassed(evaluation.staticCheckReceipts, lawId, checks), refs: staticEvidenceRefs(context, lawId, evidenceMode, staticClauses(0), evaluation.staticCheckReceipts, checks),
    }); }), findings };
  };
  return validateStaticInspection(context, {
    capabilityDomain: evaluation.capabilityDomain, reportedLawIds: evaluation.reportedLawIds,
    lawResults: [lawResult("LAW-FORENSICS-PERSISTENCE-CAPABILITY-001-V5"),
      lawResult("LAW-FORENSICS-PERSISTENCE-CAPABILITY-002-V5"),
      lawResult("LAW-FORENSICS-PERSISTENCE-CAPABILITY-003-V4")], inspectedFiles: evaluation.inspectedFiles,
  });
};
