import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";

import { openInspectionConstants } from "./inspection-constants.js";
import { getZodEnumValues, getZodObjectPropertyNames, hasLiteralTextFragment } from "./open-ast-queries.js";
import { openInspectionUtils } from "./inspection-utils.js";

const {
  CHILDREN,
  FORBIDDEN_PROOF_FIELDS,
  FORBIDDEN_RESULT_FIELDS,
  LAW_INPUT_CHAIN,
  LAW_PAGE_STATE_HANDOFF,
  LAW_PACKAGE_SHAPE,
  LAW_RESULT_PROOF,
  REQUIRED_SCHEMA_DECLARATIONS,
  SCHEMA_BASE_PATH,
  SCHEMA_CORE_PATH,
  SCHEMA_PATH,
  SCHEMA_PROOF_PATH,
  PROOF_REQUIRED_FIELDS,
  REQUEST_REQUIRED_FIELDS,
  RESULT_REQUIRED_FIELDS,
} = openInspectionConstants;
const { getObjectLiteralPropertyNames, getOpenSourceOrThrow } = openInspectionUtils;

const REQUIRED_VALIDATION_MARKERS = [
  ["parsed runtime proof requires browserSessionRef", LAW_RESULT_PROOF, "Open runtime proof must require browserSessionRef on parsed execution."],
  ["fallback_trace_only runtime proof requires receivedShapeHash", LAW_RESULT_PROOF, "Open runtime proof must require receivedShapeHash for fallback invalid-input proof."],
  ["success proof requires page-state handoff", LAW_PAGE_STATE_HANDOFF, "Open runtime proof must require page-state handoff on success."],
  ["failed and review_required proof must expose diagnosticPayloadRef", LAW_RESULT_PROOF, "Open runtime proof must require diagnosticPayloadRef on failed/review outcomes."],
  ["failed and review_required result must expose diagnosticPayloadRef", LAW_RESULT_PROOF, "Open result must require diagnosticPayloadRef on failed/review outcomes."],
  ["success result must not expose diagnosticPayloadRef", LAW_RESULT_PROOF, "Open result must block diagnosticPayloadRef on success."],
] as const;

type OpenSchemaContext = {
  childIds: string[];
  exportedDeclarations: ReadonlyMap<string, import("ts-morph").ExportedDeclarations[]>;
  proofFields: Set<string>;
  requestFields: Set<string>;
  resultFields: Set<string>;
  schemaProofSource: import("ts-morph").SourceFile;
};

function collectMissingFieldFindings(input: {
  actualFields: Set<string>;
  requiredFields: readonly string[];
  lawId: string;
  file: string;
  message: string;
}): Finding[] {
  const missingFields = input.requiredFields.filter((field) => !input.actualFields.has(field));
  return missingFields.length === 0
    ? []
    : [createFinding({ lawId: input.lawId, file: input.file, line: 1, severity: "fatal", message: input.message, detail: missingFields.join(",") })];
}

function collectForbiddenFieldFindings(input: {
  actualFields: Set<string>;
  forbiddenFields: readonly string[];
  lawId: string;
  file: string;
  message: string;
}): Finding[] {
  const forbiddenPresent = input.forbiddenFields.filter((field) => input.actualFields.has(field));
  return forbiddenPresent.length === 0
    ? []
    : [createFinding({ lawId: input.lawId, file: input.file, line: 1, severity: "fatal", message: input.message, detail: forbiddenPresent.join(",") })];
}

const createOpenSchemaContext = (project: import("ts-morph").Project): OpenSchemaContext => {
  const schemaSource = getOpenSourceOrThrow(project, SCHEMA_PATH);
  const schemaProofSource = getOpenSourceOrThrow(project, SCHEMA_PROOF_PATH);
  return {
    childIds: getZodEnumValues(getOpenSourceOrThrow(project, SCHEMA_BASE_PATH), "OpenChildCapabilityIdSchema"),
    exportedDeclarations: schemaSource.getExportedDeclarations(),
    proofFields: new Set([
      ...getObjectLiteralPropertyNames(schemaProofSource, "openRuntimeProofIdentityShape"),
      ...getObjectLiteralPropertyNames(schemaProofSource, "openRuntimeProofSourceShape"),
      ...getObjectLiteralPropertyNames(schemaProofSource, "openRuntimeProofDecisionShape"),
      ...getObjectLiteralPropertyNames(schemaProofSource, "openRuntimeProofClockShape"),
    ]),
    requestFields: getZodObjectPropertyNames(getOpenSourceOrThrow(project, SCHEMA_CORE_PATH), "OpenRequestSchema"),
    resultFields: getZodObjectPropertyNames(schemaProofSource, "OpenResultSchema"),
    schemaProofSource,
  };
};

