import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getSourceFileOrThrow } from "../_shared/ast-helpers.js";

import { forensicsPersistenceInspectionConstants } from "./inspection-constants.js";
import { forensicsPersistenceInspectionUtils } from "./inspection-utils.js";

const {
  INDEX_PATH,
  LAW_RETIRED_ROOT,
  LAW_RUNTIME,
  LAW_STORAGE,
  LEGACY_LOCAL_DATA_ROOT,
  LEGACY_STORAGE_PORT_PATH,
  ROOT,
  RUNTIME_ROOT,
  STORAGE_ADAPTER_PATH,
  WORKBENCH_PATH,
} = forensicsPersistenceInspectionConstants;
const {
  getFunctionLine,
  getIdentifierReferencePaths,
  hasExecutorOutputSchemaParse,
  hasHashBuilderShape,
  hasWriteGateSnapshotPath,
  indexLeaksInternals,
  sourceHasCallPath,
} = forensicsPersistenceInspectionUtils;

const collectExecutorFindings = (project: import("ts-morph").Project): Finding[] => {
  const executorPath = `${RUNTIME_ROOT}/forensics-executor.ts`;
  const executorSource = getSourceFileOrThrow(project, executorPath);
  const resultBuilderSource = getSourceFileOrThrow(project, `${RUNTIME_ROOT}/forensics-result-builder.ts`);
  const executorValid = sourceHasCallPath(executorSource, ["evaluateForensicsPolicy"])
    && sourceHasCallPath(executorSource, ["evaluateForensicsIntegrity"])
    && sourceHasCallPath(executorSource, ["buildForensicsEnvelope"])
    && sourceHasCallPath(executorSource, ["writeForensicsEnvelope"])
    && sourceHasCallPath(executorSource, ["persistForensicsArtifacts"])
    && sourceHasCallPath(resultBuilderSource, ["buildForensicsProof"])
    && hasExecutorOutputSchemaParse(executorSource);

  return executorValid
    ? []
    : [createFinding({ lawId: LAW_RUNTIME, file: executorPath, line: getFunctionLine(executorSource, "executeForensicsChild"), severity: "fatal", message: "Forensics executor is missing one or more required runtime gates or output-schema enforcement." })];
};

const collectRuntimeReferenceFindings = (project: import("ts-morph").Project): Finding[] => {
  const policyReferences = getIdentifierReferencePaths(getSourceFileOrThrow(project, `${RUNTIME_ROOT}/forensics-policy-gate.ts`), "evaluateForensicsPolicy");
  const integrityReferences = getIdentifierReferencePaths(getSourceFileOrThrow(project, `${RUNTIME_ROOT}/forensics-integrity-gate.ts`), "evaluateForensicsIntegrity");
  const proofReferences = getIdentifierReferencePaths(getSourceFileOrThrow(project, `${RUNTIME_ROOT}/forensics-proof-builder.ts`), "buildForensicsProof");
  const runtimeClosed = policyReferences.has(`${RUNTIME_ROOT}/forensics-executor.ts`)
    && integrityReferences.has(`${RUNTIME_ROOT}/forensics-executor.ts`)
    && proofReferences.has(`${RUNTIME_ROOT}/forensics-result-builder.ts`);

  return runtimeClosed
    ? []
    : [createFinding({ lawId: LAW_RUNTIME, file: `${RUNTIME_ROOT}/forensics-result-builder.ts`, line: 1, severity: "error", message: "Forensics runtime references do not close across policy, integrity, and proof builders." })];
};

