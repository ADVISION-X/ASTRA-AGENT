import { rm, writeFile } from "node:fs/promises";

import { Project } from "ts-morph";

import { pathFromRepoRoot } from "../../../core/paths.js";
import { createFinding, createPhase } from "../../../core/result.js";
import type { Finding, InspectorPhase } from "../../../core/schema.js";
import { createEmptyPurityReport, inspectPurityMetrics } from "./purity-metric-inspection.js";

const SANDBOX_FILE = "scripts/audit/domains/code-purity/negative-proof-sandbox.ts";

const MANY_LINES_SOURCE = Array.from({ length: 360 }, (_, index) => `export const line${index} = ${index};`).join("\n");
const FAKE_SUCCESS_MARKER = ["fake", "success"].join(" ");

const sandboxSource = (body: string): string => `${body}\n`;

const inspectSandbox = async (source: string): Promise<Finding[]> => {
  const filePath = pathFromRepoRoot(SANDBOX_FILE);
  await writeFile(filePath, source, "utf8");
  try {
    const project = new Project({
      tsConfigFilePath: pathFromRepoRoot("tsconfig.json"),
      skipAddingFilesFromTsConfig: true,
    });
    const sourceFile = project.addSourceFileAtPath(filePath);
    return inspectPurityMetrics(sourceFile, SANDBOX_FILE, new Set([SANDBOX_FILE]), createEmptyPurityReport());
  } finally {
    await rm(filePath, { force: true });
  }
};

const ensureFinding = (findings: Finding[], lawId: string, label: string): void => {
  if (!findings.some((finding) => finding.lawId === lawId)) {
    throw new Error(`Negative proof did not create a ${lawId} failure for ${label}.`);
  }
};

const runSandboxCheck = async (input: {
  label: string;
  lawId: string;
  source: string;
}): Promise<void> => {
  const findings = await inspectSandbox(sandboxSource(input.source));
  ensureFinding(findings, input.lawId, input.label);
  const rollbackFindings = await inspectSandbox("export const rollbackProbe = true;");
  if (rollbackFindings.length !== 0) {
    throw new Error(`Negative proof rollback did not return to PASS for ${input.label}.`);
  }
};

const createNegativeProofChecks = (): Array<{ label: string; lawId: string; source: string }> => [
  { label: "oversized touched file", lawId: "GRASSEYE-CODE-PURITY-001-V1", source: MANY_LINES_SOURCE },
  {
    label: "god function",
    lawId: "GRASSEYE-CODE-PURITY-003-V1",
    source: `export function godFunction(value: number) {\n${Array.from({ length: 41 }, (_, index) => `  if (value === ${index}) return ${index};`).join("\n")}\n  return value;\n}`,
  },
  {
    label: "god class",
    lawId: "GRASSEYE-CODE-PURITY-004-V1",
    source: `export class GodClass {\n${Array.from({ length: 25 }, (_, index) => `  method${index}() { return ${index}; }`).join("\n")}\n}`,
  },
  { label: "export star", lawId: "GRASSEYE-CODE-PURITY-006-V1", source: `export * from "./inspect-source-file.js";` },
  { label: "fake-success marker", lawId: "GRASSEYE-CODE-PURITY-008-V1", source: `export const marker = "${FAKE_SUCCESS_MARKER}";` },
  { label: "type escape", lawId: "GRASSEYE-CODE-PURITY-012-V1", source: `const escaped = 1 as any;\nexport { escaped };` },
];

const collectNegativeProofFindings = async (): Promise<Finding[]> => {
  const findings: Finding[] = [];
  const checks = createNegativeProofChecks();
  for (const check of checks) {
    try {
      await runSandboxCheck(check);
    } catch (error) {
      findings.push(
        createFinding({
          lawId: "GRASSEYE-CODE-PURITY-011-V1",
          file: SANDBOX_FILE,
          line: 1,
          severity: "fatal",
          message: error instanceof Error ? error.message : `Negative proof failed for ${check.label}.`,
        }),
      );
    }
  }
  return findings;
};

const createNegativeProofPhase = (findings: Finding[]): InspectorPhase =>
  createPhase(
    "negative-proof-harness",
    findings.length === 0 ? "PASS" : "FAKE ENFORCEMENT",
    findings.length === 0,
    findings.length === 0
      ? "Negative proof mutates sandbox source, proves fail, deletes the sandbox, and proves rollback PASS."
      : "Negative proof failed to demonstrate sandbox mutation rejection and rollback recovery.",
  );

export const runCodePurityNegativeProof = async (): Promise<{ findings: Finding[]; phase: InspectorPhase }> => {
  const findings = await collectNegativeProofFindings();
  return {
    findings,
    phase: createNegativeProofPhase(findings),
  };
};
