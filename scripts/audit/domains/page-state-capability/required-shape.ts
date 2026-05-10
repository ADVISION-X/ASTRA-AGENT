import { Node, SyntaxKind, type ObjectLiteralExpression, type Project, type SourceFile } from "ts-morph";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getZodEnumValues } from "../_shared/ast-schema-queries.js";
import { hasCallExpression, hasCallExpressionPath } from "../_shared/ast-helpers.js";
import { getSource } from "./audit-project.js";
import { isThinAbilityGroup } from "./ability-group-shape.js";
import { missingCanonicalFiles } from "./canonical-files.js";
import { CHILDREN, ROOT } from "./constants.js";
import { collectBuilderSpecificFindings } from "./required-shape-builder-findings.js";

const INPUT_CHAIN_FIELDS = [
  "abilityGroupId",
  "requestedBy",
  "stepId",
  "capabilityCallId",
  "nerveBusEnvelopeId",
  "inputRef",
  "idempotencyKey",
] as const;

const RUNTIME_PROOF_CHAIN_FIELDS = [
  "stepId",
  "capabilityCallId",
  "nerveBusEnvelopeId",
] as const;

const RESULT_CHAIN_FIELDS = [
  "stepId",
  "capabilityCallId",
  "nerveBusEnvelopeId",
] as const;

const EXECUTION_ROUTE_SOURCES = {
  createPageStateFailureResult: `${ROOT}/runtime/page-state-executor.ts`,
  createSuccessfulPageStateResult: `${ROOT}/runtime/page-state-executor.ts`,
  buildPageStateRuntimeProof: `${ROOT}/runtime/page-state-result-builders.ts`,
  buildPageStateObservationFingerprint: `${ROOT}/runtime/page-state-result-builders.ts`,
  buildPageStateDebugRefs: `${ROOT}/runtime/page-state-result-builders.ts`,
} as const;

function resolveZodObjectLiteral(node: Node | undefined): ObjectLiteralExpression | null {
  if (!node || !Node.isCallExpression(node)) {
    return null;
  }

  const expression = node.getExpression();
  if (Node.isPropertyAccessExpression(expression) && expression.getExpression().getText() === "z" && expression.getName() === "object") {
    const [argument] = node.getArguments();
    return Node.isObjectLiteralExpression(argument) ? argument : null;
  }

  return Node.isPropertyAccessExpression(expression) ? resolveZodObjectLiteral(expression.getExpression()) : null;
}

function resolveZodDiscriminatedUnionObjectLiterals(node: Node | undefined): ObjectLiteralExpression[] {
  if (!node || !Node.isCallExpression(node)) {
    return [];
  }

  const expression = node.getExpression();
  if (Node.isPropertyAccessExpression(expression) && expression.getExpression().getText() === "z" && expression.getName() === "discriminatedUnion") {
    const [, variants] = node.getArguments();
    if (!Node.isArrayLiteralExpression(variants)) {
      return [];
    }

    return variants.getElements().flatMap((variant) => {
      const objectLiteral = resolveZodObjectLiteral(variant);
      return objectLiteral ? [objectLiteral] : [];
    });
  }

  return Node.isPropertyAccessExpression(expression)
    ? resolveZodDiscriminatedUnionObjectLiterals(expression.getExpression())
    : [];
}

function getSchemaFields(project: Project, schemaName: string): Set<string> {
  const schemaSource = getSource(project, `${ROOT}/schema.ts`);
  const initializer = schemaSource.getVariableDeclaration(schemaName)?.getInitializer();
  const objectLiteral = resolveZodObjectLiteral(initializer);
  if (!objectLiteral) {
    return new Set<string>();
  }

  return new Set(objectLiteral.getProperties().flatMap((property) => {
    if (Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property)) {
      return [property.getName()];
    }
    return [];
  }));
}

function getDiscriminatedUnionVariantFieldSets(project: Project, schemaName: string): Set<string>[] {
  const schemaSource = getSource(project, `${ROOT}/schema.ts`);
  const initializer = schemaSource.getVariableDeclaration(schemaName)?.getInitializer();
  return resolveZodDiscriminatedUnionObjectLiterals(initializer).map((objectLiteral) =>
    new Set(objectLiteral.getProperties().flatMap((property) => {
      if (Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property)) {
        return [property.getName()];
      }
      return [];
    })),
  );
}

function getMissingRequiredFields(fieldSet: Set<string>, requiredFields: readonly string[]): string[] {
  return requiredFields.filter((field) => !fieldSet.has(field));
}

function mapMissingFieldFindings(input: { file: string; lawId: string; scope: string; missingFields: readonly string[] }): Finding[] {
  return input.missingFields.map((field) => createFinding({ lawId: input.lawId, file: input.file, line: 1, severity: "fatal", message: `${input.scope} must include ${field}.` }));
}

function createMissingFieldFindings(input: { file: string; lawId: string; scope: string; fieldSet: Set<string>; requiredFields: readonly string[] }): Finding[] {
  return mapMissingFieldFindings({
    file: input.file,
    lawId: input.lawId,
    scope: input.scope,
    missingFields: getMissingRequiredFields(input.fieldSet, input.requiredFields),
  });
}

const inspectMissingCanonicalFiles = async (): Promise<Finding[]> => {
  const missingFiles = await missingCanonicalFiles();
  return missingFiles.map((file) =>
    createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-008-V2", file, line: 1, severity: "fatal", message: "Required page-state canonical file is missing." }),
  );
};