const collectHashBuilderFindings = (project: import("ts-morph").Project): Finding[] => {
  const findings: Finding[] = [];
  const hashBuilderPath = `${RUNTIME_ROOT}/forensics-hash-builder.ts`;
  const hashBuilderSource = getSourceFileOrThrow(project, hashBuilderPath);

  if (!hasHashBuilderShape(hashBuilderSource)) {
    findings.push(createFinding({ lawId: LAW_RUNTIME, file: hashBuilderPath, line: 1, severity: "error", message: "Forensics integrity hashing is missing canonical serialization or the dedicated hash builder seam." }));
  }

  const forbiddenHashSite = project.getSourceFiles(pathFromRepoRoot(`${ROOT}/**/*.ts`)).find((sourceFile) => {
    const relativePath = toRepoRelativePath(sourceFile.getFilePath());
    if (relativePath === hashBuilderPath) {
      return false;
    }

    return sourceFile.getFullText().includes("JSON.stringify(");
  });
  if (forbiddenHashSite) {
    findings.push(createFinding({ lawId: LAW_RUNTIME, file: toRepoRelativePath(forbiddenHashSite.getFilePath()), line: 1, severity: "error", message: "Forensics runtime cannot hash evidence through ad hoc JSON.stringify calls outside the canonical hash builder." }));
  }

  return findings;
};

const collectStorageFindings = (project: import("ts-morph").Project): Finding[] => {
  const findings: Finding[] = [];
  const writeGateSource = getSourceFileOrThrow(project, `${RUNTIME_ROOT}/forensics-write-gate.ts`);
  const adapterSource = getSourceFileOrThrow(project, STORAGE_ADAPTER_PATH);
  const workbenchSource = getSourceFileOrThrow(project, WORKBENCH_PATH);
  const workbenchHasSplitPorts = workbenchSource.getImportDeclarations().some((declaration) => {
    const target = declaration.getModuleSpecifierSourceFile();
    if (!target || toRepoRelativePath(target.getFilePath()) !== STORAGE_ADAPTER_PATH) {
      return false;
    }

    return declaration.getNamedImports().some((namedImport) => {
      const importName = namedImport.getName();
      return importName === "createEvidenceStoreForensicsRecordStoragePort"
        || importName === "createEvidenceStoreForensicsArtifactStoragePort";
    });
  });

  if (!hasWriteGateSnapshotPath(writeGateSource) || !sourceHasCallPath(adapterSource, ["evidenceStore", "saveStructuredRuntimeEvent"])) {
    findings.push(createFinding({ lawId: LAW_STORAGE, file: `${RUNTIME_ROOT}/forensics-write-gate.ts`, line: 1, severity: "error", message: "Runtime snapshot persistence is not isolated behind the dedicated snapshot write path." }));
  }
  if (!workbenchHasSplitPorts) {
    findings.push(createFinding({ lawId: LAW_STORAGE, file: WORKBENCH_PATH, line: 1, severity: "error", message: "Workbench must compose Forensics through the dedicated record and artifact storage ports." }));
  }

  return findings;
};

const collectRetiredRootFindings = async (project: import("ts-morph").Project): Promise<Finding[]> => {
  const findings: Finding[] = [];
  const indexSource = getSourceFileOrThrow(project, INDEX_PATH);
  const legacyLocalDataExists = await fileExists(pathFromRepoRoot(LEGACY_LOCAL_DATA_ROOT));
  const legacyStoragePortExists = await fileExists(pathFromRepoRoot(LEGACY_STORAGE_PORT_PATH));

  if (indexLeaksInternals(indexSource)) {
    findings.push(createFinding({ lawId: LAW_RETIRED_ROOT, file: INDEX_PATH, line: 1, severity: "error", message: "Forensics public index cannot leak runtime internals, children, or export-star barrels." }));
  }
  if (legacyLocalDataExists || legacyStoragePortExists) {
    findings.push(createFinding({ lawId: LAW_RETIRED_ROOT, file: legacyStoragePortExists ? LEGACY_STORAGE_PORT_PATH : LEGACY_LOCAL_DATA_ROOT, line: 1, severity: "fatal", message: "Retired local-data or legacy storage-port surfaces still overlap the Forensics owner boundary." }));
  }

  return findings;
};

export async function runForensicsRuntimeChecks(project: import("ts-morph").Project): Promise<Finding[]> {
  return [
    ...collectExecutorFindings(project),
    ...collectRuntimeReferenceFindings(project),
    ...collectHashBuilderFindings(project),
    ...collectStorageFindings(project),
    ...(await collectRetiredRootFindings(project)),
  ];
}