import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { getReferencePaths } from "../../core/ts-morph.js";
import { hasMethodNamed, hasPropertyNamed } from "../_shared/ast-literal-queries.js";
import { hasCallExpression } from "../_shared/ast-helpers.js";

import { openInspectionConstants } from "./inspection-constants.js";
import { openInspectionUtils } from "./inspection-utils.js";

const { CHILDREN, LAW_PACKAGE_SHAPE, LAW_PRIVATE_LEAK, OPEN_ROOT, REGISTRY_PATH } = openInspectionConstants;
const { getFunctionIdentifier, getOpenSourceOrThrow } = openInspectionUtils;

const CHILD_FACTORY_NAMES = [
  ["createOpenTikTokCapability", `${OPEN_ROOT}/children/open-tiktok/implementation.ts`],
  ["createOpenFacebookCapability", `${OPEN_ROOT}/children/open-facebook/implementation.ts`],
  ["createOpenLocalWorkbenchCapability", `${OPEN_ROOT}/children/open-local-workbench/implementation.ts`],
] as const;

const collectChildImplementationFindings = (project: import("ts-morph").Project, childId: string): Finding[] => {
  const implementationPath = `${OPEN_ROOT}/children/${childId}/implementation.ts`;
  const implementationSource = getOpenSourceOrThrow(project, implementationPath);
  return !hasPropertyNamed(implementationSource, "inputSchema") || !hasPropertyNamed(implementationSource, "outputSchema") || !hasMethodNamed(implementationSource, "execute") || !hasCallExpression(implementationSource, "executeOpenChild")
    ? [createFinding({ lawId: LAW_PACKAGE_SHAPE, file: implementationPath, line: 1, severity: "fatal", message: "Open child implementation must export inputSchema, outputSchema, and execute backed by executeOpenChild." })]
    : [];
};

const collectChildContractFindings = (project: import("ts-morph").Project, childId: string): Finding[] => {
  const contractPath = `${OPEN_ROOT}/children/${childId}/contract.ts`;
  const childContractSource = getOpenSourceOrThrow(project, contractPath);
  const expectedContractFragments = ["BOUNDARY_POLICY", "PROOF_POLICY", "OUTPUT_POLICY", "FAILURE_POLICY", "PURPOSE", "ALLOWED_HOSTNAMES", "ALLOWED_SCHEMES"];
  return expectedContractFragments.flatMap((fragment) => {
    return childContractSource.getVariableDeclarations().some((declaration) => declaration.getName().includes(fragment))
      ? []
      : [createFinding({ lawId: LAW_PACKAGE_SHAPE, file: contractPath, line: 1, severity: "fatal", message: `Open child contract must define child-local ${fragment.toLowerCase()}.` })];
  });
};

const collectChildSchemaFindings = (project: import("ts-morph").Project, childId: string): Finding[] => {
  const schemaPath = `${OPEN_ROOT}/children/${childId}/schema.ts`;
  const childSchemaSource = getOpenSourceOrThrow(project, schemaPath);
  const expectedSchemaFragments = ["BoundaryPolicySchema", "ProofPolicySchema", "OutputPolicySchema", "FailurePolicySchema", "TargetProfileSchema"];
  return expectedSchemaFragments.flatMap((fragment) => {
    return childSchemaSource.getVariableDeclarations().some((declaration) => declaration.getName().includes(fragment))
      ? []
      : [createFinding({ lawId: LAW_PACKAGE_SHAPE, file: schemaPath, line: 1, severity: "fatal", message: `Open child schema must define child-local ${fragment}.` })];
  });
};

const collectChildFactoryLeakFindings = (project: import("ts-morph").Project): Finding[] => {
  return CHILD_FACTORY_NAMES.flatMap(([factoryName, implementationPath]) => {
    const implementationSource = getOpenSourceOrThrow(project, implementationPath);
    const identifier = getFunctionIdentifier(implementationSource, factoryName);
    if (!identifier) {
      return [createFinding({ lawId: LAW_PACKAGE_SHAPE, file: implementationPath, line: 1, severity: "fatal", message: `Open child implementation must export ${factoryName}.` })];
    }

    const referencePaths = getReferencePaths(identifier);
    const escapedReference = referencePaths.find((path) => path !== implementationPath && path !== REGISTRY_PATH);
    return escapedReference
      ? [createFinding({ lawId: LAW_PRIVATE_LEAK, file: escapedReference, line: 1, severity: "fatal", message: "Open child implementation factory leaked outside registry-owned wiring.", detail: `${factoryName} -> ${referencePaths.join(", ")}` })]
      : [];
  });
};

export function runOpenChildShapeChecks(project: import("ts-morph").Project): Finding[] {
  return [
    ...CHILDREN.flatMap((childId) => collectChildImplementationFindings(project, childId)),
    ...CHILDREN.flatMap((childId) => collectChildContractFindings(project, childId)),
    ...CHILDREN.flatMap((childId) => collectChildSchemaFindings(project, childId)),
    ...collectChildFactoryLeakFindings(project),
  ];
}