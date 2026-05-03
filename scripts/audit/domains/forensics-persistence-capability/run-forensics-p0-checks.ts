import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createFinding } from "../../core/result.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../core/schema.js";
import { getZodEnumValues, getZodObjectPropertyNames } from "../_shared/ast-schema-queries.js";
import { createAuditProject, getSourceFileOrThrow, hasCallExpressionPath } from "../_shared/ast-helpers.js";

import {
  countOccurrences,
  createDomainPhase,
  forensicsP0CheckConstants,
  getForensicsSources,
  getObjectLiteralPropertyNames,
} from "./forensics-p0-check-support.js";
import {
  collectArtifactPromotionFindings,
  collectLawCoverageFindings,
  collectSchemaRefFindings,
} from "./forensics-p0-checks-metadata.js";
import { forensicsPersistenceInspectionConstants } from "./inspection-constants.js";
import { forensicsPersistenceInspectionUtils } from "./inspection-utils.js";

const {
  FORBIDDEN_LEGACY_IMPORT_MARKERS,
  FORBIDDEN_ROOT_DIRS,
  FORBIDDEN_ROOT_SYMBOLS,
  REQUIRED_ENVELOPE_FIELDS,
  REQUIRED_PROOF_FIELDS,
} = forensicsP0CheckConstants;

const {
  CHILDREN_ROOT,
  INDEX_PATH,
  LAW_BOUNDARY,
  LAW_CHAIN,
  LAW_CHILDREN,
  LAW_CONTRACT,
  LAW_ENFORCEMENT,
  LAW_ARTIFACT_PROMOTION,
  LAW_OWNER,
  LAW_RUNTIME,
  LAW_STORAGE,
  PORTS_ROOT,
  REGISTRY_PATH,
  REQUIRED_CHILDREN,
  ROOT,
  SHARED_ROOT,
} = forensicsPersistenceInspectionConstants;
const {
  childImplementationBypassesExecutor,
  getResolvedModulePath,
  indexLeaksInternals,
  sourceUsesForbiddenImports,
} = forensicsPersistenceInspectionUtils;

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
  const proofFields = getObjectLiteralPropertyNames(baseSchemaSource, "ForensicsRuntimeProofFieldSchemas");
  const storageMethods = new Set(storagePortSource.getInterfaceOrThrow("ForensicsStoragePort").getMethods().map((method) => method.getName()));
  const artifactMethods = new Set(artifactPortSource.getInterfaceOrThrow("ForensicsArtifactStoragePort").getMethods().map((method) => method.getName()));
  const missingEnvelopeFields = REQUIRED_ENVELOPE_FIELDS.filter((field) => !envelopeFields.has(field));
  const missingProofFields = REQUIRED_PROOF_FIELDS.filter((field) => !proofFields.has(field));
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

const isExecutorPipelineOkay = (
  executorSource: import("ts-morph").SourceFile,
  resultBuilderSource: import("ts-morph").SourceFile,
): boolean => {
  return hasCallExpressionPath(executorSource, ["evaluateForensicsPolicy"])
    && hasCallExpressionPath(executorSource, ["evaluateForensicsIntegrity"])
    && hasCallExpressionPath(executorSource, ["persistForensicsArtifacts"])
    && hasCallExpressionPath(executorSource, ["buildForensicsEnvelope"])
    && hasCallExpressionPath(executorSource, ["writeForensicsEnvelope"])
    && hasCallExpressionPath(resultBuilderSource, ["buildForensicsProof"]);
};

const collectBuilderParityDetail = (envelopeText: string, proofText: string): string[] => {
  const missingEnvelopeBuilderFields = REQUIRED_ENVELOPE_FIELDS.filter((field) => !envelopeText.includes(`${field}:`));
  const missingProofBuilderFields = REQUIRED_PROOF_FIELDS.filter((field) => !proofText.includes(`${field}:`));
  const capabilityCallIdWriteCount = countOccurrences(envelopeText, 'capabilityCallId: requireChainValue("capabilityCallId", input.request.capabilityCallId)');

  return [
    ...missingEnvelopeBuilderFields.map((field) => `envelope:${field}`),
    ...missingProofBuilderFields.map((field) => `proof:${field}`),
    ...(!proofText.includes("reviewRequiredReason:") ? ["proof:reviewRequiredReason"] : []),
    ...(!proofText.includes("integrityHash: input.storedRecord?.envelope.integrityHash ?? null") ? ["proof:integrityHash"] : []),
    ...(capabilityCallIdWriteCount < 2 ? ["envelope:capabilityCallId-hash-parity"] : []),
  ];
};

const collectRuntimePipelineFindings = (project: import("ts-morph").Project): Finding[] => {
  const findings: Finding[] = [];
  const executorSource = getSourceFileOrThrow(project, `${SHARED_ROOT}/forensics-executor.ts`);
  const writeGateSource = getSourceFileOrThrow(project, `${SHARED_ROOT}/forensics-write-gate.ts`);
  const envelopeBuilderSource = getSourceFileOrThrow(project, `${SHARED_ROOT}/forensics-envelope-builder.ts`);
  const proofBuilderSource = getSourceFileOrThrow(project, `${SHARED_ROOT}/forensics-proof-builder.ts`);
  const resultBuilderSource = getSourceFileOrThrow(project, `${SHARED_ROOT}/forensics-result-builder.ts`);
  const writeGateText = writeGateSource.getFullText();
  const envelopeText = envelopeBuilderSource.getFullText();
  const proofText = proofBuilderSource.getFullText();
  const builderParityDetail = collectBuilderParityDetail(envelopeText, proofText);

  if (!isExecutorPipelineOkay(executorSource, resultBuilderSource)) {
    findings.push(createFinding({ lawId: LAW_RUNTIME, file: `${SHARED_ROOT}/forensics-executor.ts`, line: 1, severity: "fatal", message: "Forensics executor pipeline is missing one or more governed gates." }));
  }
  if (!writeGateText.includes("recordStorage.writeRecord") || !writeGateText.includes("recordStorage.updateRuntimeSnapshot") || writeGateText.includes("appendRecord") || writeGateText.includes("replaceRecordByRound") || writeGateText.includes("replaceRecordBySession")) {
    findings.push(createFinding({ lawId: LAW_STORAGE, file: `${SHARED_ROOT}/forensics-write-gate.ts`, line: 1, severity: "fatal", message: "Forensics write gate must use generic writeRecord/updateRuntimeSnapshot only." }));
  }
  if (builderParityDetail.length > 0) {
    findings.push(createFinding({
      lawId: LAW_CHAIN,
      file: `${SHARED_ROOT}/forensics-proof-builder.ts`,
      line: 1,
      severity: "fatal",
      message: "Envelope/proof builders are missing required chain parity fields.",
      detail: builderParityDetail.join(", "),
    }));
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

export async function runForensicsP0Checks(context: InspectorContext): Promise<{ findings: Finding[]; phases: InspectorPhase[]; project: import("ts-morph").Project }> {
  const project = createAuditProject();
  const findings = [
    ...(await collectForbiddenRootDirFindings()),
    ...collectChildParityFindings(project),
    ...collectExternalChildImportFindings(project),
    ...collectLegacyImportFindings(project),
    ...collectContractFindings(project),
    ...collectSchemaRefFindings(project),
    ...collectArtifactPromotionFindings(project),
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
      createDomainPhase("contract-native", [LAW_BOUNDARY, LAW_CONTRACT, LAW_CHAIN, LAW_ARTIFACT_PROMOTION], findings, {
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