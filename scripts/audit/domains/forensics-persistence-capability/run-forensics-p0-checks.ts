import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../core/schema.js";
import { getZodEnumValues, getZodObjectPropertyNames } from "../_shared/ast-schema-queries.js";
import { createAuditProject, getSourceFileOrThrow, hasCallExpressionPath } from "../_shared/ast-helpers.js";

import { forensicsPersistenceInspectionConstants } from "./inspection-constants.js";
import { forensicsPersistenceInspectionUtils } from "./inspection-utils.js";

const {
  ABILITY_GROUP_PATH,
  CHILDREN_ROOT,
  CONTRACT_PATH,
  INDEX_PATH,
  LAW_BOUNDARY,
  LAW_CHAIN,
  LAW_CHILDREN,
  LAW_CONTRACT,
  LAW_ENFORCEMENT,
  LAW_OWNER,
  LAW_RUNTIME,
  LAW_STORAGE,
  PORTS_ROOT,
  RECORD_ID_PATH,
  REGISTRY_PATH,
  REQUIRED_CHILDREN,
  ROOT,
  ROOT_MOCK_DIR,
  ROOT_RUNTIME_DIR,
  SCHEMA_PATH,
  SHARED_ROOT,
  SHARED_STORE_ROOT,
} = forensicsPersistenceInspectionConstants;
const {
  childImplementationBypassesExecutor,
  getResolvedModulePath,
  indexLeaksInternals,
  sourceUsesForbiddenImports,
} = forensicsPersistenceInspectionUtils;

const FORBIDDEN_LEGACY_IMPORT_MARKERS = [
  "/types/evidence-packet",
  "/types/platform-action",
  "/types/stored-ai-result",
  "/types/local-ai",
  "/types/task-run",
  "/types/runtime",
] as const;

const FORBIDDEN_ROOT_SYMBOLS = [
  "saveAiResult",
  "saveActionLog",
  "saveEvidencePacket",
  "saveAgentRound",
  "saveCandidate",
  "resetLocalStore",
  "getOperatorSnapshot",
  "setCandidateDisposition",
  "deleteCandidate",
] as const;

const REQUIRED_CHAIN_FIELDS = [
  "missionId",
  "runId",
  "sessionId",
  "roundId",
  "stepId",
  "mapPackageId",
  "mapPackageVersion",
  "selectedMapId",
  "selectedMapVersion",
  "activationSnapshotRef",
  "capabilityCallId",
  "inputRefs",
  "outputRefs",
  "sourceRecordRefs",
  "parentRefs",
  "artifactRefs",
  "schemaVersion",
  "integrityHash",
  "idempotencyKey",
] as const;

const FORBIDDEN_ROOT_DIRS = [ROOT_RUNTIME_DIR, ROOT_MOCK_DIR, SHARED_STORE_ROOT] as const;

const getForensicsSources = (project: import("ts-morph").Project) => (
  project.getSourceFiles(pathFromRepoRoot(`${ROOT}/**/*.ts`))
);

const collectForbiddenRootDirFindings = async (): Promise<Finding[]> => {
  const findings: Finding[] = [];
  for (const relativePath of FORBIDDEN_ROOT_DIRS) {
    if (await fileExists(pathFromRepoRoot(relativePath))) {
      findings.push(createFinding({
        lawId: LAW_OWNER,
        file: relativePath,
        line: 1,
        severity: "fatal",
        message: "Forensics canonical root contains a forbidden directory.",
      }));
    }
  }
  return findings;
};

