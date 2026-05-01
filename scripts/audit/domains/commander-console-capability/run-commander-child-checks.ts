import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getSourceFileOrThrow, hasCallExpression } from "../_shared/ast-helpers.js";

import { commanderConsoleInspectionConstants } from "./inspection-constants.js";
import { commanderConsoleInspectionUtils } from "./inspection-utils.js";

const { CHILDREN_ROOT, CHILD_IDS, COMMAND_CHILD_IDS } = commanderConsoleInspectionConstants;
const {
  contractCollapsesToAny,
  findChildDefinition,
  hasChildContractShape,
  hasChildImplementationShape,
  hasChildSchemaShape,
  referenceLeaksOutsideRegistry,
  toUpperSnakeCase,
} = commanderConsoleInspectionUtils;

const collectChildShapeFindings = (input: {
  childId: string;
  schemaPath: string;
  contractPath: string;
  implementationPath: string;
  schemaFile: import("ts-morph").SourceFile;
  contractFile: import("ts-morph").SourceFile;
  implementationFile: import("ts-morph").SourceFile;
}): Finding[] => {
  const findings: Finding[] = [];

  if (!hasChildSchemaShape(input.schemaFile, input.childId)) {
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1", file: input.schemaPath, line: 1, severity: "fatal", message: "Commander child schema.ts must define real local input/output/policy schemas and must not be a re-export shell." }));
  }
  if (!hasChildContractShape(input.contractFile, input.childId)) {
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1", file: input.contractPath, line: 1, severity: "fatal", message: "Commander child contract.ts must define real metadata constants and local input/output types." }));
  }
  if (!hasChildImplementationShape(input.implementationFile, input.childId)) {
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1", file: input.implementationPath, line: 1, severity: "fatal", message: "Commander child implementation must export a real child definition with inputSchema/outputSchema/execute." }));
  }

  const contractDeclaration = input.contractFile.getVariableDeclaration(`${toUpperSnakeCase(input.childId)}_CONTRACT`);
  if (contractCollapsesToAny(contractDeclaration)) {
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-004-V1", file: input.contractPath, line: 1, severity: "fatal", message: "Commander child contracts must stay strongly typed and must not collapse to any." }));
  }

  return findings;
};

const collectChildPrivacyFindings = (input: {
  childId: string;
  implementationPath: string;
  definition: ReturnType<typeof findChildDefinition>;
}): Finding[] => {
  if (!input.definition) {
    return [];
  }

  const leakedReferences = referenceLeaksOutsideRegistry(input.definition);
  return leakedReferences.length > 0
    ? [createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-003-V1", file: leakedReferences[0]!, line: 1, severity: "fatal", message: "Commander child implementations must stay private and only be referenced from registry.ts." })]
    : [];
};

const collectChildExecutionRouteFindings = (input: {
  childId: string;
  implementationPath: string;
  implementationFile: import("ts-morph").SourceFile;
}): Finding[] => {
  const findings: Finding[] = [];

  if (COMMAND_CHILD_IDS.has(input.childId) && !hasCallExpression(input.implementationFile, "executeCommanderCommandChild")) {
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V1", file: input.implementationPath, line: 1, severity: "fatal", message: `Command child ${input.childId} must execute through executeCommanderCommandChild.` }));
  }
  if (!COMMAND_CHILD_IDS.has(input.childId) && !hasCallExpression(input.implementationFile, "executeCommanderReadChild")) {
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V1", file: input.implementationPath, line: 1, severity: "fatal", message: `Read child ${input.childId} must execute through executeCommanderReadChild.` }));
  }

  return findings;
};

const collectChildExecutionSemanticFindings = (input: {
  childId: string;
  implementationPath: string;
  implementationFile: import("ts-morph").SourceFile;
}): Finding[] => {
  const findings: Finding[] = [];

  if (input.childId === "emergency-stop" && input.implementationFile.getFullText().includes('"stop-mission"')) {
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V1", file: input.implementationPath, line: 1, severity: "fatal", message: "emergency-stop child must never downgrade into stop-mission semantics." }));
  }
  if (input.childId === "inspect-record-detail" && !input.implementationFile.getFullText().includes("record_not_found")) {
    findings.push(createFinding({ lawId: "GRASSEYE-COMMANDER-CONSOLE-CAPABILITY-002-V1", file: input.implementationPath, line: 1, severity: "fatal", message: "inspect-record-detail must preserve the record_not_found review-required outcome." }));
  }

  return findings;
};

const collectChildExecutionFindings = (input: {
  childId: string;
  implementationPath: string;
  implementationFile: import("ts-morph").SourceFile;
}): Finding[] => [
  ...collectChildExecutionRouteFindings(input),
  ...collectChildExecutionSemanticFindings(input),
];

const collectSingleChildFindings = (project: import("ts-morph").Project, childId: string): Finding[] => {
  const schemaPath = `${CHILDREN_ROOT}/${childId}/schema.ts`;
  const contractPath = `${CHILDREN_ROOT}/${childId}/contract.ts`;
  const implementationPath = `${CHILDREN_ROOT}/${childId}/implementation.ts`;
  const schemaFile = getSourceFileOrThrow(project, schemaPath);
  const contractFile = getSourceFileOrThrow(project, contractPath);
  const implementationFile = getSourceFileOrThrow(project, implementationPath);
  const definition = findChildDefinition(implementationFile, childId);

  return [
    ...collectChildShapeFindings({ childId, schemaPath, contractPath, implementationPath, schemaFile, contractFile, implementationFile }),
    ...collectChildPrivacyFindings({ childId, implementationPath, definition }),
    ...collectChildExecutionFindings({ childId, implementationPath, implementationFile }),
  ];
};

export function runCommanderChildChecks(project: import("ts-morph").Project): Finding[] {
  return CHILD_IDS.flatMap((childId) => collectSingleChildFindings(project, childId));
}