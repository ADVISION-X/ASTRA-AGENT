import { Node, SyntaxKind } from "ts-morph";

import { prepareAuditArtifactsSnapshot } from "../../../build-audit-artifacts.js";
import { createFinding, createPhase } from "../../../core/result.js";
import { fileExists, readTextFile } from "../../../core/filesystem.js";
import { generatedArtifactPaths } from "../../../core/generated-artifact-paths.js";
import { getAuditProject, getNodeLine, getSourceFileOrThrow, toRelativeSourcePath } from "../../../core/ts-morph.js";
import { stringifyYaml } from "../../../core/yaml.js";
import type { Finding, InspectorContext, InspectorPhase } from "../../../core/schema.js";

const LAW_ID = "GRASSEYE-AUDIT-SYSTEM-001-V1";

const getMissingGeneratedArtifactFindings = async (): Promise<Finding[]> => {
  const findings: Finding[] = [];
  const requiredFiles = [
    generatedArtifactPaths.lawRegistry,
    generatedArtifactPaths.enforcementMatrixJson,
    generatedArtifactPaths.enforcementMatrixYaml,
    generatedArtifactPaths.auditPlan,
    generatedArtifactPaths.auditConflicts,
    generatedArtifactPaths.staticClauseCoverage,
    generatedArtifactPaths.touchedFiles,
  ];

  for (const requiredFile of requiredFiles) {
    if (await fileExists(requiredFile)) {
      continue;
    }

    findings.push(
      createFinding({
        lawId: LAW_ID,
        file: requiredFile,
        line: 1,
        severity: "fatal",
        message: "Required generated artifact is missing.",
      }),
    );
  }

  return findings;
};

const getGeneratedYamlFinding = async (): Promise<Finding | null> => {
  const yamlText = await readTextFile(generatedArtifactPaths.enforcementMatrixYaml);
  return !yamlText.includes("generatedAt:") || !yamlText.includes("owners:")
    ? createFinding({
        lawId: LAW_ID,
        file: generatedArtifactPaths.enforcementMatrixYaml,
        line: 1,
        severity: "error",
        message: "Generated YAML artifact is unreadable or incomplete.",
      })
    : null;
};

const getEmptyAuditPlanFinding = (context: InspectorContext): Finding | null =>
  context.auditPlan.owners.length === 0
    ? createFinding({
        lawId: LAW_ID,
        file: generatedArtifactPaths.auditPlan,
        line: 1,
        severity: "fatal",
        message: "Generated audit plan must not be empty.",
      })
    : null;

const normalizeGeneratedAt = <T extends { generatedAt?: string }>(value: T): T => {
  if (!("generatedAt" in value)) {
    return value;
  }

  return {
    ...value,
    generatedAt: "__GENERATED_AT__",
  };
};

const stringifyJsonArtifact = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const normalizeJsonArtifactText = (text: string): string => {
  const parsed = JSON.parse(text) as { generatedAt?: string };
  return stringifyJsonArtifact(normalizeGeneratedAt(parsed));
};

const normalizeYamlArtifactText = (text: string): string =>
  text.replace(/^generatedAt:\s.*$/m, "generatedAt: __GENERATED_AT__");

const buildExpectedArtifactContent = async (): Promise<Map<string, string>> => {
  const expected = await prepareAuditArtifactsSnapshot();

  return new Map<string, string>([
    [generatedArtifactPaths.lawRegistry, stringifyJsonArtifact(normalizeGeneratedAt(expected.lawRegistry))],
    [generatedArtifactPaths.enforcementMatrixJson, stringifyJsonArtifact(normalizeGeneratedAt(expected.enforcementMatrix))],
    [generatedArtifactPaths.enforcementMatrixYaml, normalizeYamlArtifactText(`${stringifyYaml(expected.enforcementMatrix)}\n`)],
    [generatedArtifactPaths.auditPlan, stringifyJsonArtifact(normalizeGeneratedAt(expected.auditPlan))],
    [generatedArtifactPaths.auditConflicts, stringifyJsonArtifact(normalizeGeneratedAt(expected.auditConflicts))],
  ]);
};