const collectChildParityFindings = (project: import("ts-morph").Project): Finding[] => {
  const baseSchemaSource = getSourceFileOrThrow(project, `${SHARED_ROOT}/forensics-base-schema.ts`);
  const registrySource = getSourceFileOrThrow(project, REGISTRY_PATH);
  const childIds = new Set(getZodEnumValues(baseSchemaSource, "ForensicsChildCapabilityIdSchema"));
  const importedRegistryChildren = new Set(
    registrySource.getImportDeclarations()
      .map((declaration) => getResolvedModulePath(declaration))
      .filter((targetPath): targetPath is string => targetPath !== null && targetPath.startsWith(`${CHILDREN_ROOT}/`))
      .map((targetPath) => targetPath.slice(`${CHILDREN_ROOT}/`.length).split("/")[0] ?? targetPath),
  );
  const missingChildren = REQUIRED_CHILDREN.filter((childId) => !childIds.has(childId) || !importedRegistryChildren.has(childId));

  if (missingChildren.length === 0) {
    return [];
  }

  return [createFinding({
    lawId: LAW_CHILDREN,
    file: REGISTRY_PATH,
    line: 1,
    severity: "fatal",
    message: "Forensics child registry and schema enum are out of parity.",
    detail: missingChildren.join(", "),
  })];
};

const collectExternalChildImportFindings = (project: import("ts-morph").Project): Finding[] => {
  const violation = project.getSourceFiles(pathFromRepoRoot("src/**/*.ts")).find((sourceFile) => {
    const sourcePath = toRepoRelativePath(sourceFile.getFilePath());
    if (sourcePath.startsWith(`${ROOT}/`)) {
      return false;
    }

    return sourceFile.getImportDeclarations().some((declaration) => {
      const resolved = getResolvedModulePath(declaration);
      return resolved !== null && resolved.startsWith(`${CHILDREN_ROOT}/`);
    });
  });

  return violation
    ? [createFinding({ lawId: LAW_CHILDREN, file: toRepoRelativePath(violation.getFilePath()), line: 1, severity: "fatal", message: "External modules must not import Forensics child implementations." })]
    : [];
};

const collectLegacyImportFindings = (project: import("ts-morph").Project): Finding[] => {
  const violation = getForensicsSources(project).find((sourceFile) => sourceFile.getImportDeclarations().some((declaration) => {
    const specifier = declaration.getModuleSpecifierValue();
    return FORBIDDEN_LEGACY_IMPORT_MARKERS.some((marker) => specifier.includes(marker));
  }));

  return violation
    ? [createFinding({ lawId: LAW_CONTRACT, file: toRepoRelativePath(violation.getFilePath()), line: 1, severity: "fatal", message: "Forensics canonical root imports forbidden legacy business contracts." })]
    : [];
};

const collectContractFindings = (project: import("ts-morph").Project): Finding[] => {
  const findings: Finding[] = [];
  const baseSchemaSource = getSourceFileOrThrow(project, `${SHARED_ROOT}/forensics-base-schema.ts`);
  const storagePortSource = getSourceFileOrThrow(project, `${PORTS_ROOT}/forensics-storage-port.ts`);
  const artifactPortSource = getSourceFileOrThrow(project, `${PORTS_ROOT}/forensics-artifact-storage-port.ts`);
  const envelopeFields = getZodObjectPropertyNames(baseSchemaSource, "ForensicsRecordEnvelopeSchema");
  const proofFields = getZodObjectPropertyNames(baseSchemaSource, "ForensicsRuntimeProofSchema");
  const storageMethods = new Set(storagePortSource.getInterfaceOrThrow("ForensicsStoragePort").getMethods().map((method) => method.getName()));
  const artifactMethods = new Set(artifactPortSource.getInterfaceOrThrow("ForensicsArtifactStoragePort").getMethods().map((method) => method.getName()));
  const missingEnvelopeFields = REQUIRED_CHAIN_FIELDS.filter((field) => !envelopeFields.has(field));
  const missingProofFields = REQUIRED_CHAIN_FIELDS.filter((field) => !proofFields.has(field));
  const expectedStorageMethods = ["writeRecord", "readRecord", "listRecords", "updateRuntimeSnapshot"];
  const expectedArtifactMethods = ["writeArtifactRef"];

  if (missingEnvelopeFields.length > 0 || missingProofFields.length > 0) {
    findings.push(createFinding({
      lawId: LAW_CHAIN,
      file: `${SHARED_ROOT}/forensics-base-schema.ts`,
      line: 1,
      severity: "fatal",
      message: "Forensics envelope/proof schema is missing required chain fields.",
      detail: [...missingEnvelopeFields.map((field) => `envelope:${field}`), ...missingProofFields.map((field) => `proof:${field}`)].join(", "),
    }));
  }

  if (expectedStorageMethods.some((methodName) => !storageMethods.has(methodName)) || storageMethods.size !== expectedStorageMethods.length) {
    findings.push(createFinding({ lawId: LAW_STORAGE, file: `${PORTS_ROOT}/forensics-storage-port.ts`, line: 1, severity: "fatal", message: "ForensicsStoragePort must expose only writeRecord, readRecord, listRecords, and updateRuntimeSnapshot." }));
  }
  if (expectedArtifactMethods.some((methodName) => !artifactMethods.has(methodName)) || artifactMethods.size !== expectedArtifactMethods.length) {
    findings.push(createFinding({ lawId: LAW_STORAGE, file: `${PORTS_ROOT}/forensics-artifact-storage-port.ts`, line: 1, severity: "fatal", message: "ForensicsArtifactStoragePort must expose only writeArtifactRef." }));
  }

  return findings;
};

