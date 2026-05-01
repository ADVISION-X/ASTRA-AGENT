export const structuredLoggingInspectionConstants = {
  LAW_DISCIPLINE: "GRASSEYE-STRUCTURED-LOGGING-001-V1",
  LAW_TRACEABILITY: "GRASSEYE-STRUCTURED-LOGGING-002-V2",
  TYPES_PATH: "src/types/structured-log.ts",
  RUNTIME_PROOF_SUPPORT_PATH: "src/lib/local-runtime/runtime-proof-support.ts",
  RUNTIME_ACTION_SUPPORT_PATH: "src/lib/local-runtime/runtime-action-support.ts",
  FORENSICS_CONTRACT_PATH: "src/capabilities/forensics-persistence/contract.ts",
  FORENSICS_RUNTIME_PROOF_PATH: "src/capabilities/forensics-persistence/shared/runtime-proof.ts",
  FORENSICS_RESULT_PATH: "src/capabilities/forensics-persistence/shared/persistence-result.ts",
  STRUCTURED_RUNTIME_CHILD_PATH: "src/capabilities/forensics-persistence/children/write-structured-runtime-event/implementation.ts",
  STRUCTURED_ACTION_CHILD_PATH: "src/capabilities/forensics-persistence/children/write-structured-action-log/implementation.ts",
  RUNTIME_SNAPSHOT_CHILD_PATH: "src/capabilities/forensics-persistence/children/update-runtime-snapshot/implementation.ts",
  EXECUTOR_PATH: "src/capabilities/orchestration/bounded-local-runtime-execution/executor.ts",
  COMMENT_DIRECTIVES: ["@ts-ignore", "@ts-expect-error", "eslint-disable"] as const,
} as const;

export const GOVERNED_SOURCE_PATHS = [
  structuredLoggingInspectionConstants.TYPES_PATH,
  structuredLoggingInspectionConstants.RUNTIME_PROOF_SUPPORT_PATH,
  structuredLoggingInspectionConstants.RUNTIME_ACTION_SUPPORT_PATH,
  structuredLoggingInspectionConstants.FORENSICS_RUNTIME_PROOF_PATH,
  structuredLoggingInspectionConstants.FORENSICS_RESULT_PATH,
  structuredLoggingInspectionConstants.STRUCTURED_RUNTIME_CHILD_PATH,
  structuredLoggingInspectionConstants.STRUCTURED_ACTION_CHILD_PATH,
  structuredLoggingInspectionConstants.RUNTIME_SNAPSHOT_CHILD_PATH,
  structuredLoggingInspectionConstants.EXECUTOR_PATH,
] as const;