const getStaticClauseCoverageWriterFindings = (): Finding[] => {
  const project = getAuditProject();
  const sourceFile = getSourceFileOrThrow(project, "scripts/audit/core/artifact-writers.ts");
  const relativePath = toRelativeSourcePath(sourceFile);
  const importDeclaration = sourceFile.getImportDeclarations().find((declaration) => {
    return declaration.getModuleSpecifierValue() === "./static-clause-coverage-artifact.js";
  });
  const importedBuilder = importDeclaration?.getNamedImports().find((namedImport) => {
    return namedImport.getName() === "buildStaticClauseCoverageArtifact";
  });
  const builderCall = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
    const expression = callExpression.getExpression();
    return Node.isIdentifier(expression)
      && expression.getText() === "buildStaticClauseCoverageArtifact";
  });
  const staticWriteCall = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).find((callExpression) => {
    const expression = callExpression.getExpression();
    if (!Node.isIdentifier(expression) || expression.getText() !== "writeJsonFile") {
      return false;
    }
    const [firstArg] = callExpression.getArguments();
    return firstArg?.getText() === "generatedArtifactPaths.staticClauseCoverage";
  });
  const findings: Finding[] = [];

  if (!importedBuilder) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: relativePath,
      line: 1,
      severity: "fatal",
      message: "artifact-writers.ts must import buildStaticClauseCoverageArtifact from the canonical helper.",
    }));
  }
  if (!builderCall) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: relativePath,
      line: 1,
      severity: "fatal",
      message: "artifact-writers.ts must build static-clause-coverage during generated artifact writes.",
    }));
  }
  if (!staticWriteCall) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: relativePath,
      line: 1,
      severity: "fatal",
      message: "artifact-writers.ts must write static-clause-coverage to the canonical generated artifact path.",
    }));
  }

  if (staticWriteCall && builderCall && staticWriteCall.getStart() < builderCall.getStart()) {
    findings.push(createFinding({
      lawId: LAW_ID,
      file: relativePath,
      line: getNodeLine(staticWriteCall),
      severity: "error",
      message: "artifact-writers.ts must build static-clause-coverage before writing the generated artifact.",
    }));
  }

  return findings;
};

const getGeneratedArtifactFreshnessFindings = async (): Promise<Finding[]> => {
  const findings: Finding[] = [];
  const expectedArtifactContent = await buildExpectedArtifactContent();

  for (const [artifactPath, expectedContent] of expectedArtifactContent.entries()) {
    if (!(await fileExists(artifactPath))) {
      continue;
    }

    const actualContent = artifactPath.endsWith(".yaml")
      ? normalizeYamlArtifactText(await readTextFile(artifactPath))
      : normalizeJsonArtifactText(await readTextFile(artifactPath));

    if (actualContent === expectedContent) {
      continue;
    }

    findings.push(createFinding({
      lawId: LAW_ID,
      file: artifactPath,
      line: 1,
      severity: "fatal",
      message: "Generated artifact content drifted away from the rebuild output; generated files must not be hand-edited.",
    }));
  }

  return findings;
};

const createGeneratedArtifactsPhase = (findings: Finding[]): InspectorPhase =>
  createPhase(
    "generated-artifacts",
    findings.length === 0 ? "PASS" : "LAW-SCRIPT DRIFT",
    findings.length === 0,
    findings.length === 0
      ? "Generated registry, matrix, plan, and conflicts artifacts are present, readable, and rebuild-faithful."
      : "Generated artifacts are missing, malformed, or hand-edited.",
  );

export const validateGeneratedArtifacts = async (
  context: InspectorContext,
): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> => {
  const findings = await getMissingGeneratedArtifactFindings();
  const yamlFinding = await getGeneratedYamlFinding();
  const auditPlanFinding = getEmptyAuditPlanFinding(context);
  const freshnessFindings = await getGeneratedArtifactFreshnessFindings();
  const staticWriterFindings = getStaticClauseCoverageWriterFindings();

  if (yamlFinding) {
    findings.push(yamlFinding);
  }

  if (auditPlanFinding) {
    findings.push(auditPlanFinding);
  }

  findings.push(...freshnessFindings);
  findings.push(...staticWriterFindings);

  return { findings, phases: [createGeneratedArtifactsPhase(findings)] };
};