const collectSchemaRefFindings = (project: import("ts-morph").Project): Finding[] => {
  const findings: Finding[] = [];
  const aiSource = getSourceFileOrThrow(project, `${CHILDREN_ROOT}/write-ai-result-record/schema.ts`);
  const actionSource = getSourceFileOrThrow(project, `${CHILDREN_ROOT}/write-structured-action-log/schema.ts`);
  const browseSource = getSourceFileOrThrow(project, `${CHILDREN_ROOT}/finalize-browse-ledger/schema.ts`);
  const evidencePacketSource = getSourceFileOrThrow(project, `${CHILDREN_ROOT}/finalize-evidence-packet/schema.ts`);
  const failedRecordSource = getSourceFileOrThrow(project, `${CHILDREN_ROOT}/finalize-failed-record/schema.ts`);
  const aiText = aiSource.getFullText();
  const actionText = actionSource.getFullText();
  const browseText = browseSource.getFullText();
  const evidencePacketText = evidencePacketSource.getFullText();
  const failedRecordText = failedRecordSource.getFullText();

  if (!aiText.includes("promptContractId: z.string().min(1)") || !aiText.includes("promptContractVersion: z.string().min(1)") || !aiText.includes("promptCatalogVersion: z.string().min(1)")) {
    findings.push(createFinding({ lawId: LAW_CHAIN, file: `${CHILDREN_ROOT}/write-ai-result-record/schema.ts`, line: 1, severity: "fatal", message: "AI result record schema must require prompt contract refs." }));
  }
  if (!actionText.includes("actionRef: z.string().min(1)") || !actionText.includes("postActionVerificationRef: z.string().min(1)")) {
    findings.push(createFinding({ lawId: LAW_CHAIN, file: `${CHILDREN_ROOT}/write-structured-action-log/schema.ts`, line: 1, severity: "fatal", message: "Action log schema must require actionRef and postActionVerificationRef." }));
  }
  if (!browseText.includes("decisionRef: z.string().min(1)")) {
    findings.push(createFinding({ lawId: LAW_CHAIN, file: `${CHILDREN_ROOT}/finalize-browse-ledger/schema.ts`, line: 1, severity: "fatal", message: "Browse-ledger finalization schema must require decisionRef." }));
  }
  if (!evidencePacketText.includes("decisionRef: z.string().min(1)")) {
    findings.push(createFinding({ lawId: LAW_CHAIN, file: `${CHILDREN_ROOT}/finalize-evidence-packet/schema.ts`, line: 1, severity: "fatal", message: "Evidence-packet finalization schema must require decisionRef." }));
  }
  if (!failedRecordText.includes("decisionRef: z.string().min(1)")) {
    findings.push(createFinding({ lawId: LAW_CHAIN, file: `${CHILDREN_ROOT}/finalize-failed-record/schema.ts`, line: 1, severity: "fatal", message: "Failed-record finalization schema must require decisionRef." }));
  }

  return findings;
};

