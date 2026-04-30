import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

import { pathFromRepoRoot } from "../../../core/paths.js";
import { createFinding, createPhase } from "../../../core/result.js";
import type { AuditConflict, Finding, InspectorPhase, InspectorResult } from "../../../core/schema.js";

interface AuditSystemSnapshot {
  auditConflicts: AuditConflict[];
  result: InspectorResult;
}

const RUNNER = "scripts/audit/domains/audit-system/run-inspector.ts";
const TARGET_FILE = "scripts/audit/domains/code-purity/components/inspect-source-file.ts";
const MANIFEST_PATH = "scripts/audit/domains/audit-system/manifest.json";
const AUDIT_PLAN_PATH = "scripts/audit/generated/audit-plan.generated.json";

const snapshotFindingKeys = (snapshot: AuditSystemSnapshot): Set<string> =>
  new Set(snapshot.result.findings.map((finding) => `${finding.lawId}|${finding.file}|${finding.message}`));

const snapshotConflictKeys = (snapshot: AuditSystemSnapshot): Set<string> =>
  new Set(snapshot.auditConflicts.map((conflict) => `${conflict.kind}|${conflict.capabilityDomain ?? ""}|${conflict.lawId ?? ""}|${conflict.message}`));

const runAuditSystem = (skipBuild = false): AuditSystemSnapshot => {
  const result = spawnSync("npx", ["tsx", RUNNER, ...(skipBuild ? ["--skip-build"] : [])], {
    cwd: pathFromRepoRoot("."),
    encoding: "utf8",
    env: { ...process.env, GRASSEYE_SKIP_CODE_PURITY_NEGATIVE_PROOF: "1" },
  });
  if (!result.stdout) {
    throw new Error(result.stderr || "Audit-system negative proof runner produced no output.");
  }
  return JSON.parse(result.stdout) as AuditSystemSnapshot;
};

const withTextMutation = async <T>(file: string, mutate: (value: string) => string, run: () => Promise<T>): Promise<T> => {
  const filePath = pathFromRepoRoot(file);
  const original = await readFile(filePath, "utf8");
  await writeFile(filePath, mutate(original), "utf8");
  try {
    return await run();
  } finally {
    await writeFile(filePath, original, "utf8");
  }
};

const ensureDelta = (baseline: Set<string>, after: Set<string>, label: string): void => {
  const delta = [...after].filter((entry) => !baseline.has(entry));
  if (delta.length === 0) {
    throw new Error(`Negative proof did not create a new failure for ${label}.`);
  }
};

export const runCodePurityNegativeProof = async (): Promise<{ findings: Finding[]; phase: InspectorPhase }> => {
  const findings: Finding[] = [];
  const checks: Array<{ name: string; run: () => Promise<void> }> = [
    {
      name: "required deletion fail",
      run: async () => {
        const baseline = snapshotFindingKeys(runAuditSystem());
        const mutated = await withTextMutation(TARGET_FILE, (value) => value.replace("export const inspectSourceFile =", 'const deletedRequiredShape = "required-shape-deleted";\n\nexport const inspectSourceFile ='), async () => snapshotFindingKeys(runAuditSystem()));
        ensureDelta(baseline, mutated, "required deletion fail");
      },
    },
    {
      name: "forbidden import fail",
      run: async () => {
        const baseline = snapshotFindingKeys(runAuditSystem());
        const mutated = await withTextMutation(TARGET_FILE, (value) => value.replace('import path from "node:path";\n', 'import path from "node:path";\nimport "./fixture-negative-proof.js";\n'), async () => snapshotFindingKeys(runAuditSystem()));
        ensureDelta(baseline, mutated, "forbidden import fail");
      },
    },
    {
      name: "old owner fail",
      run: async () => {
        const baseline = snapshotFindingKeys(runAuditSystem());
        const mutated = await withTextMutation(TARGET_FILE, (value) => value.replace("export const inspectSourceFile =", 'const retiredOwnerPath = "src/features/local-data/deleted-owner.ts";\nvoid retiredOwnerPath;\n\nexport const inspectSourceFile ='), async () => snapshotFindingKeys(runAuditSystem()));
        ensureDelta(baseline, mutated, "old owner fail");
      },
    },
    {
      name: "mock fake fallback fail",
      run: async () => {
        const baseline = snapshotFindingKeys(runAuditSystem());
        const mutated = await withTextMutation(TARGET_FILE, (value) => value.replace("export const inspectSourceFile =", 'const fakeSuccess = "fake success";\nvoid fakeSuccess;\n\nexport const inspectSourceFile ='), async () => snapshotFindingKeys(runAuditSystem()));
        ensureDelta(baseline, mutated, "mock fake fallback fail");
      },
    },
    {
      name: "any ts-ignore fail",
      run: async () => {
        const baseline = snapshotFindingKeys(runAuditSystem());
        const mutated = await withTextMutation(TARGET_FILE, (value) => value.replace("const inspectCleanup =", "// @ts-ignore\nconst inspectCleanup ="), async () => snapshotFindingKeys(runAuditSystem()));
        ensureDelta(baseline, mutated, "any ts-ignore fail");
      },
    },
    {
      name: "manifest removal fail",
      run: async () => {
        const baseline = snapshotConflictKeys(runAuditSystem());
        const mutated = await withTextMutation(MANIFEST_PATH, (value) => value.replace('    "GRASSEYE-CODE-PURITY-011-V1",\n', ""), async () => snapshotConflictKeys(runAuditSystem()));
        ensureDelta(baseline, mutated, "manifest removal fail");
      },
    },
    {
      name: "plan removal fail",
      run: async () => {
        const baseline = snapshotFindingKeys(runAuditSystem());
        const mutated = await withTextMutation(AUDIT_PLAN_PATH, (value) => {
          const parsed = JSON.parse(value) as { owners: Array<{ capabilityDomain: string }> };
          parsed.owners = parsed.owners.filter((owner) => owner.capabilityDomain !== "audit-system");
          return `${JSON.stringify(parsed, null, 2)}\n`;
        }, async () => snapshotFindingKeys(runAuditSystem(true)));
        ensureDelta(baseline, mutated, "plan removal fail");
      },
    },
  ];

  for (const check of checks) {
    try {
      await check.run();
    } catch (error) {
      findings.push(createFinding({ lawId: "GRASSEYE-CODE-PURITY-011-V1", file: RUNNER, line: 1, severity: "fatal", message: error instanceof Error ? error.message : `Negative proof failed for ${check.name}.` }));
    }
  }

  return {
    findings,
    phase: createPhase(
      "negative-proof-harness",
      findings.length === 0 ? "PASS" : "FAKE ENFORCEMENT",
      findings.length === 0,
      findings.length === 0
        ? "Negative proof added, removed, and rolled back required, forbidden, old-owner, fake-success, manifest, and plan mutations."
        : "Negative proof failed to demonstrate mutation rejection and rollback recovery.",
    ),
  };
};