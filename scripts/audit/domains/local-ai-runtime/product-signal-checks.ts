import { createFinding } from "../../core/result.js";
import type { Finding } from "../../core/schema.js";
import { readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";

import {
  PRODUCT_SIGNAL_ALLOWED_PATHS,
  localAiRuntimeInspectionConstants as config,
} from "./inspection-constants.js";

export type ProductSignalCheckResult = {
  findings: Finding[];
  productSignalViolations: string[];
  phase3PolicyPassed: boolean;
};

const findProductSignalViolations = async (sourceFiles: string[]): Promise<string[]> => {
  const violations: string[] = [];

  for (const file of sourceFiles) {
    if (PRODUCT_SIGNAL_ALLOWED_PATHS.has(file)) {
      continue;
    }

    const source = await readTextFile(pathFromRepoRoot(file));
    if (source.includes("product.signal_summary")) {
      violations.push(file);
    }
  }

  return violations;
};

export const collectProductSignalFindings = async (input: {
  sourceFiles: string[];
  runtimeExecutionSource: string;
}): Promise<ProductSignalCheckResult> => {
  const findings: Finding[] = [];
  const productSignalViolations = await findProductSignalViolations(input.sourceFiles.filter((file) => file.startsWith("src/")));
  const phase3PolicyPassed = [
    input.runtimeExecutionSource.includes("product.signal_summary is not allowed in phase-04 runtime flow"),
    input.runtimeExecutionSource.includes("disabled_by_policy"),
  ].every(Boolean);

  if (productSignalViolations.length > 0) {
    findings.push(createFinding({
      lawId: "GRASSEYE-LOCAL-AI-RUNTIME-003-V1",
      file: productSignalViolations[0] ?? config.RUNTIME_EXECUTION_PATH,
      line: 1,
      severity: "error",
      message: `Phase-03 runtime must not consume product.signal_summary outside governed Local AI contracts. Found references in: ${productSignalViolations.join(", ")}`,
    }));
  }
  if (!phase3PolicyPassed) {
    findings.push(createFinding({
      lawId: "GRASSEYE-LOCAL-AI-RUNTIME-003-V1",
      file: config.RUNTIME_EXECUTION_PATH,
      line: 1,
      severity: "error",
      message: "Phase-03 agent runtime must keep product.signal_summary blocked from the governed runtime execution path.",
    }));
  }

  return { findings, productSignalViolations, phase3PolicyPassed };
};