const collectRuntimePipelineFindings = (project: import("ts-morph").Project): Finding[] => {
  const findings: Finding[] = [];
  const executorSource = getSourceFileOrThrow(project, `${SHARED_ROOT}/forensics-executor.ts`);
  const writeGateSource = getSourceFileOrThrow(project, `${SHARED_ROOT}/forensics-write-gate.ts`);
  const envelopeBuilderSource = getSourceFileOrThrow(project, `${SHARED_ROOT}/forensics-envelope-builder.ts`);
  const proofBuilderSource = getSourceFileOrThrow(project, `${SHARED_ROOT}/forensics-proof-builder.ts`);
  const resultBuilderSource = getSourceFileOrThrow(project, `${SHARED_ROOT}/forensics-result-builder.ts`);

  const executorOkay = hasCallExpressionPath(executorSource, ["evaluateForensicsPolicy"])
    && hasCallExpressionPath(executorSource, ["evaluateForensicsIntegrity"])
    && hasCallExpressionPath(executorSource, ["persistForensicsArtifacts"])
    && hasCallExpressionPath(executorSource, ["buildForensicsEnvelope"])
    && hasCallExpressionPath(executorSource, ["writeForensicsEnvelope"])
    && hasCallExpressionPath(resultBuilderSource, ["buildForensicsProof"]);
  const writeGateText = writeGateSource.getFullText();
  const envelopeText = envelopeBuilderSource.getFullText();
  const proofText = proofBuilderSource.getFullText();
  const missingBuilderFields = REQUIRED_CHAIN_FIELDS.filter((field) => !envelopeText.includes(`${field}:`) || !proofText.includes(`${field}:`));

  if (!executorOkay) {
    findings.push(createFinding({ lawId: LAW_RUNTIME, file: `${SHARED_ROOT}/forensics-executor.ts`, line: 1, severity: "fatal", message: "Forensics executor pipeline is missing one or more governed gates." }));
  }
  if (!writeGateText.includes("recordStorage.writeRecord") || !writeGateText.includes("recordStorage.updateRuntimeSnapshot") || writeGateText.includes("appendRecord") || writeGateText.includes("replaceRecordByRound") || writeGateText.includes("replaceRecordBySession")) {
    findings.push(createFinding({ lawId: LAW_STORAGE, file: `${SHARED_ROOT}/forensics-write-gate.ts`, line: 1, severity: "fatal", message: "Forensics write gate must use generic writeRecord/updateRuntimeSnapshot only." }));
  }
  if (missingBuilderFields.length > 0 || !proofText.includes("reviewRequiredReason:") || !proofText.includes("integrityHash: input.storedRecord?.envelope.integrityHash ?? null")) {
    findings.push(createFinding({ lawId: LAW_CHAIN, file: `${SHARED_ROOT}/forensics-proof-builder.ts`, line: 1, severity: "fatal", message: "Envelope/proof builders are missing required chain parity fields.", detail: missingBuilderFields.join(", ") || "reviewRequiredReason, integrityHash" }));
  }

  return findings;
};

const collectBoundaryFindings = (project: import("ts-morph").Project): Finding[] => {
  const findings: Finding[] = [];
  const forbiddenImportSource = getForensicsSources(project).find((sourceFile) => sourceUsesForbiddenImports(sourceFile));
  const oldStoreApiSource = getForensicsSources(project).find((sourceFile) => FORBIDDEN_ROOT_SYMBOLS.some((symbol) => sourceFile.getFullText().includes(symbol)));

  if (forbiddenImportSource) {
    findings.push(createFinding({ lawId: LAW_BOUNDARY, file: toRepoRelativePath(forbiddenImportSource.getFilePath()), line: 1, severity: "fatal", message: "Forensics root crosses forbidden capability boundaries." }));
  }
  if (oldStoreApiSource) {
    findings.push(createFinding({ lawId: LAW_OWNER, file: toRepoRelativePath(oldStoreApiSource.getFilePath()), line: 1, severity: "fatal", message: "Forensics canonical root exposes old storage-owner APIs." }));
  }
  if (indexLeaksInternals(getSourceFileOrThrow(project, INDEX_PATH))) {
    findings.push(createFinding({ lawId: LAW_CONTRACT, file: INDEX_PATH, line: 1, severity: "error", message: "Forensics public index leaks internal paths or non-public helpers." }));
  }

  return findings;
};

