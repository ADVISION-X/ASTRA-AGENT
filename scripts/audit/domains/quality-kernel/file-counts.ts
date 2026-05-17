import { readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { QUALITY_KERNEL_LIMITS } from "./config.js";

const repoRoot = process.cwd();

const countFilesRecursive = (dir: string): number => {
  if (!existsSync(dir)) return -1; // -1 means directory doesn't exist
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      count += countFilesRecursive(join(dir, entry.name));
    } else {
      count++;
    }
  }
  return count;
};

type FileCountFinding = {
  module: string;
  actual: number;
  limit: number;
  status: "ok" | "warn" | "fail" | "retired-exists" | "required-exists";
};

export const checkFileCounts = (): FileCountFinding[] => {
  const findings: FileCountFinding[] = [];

  // Check module file limits
  for (const [moduleRelPath, limit] of Object.entries(QUALITY_KERNEL_LIMITS.moduleFileLimits)) {
    const dir = join(repoRoot, moduleRelPath);
    const actual = countFilesRecursive(dir);
    if (actual === -1) {
      // Module doesn't exist — ok for optional ones
      findings.push({ module: moduleRelPath, actual: 0, limit, status: "ok" });
    } else {
      findings.push({
        module: moduleRelPath,
        actual,
        limit,
        status: actual <= limit ? "ok" : "fail",
      });
    }
  }

  // Check retired roots must NOT exist
  for (const retiredPath of QUALITY_KERNEL_LIMITS.retiredCapabilityRoots) {
    const dir = join(repoRoot, retiredPath);
    if (existsSync(dir)) {
      findings.push({ module: retiredPath, actual: 1, limit: 0, status: "retired-exists" });
    }
  }

  // Check audit directory totals
  const auditTotal = countFilesRecursive(join(repoRoot, "scripts/audit"));
  findings.push({
    module: "scripts/audit (total)",
    actual: auditTotal,
    limit: QUALITY_KERNEL_LIMITS.maxAuditFiles,
    status: auditTotal <= QUALITY_KERNEL_LIMITS.maxAuditFiles ? "ok" : "fail",
  });

  const qkFiles = countFilesRecursive(join(repoRoot, "scripts/audit/domains/quality-kernel"));
  findings.push({
    module: "scripts/audit/domains/quality-kernel",
    actual: qkFiles,
    limit: QUALITY_KERNEL_LIMITS.maxQualityKernelFiles,
    status: qkFiles <= QUALITY_KERNEL_LIMITS.maxQualityKernelFiles ? "ok" : "warn",
  });

  const generatedFiles = countFilesRecursive(join(repoRoot, "scripts/audit/generated"));
  findings.push({
    module: "scripts/audit/generated",
    actual: generatedFiles,
    limit: QUALITY_KERNEL_LIMITS.maxGeneratedFiles,
    status: generatedFiles <= QUALITY_KERNEL_LIMITS.maxGeneratedFiles ? "ok"
      : generatedFiles <= 5 ? "warn"
      : "fail",
  });

  return findings;
};
