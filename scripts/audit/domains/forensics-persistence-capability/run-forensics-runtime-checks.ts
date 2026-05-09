import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot, toRepoRelativePath } from "../../core/paths.js";
import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getSourceFileOrThrow } from "../_shared/ast-helpers.js";

import { forensicsPersistenceInspectionConstants } from "./inspection-constants.js";
import { forensicsPersistenceInspectionUtils } from "./inspection-utils.js";

const {
  INDEX_PATH,
  LAW_OWNER,
  LAW_RUNTIME,
  LAW_STORAGE,
  LEGACY_LOCAL_DATA_ROOT,
  LEGACY_STORAGE_PORT_PATH,
  ROOT,
  RUNTIME_ROOT,
  STORAGE_ADAPTER_PATH,
  WORKBENCH_PATH,
} = forensicsPersistenceInspectionConstants;
const EVIDENCE_PACKET_SCHEMA_PATH = "src/types/evidence-packet.ts";
const WORKBENCH_FINALIZATION_PATH = "src/lib/local-runtime/workbench-forensics-finalization-dispatch.ts";
const {
  getFunctionLine,
  getIdentifierReferencePaths,
  hasExecutorOutputSchemaParse,
  hasHashBuilderShape,
  hasWriteGateSnapshotPath,
  indexLeaksInternals,
  sourceHasCallPath,
} = forensicsPersistenceInspectionUtils;

const hasExecutorCorePipeline = (executorSource: import("ts-morph").SourceFile): boolean => (
  sourceHasCallPath(executorSource, ["evaluateForensicsPolicy"])
  && sourceHasCallPath(executorSource, ["evaluateForensicsIntegrity"])
  && sourceHasCallPath(executorSource, ["buildForensicsEnvelope"])
  && sourceHasCallPath(executorSource, ["writeForensicsEnvelope"])
  && sourceHasCallPath(executorSource, ["persistForensicsArtifacts"])
  && hasExecutorOutputSchemaParse(executorSource)
);

const hasExecutorProofPipeline = (
  resultBuilderSource: import("ts-morph").SourceFile,
  proofBuilderSource: import("ts-morph").SourceFile,
): boolean => (
  sourceHasCallPath(resultBuilderSource, ["buildForensicsProof"])
  && proofBuilderSource.getFunctionOrThrow("buildForensicsProof").getText().includes("storedRecord?.storageRef")
);