const collectPackageShapeFindings = (context: OpenSchemaContext): Finding[] => {
  const findings: Finding[] = [];

  if (context.childIds.sort().join(",") !== [...CHILDREN].sort().join(",")) {
    findings.push(createFinding({ lawId: LAW_PACKAGE_SHAPE, file: SCHEMA_PATH, line: 1, severity: "fatal", message: "Open schema child ids must match the governed child catalog exactly." }));
  }

  for (const schemaName of REQUIRED_SCHEMA_DECLARATIONS) {
    if (!context.exportedDeclarations.has(schemaName)) {
      findings.push(createFinding({ lawId: LAW_PACKAGE_SHAPE, file: SCHEMA_PATH, line: 1, severity: "fatal", message: `Open schema must define ${schemaName}.` }));
    }
  }

  return findings;
};

const collectSchemaContractFindings = (context: OpenSchemaContext): Finding[] => {
  const findings: Finding[] = [];

  if (!hasLiteralTextFragment(context.schemaProofSource, "result must not expose output")) {
    findings.push(createFinding({ lawId: LAW_RESULT_PROOF, file: SCHEMA_PATH, line: 1, severity: "fatal", message: "Open result schema must reject executable output on failed or review_required results." }));
  }
  if (!hasLiteralTextFragment(context.schemaProofSource, "startedMonotonicMs must not be after endedMonotonicMs")) {
    findings.push(createFinding({ lawId: LAW_RESULT_PROOF, file: SCHEMA_PATH, line: 1, severity: "fatal", message: "Open runtime proof must validate monotonic clock ordering." }));
  }

  return [
    ...findings,
    ...collectMissingFieldFindings({ actualFields: context.requestFields, requiredFields: REQUEST_REQUIRED_FIELDS, lawId: LAW_INPUT_CHAIN, file: SCHEMA_CORE_PATH, message: "OpenRequestSchema must carry the FINAL V2 governed chain and dispatch fields." }),
    ...collectMissingFieldFindings({ actualFields: context.resultFields, requiredFields: RESULT_REQUIRED_FIELDS, lawId: LAW_RESULT_PROOF, file: SCHEMA_PROOF_PATH, message: "OpenResultSchema must carry the FINAL V2 result chain, diagnostic, and proof fields." }),
    ...collectMissingFieldFindings({ actualFields: context.proofFields, requiredFields: PROOF_REQUIRED_FIELDS, lawId: LAW_RESULT_PROOF, file: SCHEMA_PROOF_PATH, message: "OpenRuntimeProof must retain the FINAL V2 execution chain, gate decisions, and invalid-input proof fields." }),
    ...collectForbiddenFieldFindings({ actualFields: context.resultFields, forbiddenFields: FORBIDDEN_RESULT_FIELDS, lawId: LAW_PAGE_STATE_HANDOFF, file: SCHEMA_PROOF_PATH, message: "OpenResultSchema must not expose Page State or PAV truth fields." }),
    ...collectForbiddenFieldFindings({ actualFields: context.proofFields, forbiddenFields: FORBIDDEN_PROOF_FIELDS, lawId: LAW_PAGE_STATE_HANDOFF, file: SCHEMA_PROOF_PATH, message: "OpenRuntimeProof must not expose Page State or PAV truth fields." }),
  ];
};

const collectValidationMarkerFindings = (schemaProofSource: import("ts-morph").SourceFile): Finding[] => {
  return REQUIRED_VALIDATION_MARKERS.flatMap(([marker, lawId, message]) => {
    return hasLiteralTextFragment(schemaProofSource, marker)
      ? []
      : [createFinding({ lawId, file: SCHEMA_PROOF_PATH, line: 1, severity: "fatal", message })];
  });
};

export function runOpenSchemaShapeChecks(project: import("ts-morph").Project): Finding[] {
  const context = createOpenSchemaContext(project);
  return [
    ...collectPackageShapeFindings(context),
    ...collectSchemaContractFindings(context),
    ...collectValidationMarkerFindings(context.schemaProofSource),
  ];
}