import { SyntaxKind, type Project } from "ts-morph";

import { createFinding } from "../../core/result.js";
import { fileExists } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import type { Finding } from "../../core/schema.js";

import { aiInspectionConstants } from "./inspection-constants.js";
import { aiInspectionUtils } from "./inspection-utils.js";

const { AI_ROOT, CHILD_IDS, FORBIDDEN_FILES, REQUIRED_FILES, ROUTED_CHILD_IDS } = aiInspectionConstants;
const {
  getArrayStringLiterals,
  getObjectPropertyStringArray,
  getReturnArrayLiterals,
  getSourceOrThrow,
  hasChildContractShape,
  hasChildLocalSchemaShape,
  toChildNamePrefix,
} = aiInspectionUtils;

const findMissingRequiredFiles = async (): Promise<Finding[]> => {
  const findings: Finding[] = [];
  for (const requiredFile of REQUIRED_FILES) {
    if (await fileExists(pathFromRepoRoot(requiredFile))) {
      continue;
    }
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-004-V1", file: requiredFile, line: 1, severity: "fatal", message: "Required AI canonical file is missing." }));
  }
  return findings;
};

const findForbiddenFileResidue = async (): Promise<Finding[]> => {
  const findings: Finding[] = [];
  for (const forbiddenFile of FORBIDDEN_FILES) {
    if (!(await fileExists(pathFromRepoRoot(forbiddenFile)))) {
      continue;
    }
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-004-V1", file: forbiddenFile, line: 1, severity: "fatal", message: "Forbidden retired AI residue must remain deleted." }));
  }
  return findings;
};

const findChildPackageViolations = async (project: Project): Promise<Finding[]> => {
  const findings: Finding[] = [];
  for (const childId of CHILD_IDS) {
    findings.push(...await findMissingChildFiles(childId));
    findings.push(...findChildLocalShapeViolations(project, childId));
  }
  return findings;
};

const findMissingChildFiles = async (childId: string): Promise<Finding[]> => {
  const findings: Finding[] = [];
  for (const suffix of ["contract.ts", "schema.ts", "implementation.ts"] as const) {
    const filePath = `${AI_ROOT}/children/${childId}/${suffix}`;
    if (await fileExists(pathFromRepoRoot(filePath))) {
      continue;
    }
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-004-V1", file: filePath, line: 1, severity: "fatal", message: "AI child package is incomplete; contract/schema/implementation are all required." }));
  }
  return findings;
};

const findChildLocalShapeViolations = (project: Project, childId: string): Finding[] => {
  const childNamePrefix = toChildNamePrefix(childId);
  const schemaPath = `${AI_ROOT}/children/${childId}/schema.ts`;
  const contractPath = `${AI_ROOT}/children/${childId}/contract.ts`;
  const childSchemaSource = getSourceOrThrow(project, schemaPath);
  const childContractSource = getSourceOrThrow(project, contractPath);
  const findings: Finding[] = [];

  if (!hasChildLocalSchemaShape(childSchemaSource, childNamePrefix)) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-004-V1", file: schemaPath, line: 1, severity: "fatal", message: "AI child schema must be child-local and must not be a parent-schema re-export shell." }));
  }
  if (!hasChildContractShape(childContractSource, childNamePrefix)) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-004-V1", file: contractPath, line: 1, severity: "fatal", message: "AI child contract must define child id, execution policy, and concrete contract locally." }));
  }

  return findings;
};

const findRegistryAlignmentViolations = (project: Project): Finding[] => {
  const typesSource = getSourceOrThrow(project, `${AI_ROOT}/shared/ai-types.ts`);
  const registrySource = getSourceOrThrow(project, `${AI_ROOT}/registry.ts`);
  const routerSource = getSourceOrThrow(project, `${AI_ROOT}/task-router.ts`);
  const modelRosterSource = getSourceOrThrow(project, `${AI_ROOT}/model-roster.ts`);
  const normalizedExpected = [...CHILD_IDS].sort().join(",");
  const findings: Finding[] = [];

  const schemaChildIds = getArrayStringLiterals(typesSource, "AI_CHILD_CAPABILITY_IDS");
  const registryChildIds = getReturnArrayLiterals(registrySource, "listAiChildren");
  const routedChildIds = getObjectPropertyStringArray(routerSource, "AI_TASK_ROUTING");
  const rosterChildIds = modelRosterSource.getDescendantsOfKind(SyntaxKind.StringLiteral).map((literal) => literal.getLiteralText()).filter((value) => CHILD_IDS.includes(value as (typeof CHILD_IDS)[number]));

  if (schemaChildIds.sort().join(",") !== normalizedExpected) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-004-V1", file: `${AI_ROOT}/schema.ts`, line: 1, severity: "fatal", message: "AiChildCapabilityIdSchema must match the governed child package set." }));
  }
  if (registryChildIds.sort().join(",") !== normalizedExpected) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-004-V1", file: `${AI_ROOT}/registry.ts`, line: 1, severity: "fatal", message: "listAiChildren must match the governed child package set." }));
  }
  if ([...new Set(routedChildIds)].sort().join(",") !== [...ROUTED_CHILD_IDS].sort().join(",")) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-004-V1", file: `${AI_ROOT}/task-router.ts`, line: 1, severity: "fatal", message: "AI task router must only route to governed children, including reserved disabled-provider routes." }));
  }
  if ([...new Set(rosterChildIds)].sort().join(",") !== normalizedExpected) {
    findings.push(createFinding({ lawId: "GRASSEYE-AI-CAPABILITY-004-V1", file: `${AI_ROOT}/model-roster.ts`, line: 1, severity: "fatal", message: "AI model roster must enumerate the same governed child package set." }));
  }

  return findings;
};

export async function runAiStructureChecks(project: Project): Promise<Finding[]> {
  return [
    ...await findMissingRequiredFiles(),
    ...await findChildPackageViolations(project),
    ...await findForbiddenFileResidue(),
    ...findRegistryAlignmentViolations(project),
  ];
}