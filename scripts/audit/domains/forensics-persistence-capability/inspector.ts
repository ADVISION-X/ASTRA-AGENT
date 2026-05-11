import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALLOWED_CHILDREN,
  FORBIDDEN_CHILDREN,
  FORBIDDEN_FIELDS,
  FORBIDDEN_IMPORTS,
  FORENSICS_AUDIT_DIR,
  FORENSICS_SRC_DIR,
  MAX_AUDIT_FILES,
  MAX_SRC_FILES,
} from "./config.js";

type CheckResult = { id: number; label: string; pass: boolean; detail: string };

function countFiles(dir: string): number {
  if (!existsSync(dir)) return 0;
  try {
    const out = execSync(
      `find "${dir}" -type f \\( -name "*.ts" -o -name "*.js" -o -name "*.json" \\)`,
      { encoding: "utf8" },
    );
    return out.trim().split("\n").filter(Boolean).length;
  } catch {
    return 0;
  }
}

function readSourceFiles(dir: string): { path: string; content: string }[] {
  if (!existsSync(dir)) return [];
  try {
    const out = execSync(`find "${dir}" -type f -name "*.ts"`, { encoding: "utf8" });
    return out
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((path) => ({ path, content: readFileSync(path, "utf8") }));
  } catch {
    return [];
  }
}

function check1_FileCount(): CheckResult {
  const count = countFiles(FORENSICS_SRC_DIR);
  return {
    id: 1,
    label: `src/capabilities/forensics-persistence file count <= ${MAX_SRC_FILES}`,
    pass: count <= MAX_SRC_FILES,
    detail: `Found ${count} files (max ${MAX_SRC_FILES})`,
  };
}

function check2_AllowedChildren(): CheckResult {
  const files = readSourceFiles(FORENSICS_SRC_DIR);
  const combined = files.map((f) => f.content).join("\n");
  const missingChildren = ALLOWED_CHILDREN.filter(
    (child) => !combined.includes(`"${child}"`),
  );
  return {
    id: 2,
    label: "Active children include append-record / append-artifact / read-record-ref",
    pass: missingChildren.length === 0,
    detail:
      missingChildren.length === 0
        ? "All required children present"
        : `Missing: ${missingChildren.join(", ")}`,
  };
}

function check3_ForbiddenChildren(): CheckResult {
  const files = readSourceFiles(FORENSICS_SRC_DIR);
  const combined = files.map((f) => f.content).join("\n");
  const found = FORBIDDEN_CHILDREN.filter((child) => combined.includes(`"${child}"`));
  return {
    id: 3,
    label: "No forbidden business children (finalize-*, write-*-record, update-runtime-snapshot)",
    pass: found.length === 0,
    detail: found.length === 0 ? "No forbidden children found" : `Found: ${found.join(", ")}`,
  };
}

function check4_ForbiddenFields(): CheckResult {
  const files = readSourceFiles(FORENSICS_SRC_DIR);
  const combined = files.map((f) => f.content).join("\n");
  const found = FORBIDDEN_FIELDS.filter((field) => combined.includes(field));
  return {
    id: 4,
    label: "No map/binding/template/route/branch-token fields",
    pass: found.length === 0,
    detail: found.length === 0 ? "No forbidden fields found" : `Found: ${found.join(", ")}`,
  };
}

function check5_GenericRecordEnvelope(): CheckResult {
  const files = readSourceFiles(FORENSICS_SRC_DIR);
  const schemaFile = files.find((f) => f.path.endsWith("/schema.ts"));
  if (!schemaFile) {
    return {
      id: 5,
      label: "append-record uses generic recordPayload",
      pass: false,
      detail: "schema.ts not found",
    };
  }
  const usesGenericPayload =
    schemaFile.content.includes("recordPayload") &&
    schemaFile.content.includes("z.record(z.string(), z.unknown())");
  return {
    id: 5,
    label: "append-record uses generic recordPayload (no per-business-type payload schemas in forensics)",
    pass: usesGenericPayload,
    detail: usesGenericPayload
      ? "Generic recordPayload confirmed"
      : "Missing generic recordPayload or too many payload schemas",
  };
}

function check6_NoForbiddenImports(): CheckResult {
  const files = readSourceFiles(FORENSICS_SRC_DIR);
  const violations: string[] = [];
  for (const { path, content } of files) {
    for (const pattern of FORBIDDEN_IMPORTS) {
      if (content.includes(pattern)) {
        violations.push(`${path}: imports "${pattern}"`);
      }
    }
  }
  return {
    id: 6,
    label: "Forensics does not import AI/browser/action/orchestration runtime",
    pass: violations.length === 0,
    detail:
      violations.length === 0 ? "No forbidden imports" : violations.slice(0, 3).join("; "),
  };
}