const inspectAbilityGroupShape = (project: Project): Finding[] => {
  const abilityGroupSource = getSource(project, `${ROOT}/ability-group.ts`);
  return isThinAbilityGroup(abilityGroupSource)
    ? []
    : [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-002-V2", file: `${ROOT}/ability-group.ts`, line: 1, severity: "fatal", message: "Page State ability-group must stay a thin entrypoint." })];
};

const inspectContractShape = (project: Project): Finding[] => {
  const contractSource = getSource(project, `${ROOT}/contract.ts`);
  return contractSource.getInterface("PageStateChildCapability")
    ? [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-001-V2", file: `${ROOT}/contract.ts`, line: 1, severity: "fatal", message: "Page State contract must not expose child execute interface." })]
    : [];
};

const inspectSchemaShape = (project: Project): Finding[] => {
  const findings: Finding[] = [];
  const schemaSource = getSource(project, `${ROOT}/schema.ts`);
  const childIds = getZodEnumValues(schemaSource, "PageStateChildCapabilityIdSchema");
  const snapshotFields = getSchemaFields(project, "PageStateSnapshotSchema");
  const observationVariantFieldSets = getDiscriminatedUnionVariantFieldSets(project, "PageStateObservationSchema");

  if (childIds.sort().join(",") !== [...CHILDREN].sort().join(",")) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-007-V2", file: `${ROOT}/schema.ts`, line: 1, severity: "fatal", message: "Page State schema child ids must match the frozen child registry." }));
  }

  if (!schemaSource.getVariableDeclaration("PageStateAbilityInputSchema") || !schemaSource.getVariableDeclaration("PageStateRuntimeProofSchema") || !schemaSource.getVariableDeclaration("PageStateAbilityResultSchema")) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-008-V2", file: `${ROOT}/schema.ts`, line: 1, severity: "fatal", message: "Page State schema must expose governed input/result/proof shapes." }));
  }

  if (!snapshotFields.has("sourceProofRef") || observationVariantFieldSets.length === 0 || observationVariantFieldSets.some((fieldSet) => !fieldSet.has("sourceProofRef"))) {
    findings.push(createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-004-V2", file: `${ROOT}/schema.ts`, line: 1, severity: "fatal", message: "Page State schema must retain sourceProofRef on snapshot and every governed observation shape." }));
  }

  findings.push(...createMissingFieldFindings({ file: `${ROOT}/schema.ts`, lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", scope: "PageStateAbilityInputSchema", fieldSet: getSchemaFields(project, "PageStateAbilityInputSchema"), requiredFields: INPUT_CHAIN_FIELDS }));
  findings.push(...createMissingFieldFindings({ file: `${ROOT}/schema.ts`, lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", scope: "PageStateSnapshotSchema", fieldSet: snapshotFields, requiredFields: ["currentUrl", "sourceProofRef"] }));
  findings.push(...createMissingFieldFindings({ file: `${ROOT}/schema.ts`, lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-003-V2", scope: "PageStateOpenHandoffPolicySchema", fieldSet: getSchemaFields(project, "PageStateOpenHandoffPolicySchema"), requiredFields: ["openProofRef", "browserSessionRef", "platformProfileId"] }));
  findings.push(...createMissingFieldFindings({ file: `${ROOT}/schema.ts`, lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-006-V2", scope: "PageStateRuntimeProofSchema", fieldSet: getSchemaFields(project, "PageStateRuntimeProofSchema"), requiredFields: RUNTIME_PROOF_CHAIN_FIELDS }));
  findings.push(...createMissingFieldFindings({ file: `${ROOT}/schema.ts`, lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-005-V2", scope: "PageStateAbilityResultSchema", fieldSet: getSchemaFields(project, "PageStateAbilityResultSchema"), requiredFields: RESULT_CHAIN_FIELDS }));

  return findings;
};

function inspectExecutorEntry(project: Project): Finding[] {
  const executorSource = getSource(project, `${ROOT}/runtime/page-state-executor.ts`);
  const executorRoutes = [
    { callee: "execute", message: "Page State executor must route through the child capability execute contract." },
    { callee: "createPageStateFailureResult", message: "Page State executor must route through createPageStateFailureResult." },
    { callee: "createSuccessfulPageStateResult", message: "Page State executor must route through createSuccessfulPageStateResult." },
  ] as const;

  return executorRoutes.flatMap((route) =>
    hasCallExpression(executorSource, route.callee)
      ? []
      : [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-007-V2", file: `${ROOT}/runtime/page-state-executor.ts`, line: 1, severity: "fatal", message: route.message })],
  );
}

const inspectExecutorShape = (project: Project): Finding[] => {
  const routeFindings = Object.entries(EXECUTION_ROUTE_SOURCES).flatMap(([callee, file]) => {
    const source = getSource(project, file);
    return hasCallExpression(source, callee)
      ? []
      : [createFinding({ lawId: "GRASSEYE-PAGE-STATE-CAPABILITY-007-V2", file, line: 1, severity: "fatal", message: `Page State execution chain must route through ${callee}.` })];
  });

  return [...inspectExecutorEntry(project), ...routeFindings];
};

const inspectBuilderShape = (project: Project): Finding[] => collectBuilderSpecificFindings(project);

export async function runRequiredShape(project: Project): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  const findings = [
    ...(await inspectMissingCanonicalFiles()),
    ...inspectAbilityGroupShape(project),
    ...inspectContractShape(project),
    ...inspectSchemaShape(project),
    ...inspectExecutorShape(project),
    ...inspectBuilderShape(project),
  ];

  const phasePassed = findings.length === 0;
  return {
    findings,
    phase: createPhase("page-state-required-shape", phasePassed ? "PASS" : "CODE VIOLATION", phasePassed, phasePassed ? "Page State V2 canonical package shape is present." : "Page State V2 canonical package shape is incomplete."),
  };
}