const collectExecutorBypassFindings = (project: import("ts-morph").Project): Finding[] => {
  const violation = REQUIRED_CHILDREN.find((childId) => {
    const implementationSource = getSourceFileOrThrow(project, `${CHILDREN_ROOT}/${childId}/implementation.ts`);
    return childImplementationBypassesExecutor(implementationSource);
  });

  return violation
    ? [createFinding({ lawId: LAW_RUNTIME, file: `${CHILDREN_ROOT}/${violation}/implementation.ts`, line: 1, severity: "fatal", message: "Forensics child implementation bypasses the unified executor pipeline." })]
    : [];
};

const collectLawCoverageFindings = (context: InspectorContext): Finding[] => {
  const domainLaws = context.lawRegistry.laws
    .filter((law) => law.capabilityDomain === "forensics-persistence-capability" && law.lawId.startsWith("GRASSEYE-FORENSICS-PERSISTENCE-"))
    .map((law) => law.lawId);
  const manifest = context.manifestsByDomain.get("forensics-persistence-capability");

  if (!manifest) {
    return [];
  }

  const missingLawIds = domainLaws.filter((lawId) => !manifest.allowedLawIds.includes(lawId));
  return missingLawIds.length > 0
    ? [createFinding({ lawId: LAW_ENFORCEMENT, file: manifest.manifestPath, line: 1, severity: "fatal", message: "Forensics manifest does not cover all active Forensics laws.", detail: missingLawIds.join(", ") })]
    : [];
};

const createDomainPhase = (name: string, lawIds: readonly string[], findings: Finding[], summary: { pass: string; fail: string }): InspectorPhase => {
  const passed = findings.every((finding) => !lawIds.includes(finding.lawId));
  return createPhase(name, passed ? "PASS" : "CODE VIOLATION", passed, passed ? summary.pass : summary.fail);
};

export async function runForensicsP0Checks(context: InspectorContext): Promise<{ findings: Finding[]; phases: InspectorPhase[]; project: import("ts-morph").Project }> {
  const project = createAuditProject();
  const findings = [
    ...(await collectForbiddenRootDirFindings()),
    ...collectChildParityFindings(project),
    ...collectExternalChildImportFindings(project),
    ...collectLegacyImportFindings(project),
    ...collectContractFindings(project),
    ...collectSchemaRefFindings(project),
    ...collectRuntimePipelineFindings(project),
    ...collectBoundaryFindings(project),
    ...collectExecutorBypassFindings(project),
    ...collectLawCoverageFindings(context),
  ];

  return {
    findings,
    project,
    phases: [
      createDomainPhase("required-shape", [LAW_OWNER, LAW_CHILDREN], findings, {
        pass: "Forensics root shape, child parity, and forbidden directories are aligned with the final law.",
        fail: "Forensics root shape still contains forbidden directories or child topology drift.",
      }),
      createDomainPhase("contract-native", [LAW_BOUNDARY, LAW_CONTRACT, LAW_CHAIN], findings, {
        pass: "Forensics public contract is native, chain-complete, and free of legacy business type leakage.",
        fail: "Forensics contract still leaks legacy imports or misses required chain refs.",
      }),
      createDomainPhase("runtime-pipeline", [LAW_RUNTIME, LAW_STORAGE], findings, {
        pass: "Forensics executor, write gate, and storage ports follow the unified generic pipeline.",
        fail: "Forensics runtime pipeline or storage-port boundary is not enforced.",
      }),
      createDomainPhase("enforcement-coverage", [LAW_ENFORCEMENT], findings, {
        pass: "Forensics active law coverage is wired into manifest-owned enforcement.",
        fail: "Forensics manifest or enforcement coverage is incomplete for active laws.",
      }),
    ],
  };
}