function check7_ProofDurabilityOnly(): CheckResult {
  const files = readSourceFiles(FORENSICS_SRC_DIR);
  const schemaFile = files.find((f) => f.path.endsWith("/schema.ts"));
  if (!schemaFile) {
    return {
      id: 7,
      label: "Proof proves durability truth only",
      pass: false,
      detail: "schema.ts not found",
    };
  }
  const hasDurabilityFields =
    schemaFile.content.includes("storageRef") &&
    schemaFile.content.includes("integrityHash") &&
    schemaFile.content.includes('"success"') &&
    schemaFile.content.includes('"failed"');
  const hasForbiddenBusinessProof =
    schemaFile.content.includes("productLeadTruth") ||
    schemaFile.content.includes("businessTruth") ||
    schemaFile.content.includes("actionSuccess") ||
    schemaFile.content.includes("missionBranch");
  const pass = hasDurabilityFields && !hasForbiddenBusinessProof;
  return {
    id: 7,
    label: "Proof proves durability truth only (no business truth in proof)",
    pass,
    detail: pass
      ? "Proof correctly limited to durability truth"
      : "Proof schema issue: missing durability fields or contains business truth",
  };
}

function check8_MinimalStoragePort(): CheckResult {
  const portFile = join(FORENSICS_SRC_DIR, "storage-port.ts");
  if (!existsSync(portFile)) {
    return {
      id: 8,
      label: "Storage port is minimal (no ledger/snapshot/dashboard split)",
      pass: false,
      detail: "storage-port.ts not found",
    };
  }
  const content = readFileSync(portFile, "utf8");
  const hasLedger =
    content.includes("ledger") || content.includes("snapshot") || content.includes("dashboard");
  const hasRequired =
    content.includes("appendRecord") &&
    content.includes("appendArtifact") &&
    content.includes("readRecord");
  const pass = hasRequired && !hasLedger;
  return {
    id: 8,
    label: "Storage port is minimal — appendRecord / appendArtifact / readRecord only",
    pass,
    detail: pass
      ? "Minimal storage port confirmed"
      : hasLedger
        ? "Storage port contains ledger/snapshot/dashboard — not allowed"
        : "Storage port missing required methods",
  };
}

export function runForensicsInspector(): void {
  const checks: CheckResult[] = [
    check1_FileCount(),
    check2_AllowedChildren(),
    check3_ForbiddenChildren(),
    check4_ForbiddenFields(),
    check5_GenericRecordEnvelope(),
    check6_NoForbiddenImports(),
    check7_ProofDurabilityOnly(),
    check8_MinimalStoragePort(),
  ];

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;
  const auditFileCount = countFiles(FORENSICS_AUDIT_DIR);

  console.log("\n=== Forensics Persistence Capability Inspector ===\n");
  for (const check of checks) {
    const icon = check.pass ? "PASS" : "FAIL";
    console.log(`[${icon}] Check ${check.id}: ${check.label}`);
    console.log(`       ${check.detail}`);
  }

  console.log(`\n--- Summary ---`);
  console.log(`Checks: ${passed} PASS / ${failed} FAIL`);
  console.log(`src/capabilities/forensics-persistence file count: ${countFiles(FORENSICS_SRC_DIR)}`);
  console.log(`scripts/audit/domains/forensics-persistence-capability file count: ${auditFileCount}`);
  console.log(
    `Audit file count <= ${MAX_AUDIT_FILES}: ${auditFileCount <= MAX_AUDIT_FILES ? "PASS" : "FAIL"}`,
  );

  if (failed > 0) {
    console.log("\nResult: FAIL — forensics-persistence capability has governance violations.");
    process.exit(1);
  } else {
    console.log("\nResult: PASS — forensics-persistence capability is compliant.");
  }
}

// DomainInspector-compatible export for registry integration
import { createPendingDomainInspector } from "../_shared/create-pending-domain-inspector.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding } from "../../core/result.js";

export const forensicsPersistenceCapabilityInspector = createPendingDomainInspector({
  inspector: "GrassEye Forensics Persistence Owner Inspector",
  inspectorId: "forensics-persistence-capability-owner",
  capabilityDomain: "forensics-persistence-capability",
  inspectorEntry: "scripts/audit/domains/forensics-persistence-capability/inspector.ts",
  ownedPaths: ["src/capabilities/forensics-persistence"],
  pendingSummary: "forensics-persistence capability is not established",
  implementedSummary: "forensics-persistence is a pure append-only evidence ledger with governed storage port",
  extraChecks: async (_context) => {
    const checks = [
      check1_FileCount(),
      check2_AllowedChildren(),
      check3_ForbiddenChildren(),
      check4_ForbiddenFields(),
      check5_GenericRecordEnvelope(),
      check6_NoForbiddenImports(),
      check7_ProofDurabilityOnly(),
      check8_MinimalStoragePort(),
    ];
    const findings = checks
      .filter((c) => !c.pass)
      .map((c) =>
        createFinding({
          lawId: "GRASSEYE-FORENSICS-PERSISTENCE-CAPABILITY-001-V1",
          file: pathFromRepoRoot("src/capabilities/forensics-persistence"),
          line: 1,
          severity: "error",
          message: `[Check ${c.id}] ${c.label}: ${c.detail}`,
        }),
      );
    return { findings, phases: [] };
  },
});