const collectExecutorFindings = (project: import("ts-morph").Project): Finding[] => {
  const executorPath = `${RUNTIME_ROOT}/forensics-executor.ts`;
  const executorSource = getSourceFileOrThrow(project, executorPath);
  const resultBuilderSource = getSourceFileOrThrow(project, `${RUNTIME_ROOT}/forensics-result-builder.ts`);
  const proofBuilderSource = getSourceFileOrThrow(project, `${RUNTIME_ROOT}/forensics-proof-builder.ts`);
  const executorValid = hasExecutorCorePipeline(executorSource) && hasExecutorProofPipeline(resultBuilderSource, proofBuilderSource);

  return executorValid
    ? []
    : [createFinding({ lawId: LAW_RUNTIME, file: executorPath, line: getFunctionLine(executorSource, "executeForensicsChild"), severity: "fatal", message: "Forensics executor is missing one or more required runtime gates, durable proof status alignment, or output-schema enforcement." })];
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

const hasDurableModeGate = (project: import("ts-morph").Project): boolean => {
  const durabilityModeSource = getSourceFileOrThrow(project, "src/lib/storage/evidence-store/forensics-durability-mode.ts");
  const storageFactorySource = getSourceFileOrThrow(project, "src/lib/storage/evidence-store/create-forensics-persistence-storage.ts");
  return sourceHasCallPath(storageFactorySource, ["assertForensicsDurabilityReady"])
    && sourceHasCallPath(durabilityModeSource, ["resolveForensicsDurabilityMode"])
    && durabilityModeSource.getFullText().includes("GRASSEYE_PHASE_READY")
    && durabilityModeSource.getFullText().includes("memory_only")
    && durabilityModeSource.getFullText().includes("state.json");
};

const hasStructuredStorageRefs = (project: import("ts-morph").Project): boolean => {
  const runtimeStorageSource = getSourceFileOrThrow(project, "src/lib/storage/evidence-store/forensics-record-storage-runtime.ts");
  const actionStorageSource = getSourceFileOrThrow(project, "src/lib/storage/evidence-store/forensics-record-storage-action.ts");
  return sourceHasCallPath(runtimeStorageSource, ["buildEvidenceStoreStorageRef"])
    && sourceHasCallPath(actionStorageSource, ["buildEvidenceStoreStorageRef"]);
};

const hasJsonStateStoreWriteFlow = (jsonStateStoreSource: import("ts-morph").SourceFile): boolean => {
  const jsonStateStoreText = jsonStateStoreSource.getFullText();
  return sourceHasCallPath(jsonStateStoreSource, ["mkdir"])
    && sourceHasCallPath(jsonStateStoreSource, ["writeFile"])
    && sourceHasCallPath(jsonStateStoreSource, ["rename"])
    && jsonStateStoreText.includes("ENOENT");
};

const hasEvidenceStoreWriteProbeFlow = (evidenceStoreSource: import("ts-morph").SourceFile): boolean => {
  const evidenceStoreText = evidenceStoreSource.getFullText();
  return sourceHasCallPath(evidenceStoreSource, ["internals.init"])
    && sourceHasCallPath(evidenceStoreSource, ["internals.listState"])
    && sourceHasCallPath(evidenceStoreSource, ["internals.stateStore.write"])
    && evidenceStoreText.includes("durable_write_probe=passed")
    && evidenceStoreText.includes("forensics_storage_write_failed");
};

const hasDurableStateStoreWriteProbe = (project: import("ts-morph").Project): boolean => {
  const jsonStateStoreSource = getSourceFileOrThrow(project, "src/lib/storage/json-state-store.ts");
  const evidenceStoreSource = getSourceFileOrThrow(project, "src/lib/storage/evidence-store/evidence-store-service.ts");
  return hasJsonStateStoreWriteFlow(jsonStateStoreSource) && hasEvidenceStoreWriteProbeFlow(evidenceStoreSource);
};

const collectDurabilityFindings = (project: import("ts-morph").Project): Finding[] => {
  const findings: Finding[] = [];
  if (!hasDurableModeGate(project)) {
    findings.push(createFinding({ lawId: LAW_STORAGE, file: "src/lib/storage/evidence-store/forensics-durability-mode.ts", line: 1, severity: "fatal", message: "Forensics phase-ready mode must reject memory_only persistence and expose durable state.json storageRef generation." }));
  }
  if (!hasStructuredStorageRefs(project)) {
    findings.push(createFinding({ lawId: LAW_STORAGE, file: "src/lib/storage/evidence-store/forensics-record-storage-runtime.ts", line: 1, severity: "fatal", message: "Structured runtime/action records must return storageRef-backed persisted records instead of remaining memory_only." }));
  }
  if (!hasDurableStateStoreWriteProbe(project)) {
    findings.push(createFinding({ lawId: LAW_STORAGE, file: "src/lib/storage/evidence-store/evidence-store-service.ts", line: 1, severity: "fatal", message: "Forensics evidence store health must create the state directory, recover missing state.json, and perform a durable write probe so storage_write_failed cannot pass mission readiness." }));
  }
  return findings;
};

const collectStorageFindings = (project: import("ts-morph").Project): Finding[] => {
  const findings: Finding[] = [];
  const writeGateSource = getSourceFileOrThrow(project, `${RUNTIME_ROOT}/forensics-write-gate.ts`);
  const adapterSource = getSourceFileOrThrow(project, STORAGE_ADAPTER_PATH);
  const workbenchSource = getSourceFileOrThrow(project, WORKBENCH_PATH);
  const adapterHasSplitPorts = sourceHasCallPath(adapterSource, ["createEvidenceStoreForensicsRecordStoragePort"])
    && sourceHasCallPath(adapterSource, ["createEvidenceStoreForensicsArtifactStoragePort"]);
  const workbenchComposesForensics = sourceHasCallPath(workbenchSource, ["createForensicsPersistenceStorage"])
    && sourceHasCallPath(workbenchSource, ["createForensicsPersistenceAbilityGroup"]);

  if (!hasWriteGateSnapshotPath(writeGateSource)) {
    findings.push(createFinding({ lawId: LAW_STORAGE, file: `${RUNTIME_ROOT}/forensics-write-gate.ts`, line: 1, severity: "error", message: "Runtime snapshot persistence is not isolated behind the dedicated snapshot write path." }));
  }
  if (!adapterHasSplitPorts) {
    findings.push(createFinding({ lawId: LAW_STORAGE, file: STORAGE_ADAPTER_PATH, line: 1, severity: "error", message: "Forensics storage composition must create dedicated record and artifact storage ports." }));
  }
  if (!workbenchComposesForensics) {
    findings.push(createFinding({ lawId: LAW_STORAGE, file: WORKBENCH_PATH, line: 1, severity: "error", message: "Workbench must compose Forensics through the dedicated record and artifact storage ports." }));
  }

  return [...findings, ...collectDurabilityFindings(project)];
};

const hasCommentEvidencePacketSchemaShape = (schemaText: string): boolean => (
  schemaText.includes("rawCommentBlocks")
  && schemaText.includes("cleanedComments")
  && schemaText.includes("uncertainText")
  && schemaText.includes("advancedAIAnalysisPlaceholder")
  && !schemaText.includes("const EvidencePacketCommentSignalsSchema")
);

const hasCommentEvidencePacketFinalizationShape = (finalizationText: string): boolean => (
  finalizationText.includes("commentScreenshotEvidenceIds")
  && finalizationText.includes("rawCommentBlocks")
  && finalizationText.includes("comments_unavailable_candidate_created")
  && finalizationText.includes("advancedAIAnalysisPlaceholder")
  && !finalizationText.includes("commentSignals:")
  && !finalizationText.includes("commentIntentAiResultRef")
);

const collectCommentEvidencePacketFindings = (project: import("ts-morph").Project): Finding[] => {
  const schemaSource = getSourceFileOrThrow(project, EVIDENCE_PACKET_SCHEMA_PATH);
  const finalizationSource = getSourceFileOrThrow(project, WORKBENCH_FINALIZATION_PATH);
  const schemaText = schemaSource.getFullText();
  const finalizationText = finalizationSource.getFullText();
  const findings: Finding[] = [];

  if (!hasCommentEvidencePacketSchemaShape(schemaText)) {
    findings.push(createFinding({ lawId: LAW_RUNTIME, file: EVIDENCE_PACKET_SCHEMA_PATH, line: 1, severity: "fatal", message: "Evidence packet schema must preserve raw comment evidence, OCR cleanup text, and downstream-analysis placeholder fields without local commercial commentSignals." }));
  }

  if (!hasCommentEvidencePacketFinalizationShape(finalizationText)) {
    findings.push(createFinding({ lawId: LAW_RUNTIME, file: WORKBENCH_FINALIZATION_PATH, line: 1, severity: "fatal", message: "Evidence packet finalization must keep comment screenshot refs, raw OCR evidence, comments-unavailable fallback, and advanced-analysis placeholder while rejecting local commercial comment analysis fields." }));
  }

  return findings;
};

const collectRetiredRootFindings = async (project: import("ts-morph").Project): Promise<Finding[]> => {
  const findings: Finding[] = [];
  const indexSource = getSourceFileOrThrow(project, INDEX_PATH);
  const legacyLocalDataExists = await fileExists(pathFromRepoRoot(LEGACY_LOCAL_DATA_ROOT));
  const legacyStoragePortExists = await fileExists(pathFromRepoRoot(LEGACY_STORAGE_PORT_PATH));

  if (indexLeaksInternals(indexSource)) {
    findings.push(createFinding({ lawId: LAW_OWNER, file: INDEX_PATH, line: 1, severity: "error", message: "Forensics public index cannot leak runtime internals, children, or export-star barrels." }));
  }
  if (legacyLocalDataExists || legacyStoragePortExists) {
    findings.push(createFinding({ lawId: LAW_OWNER, file: legacyStoragePortExists ? LEGACY_STORAGE_PORT_PATH : LEGACY_LOCAL_DATA_ROOT, line: 1, severity: "fatal", message: "Retired local-data or legacy storage-port surfaces still overlap the Forensics owner boundary." }));
  }

  return findings;
};

export async function runForensicsRuntimeChecks(project: import("ts-morph").Project): Promise<Finding[]> {
  return [
    ...collectExecutorFindings(project),
    ...collectRuntimeReferenceFindings(project),
    ...collectHashBuilderFindings(project),
    ...collectStorageFindings(project),
    ...collectCommentEvidencePacketFindings(project),
    ...(await collectRetiredRootFindings(project)),
  ];
}
