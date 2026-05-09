import { spawnSync } from "node:child_process";

import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { withNestedNegativeProofEnv } from "../../core/nested-negative-proof.js";
import { applyAuditMutation, readAuditFileState, restoreAuditFileState } from "../_shared/read-audit-file-state.js";
import { writeStaticClauseCoverageProof } from "./write-static-clause-coverage-proof.js";

type Mutation = {
  name: string;
  file: string;
  mode?: "replace" | "write";
  search?: string;
  replace?: string;
  content?: string;
  expectedNeedle: string;
  skipBuild?: boolean;
};

type MutationProof = {
  name: string;
  file: string;
  expectedNeedle: string;
  originalContent: string;
  mutatedContent: string;
  failOutput: string;
};

type InspectorProcessResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

const LAW_ID = "GRASSEYE-AUDIT-SYSTEM-001-V1";
const INSPECTOR_ENTRY = "scripts/audit/domains/audit-system/inspector.ts";
const RUN_INSPECTOR_ENTRY = "scripts/audit/domains/audit-system/run-inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_AUDIT_SYSTEM_NEGATIVE_PROOF";
const SKIP_CODE_PURITY_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_CODE_PURITY_NEGATIVE_PROOF";
const SKIP_AUDIT_SYSTEM_CODE_PURITY_ENV = "GRASSEYE_SKIP_AUDIT_SYSTEM_CODE_PURITY";
const NEGATIVE_PROOF_PHASE_ENV = "GRASSEYE_AUDIT_NEGATIVE_PROOF_PHASE";

const MUTATIONS: Mutation[] = [
  {
    name: "negative-proof wiring validator removed mutation",
    file: "scripts/audit/domains/audit-system/components/run-audit-red-line-checks.ts",
    search: "  results.push(await validateNegativeProofWiring(context));",
    replace: "  results.push(await validateOwnedLawExecution(context));",
    expectedNeedle: "Audit-system inspector must execute validateNegativeProofWiring inside its governed owner chain.",
    skipBuild: true,
  },
  {
    name: "phase gate audit-system removal mutation",
    file: "scripts/audit/phase-gates/phase-05-final-delivery-debug.json",
    search: "\"audit-system\",",
    replace: "\"agent-runtime\",",
    expectedNeedle: "Current phase gate must keep audit-system active.",
    skipBuild: true,
  },
  {
    name: "generated artifact hand-edit mutation",
    file: "scripts/audit/generated/audit-plan.generated.json",
    search: "  \"phase\": \"phase-05-final-delivery-debug\",",
    replace: "  \"phase\": \"phase-04-hand-edited\",",
    expectedNeedle: "Generated artifact content drifted away from the rebuild output; generated files must not be hand-edited.",
    skipBuild: true,
  },
  {
    name: "static-clause-coverage phase removed mutation",
    file: "scripts/audit/domains/audit-system/components/run-audit-governance-checks.ts",
    search: "  results.push(await validateStaticClauseCoverage(context));",
    replace: "  results.push(await validateGeneratedArtifacts(context));",
    expectedNeedle: "Audit-system inspector must execute validateStaticClauseCoverage inside its governed owner chain.",
    skipBuild: true,
  },
  {
    name: "ci full parallel preflight disabled mutation",
    file: "scripts/audit/ci-full.ts",
    search: "    label: \"independent-preflight\",\n    parallel: true,",
    replace: "    label: \"independent-preflight\",\n    parallel: false,",
    expectedNeedle: "CI full must run independent preflight as a parallel stage.",
    skipBuild: true,
  },
  {
    name: "default audit negative proof policy removed mutation",
    file: "scripts/audit/runner.ts",
    search: "applyDefaultNegativeProofPolicy();",
    replace: "process.stdout.write(\"[AUDIT] negative proof policy removed by mutation.\\n\");",
    expectedNeedle: "Runner must keep production mutation negative proof out of the default law-compliance audit unless GRASSEYE_AUDIT_RUN_NEGATIVE_PROOF=1 is explicitly set.",
    skipBuild: true,
  },
  {
    name: "static-clause-coverage fake ENFORCED mutation",
    file: "scripts/audit/generated/static-clause-coverage.generated.json",
    search: '"coverageStatus": "OWNER_BINDING_PROOF_CAPTURED"',
    replace: '"coverageStatus": "ENFORCED"',
    expectedNeedle: "No law may be marked ENFORCED while the global chain is failing.",
    skipBuild: true,
  },
  {
    name: "ai mutation proof bundle emptied mutation",
    file: "tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-001-V1/proof-summary.md",
    mode: "write",
    content: "",
    expectedNeedle: "tmp/audit/ability-law-census/regression-proofs/ai/GRASSEYE-AI-CAPABILITY-001-V1/proof-summary.md",
  },
  {
    name: "ai owner binding proof bundle emptied mutation",
    file: "tmp/audit/ability-law-census/regression-proofs/ai/owner-binding/owner-binding-proof-summary.md",
    mode: "write",
    content: "",
    expectedNeedle: "tmp/audit/ability-law-census/regression-proofs/ai/owner-binding/owner-binding-proof-summary.md",
  },
  {
    name: "audit ai script removed mutation",
    file: "package.json",
    search: '    "audit:ai": "tsx scripts/audit/domains/ai-capability/run-inspector.ts",\n',
    replace: "",
    expectedNeedle: "package.json must keep the owner audit script bound for every governed ability group.",
  },
  {
    name: "generated enforcement matrix ai law removed mutation",
    file: "scripts/audit/generated/enforcement-matrix.generated.json",
    search: '        "GRASSEYE-AI-CAPABILITY-001-V1",\n',
    replace: "",
    expectedNeedle: "Generated artifact content drifted away from the rebuild output; generated files must not be hand-edited.",
    skipBuild: true,
  },
  {
    name: "static-clause-coverage writer removed mutation",
    file: "scripts/audit/core/artifact-writers.ts",
    search: "    writeJsonFile(generatedArtifactPaths.staticClauseCoverage, staticClauseCoverage),",
    replace: "    Promise.resolve(),",
    expectedNeedle: "artifact-writers.ts must write static-clause-coverage to the canonical generated artifact path.",
  },
  {
    name: "negative-proof invocation removed mutation",
    file: INSPECTOR_ENTRY,
    search: "      : runNegativeProofHarness(),",
    replace: "      : Promise.resolve({ findings: [], phase: { name: \"negative-proof-harness\", classification: \"PASS\" as const, passed: true, summary: \"negative-proof removed by mutation\" } }),",
    expectedNeedle: "Audit-system inspector must invoke and report the negative-proof harness.",
    skipBuild: true,
  },
];

function createMutationGroups(): Mutation[][] {
  return MUTATIONS.reduce<Mutation[][]>((groups, mutation) => {
    const lastGroup = groups.at(-1);
    if (!lastGroup || Boolean(lastGroup[0]?.skipBuild) !== Boolean(mutation.skipBuild)) {
      groups.push([mutation]);
      return groups;
    }

    lastGroup.push(mutation);
    return groups;
  }, []);
}

function runInspectorProcess(skipBuild = false): InspectorProcessResult {
  const result = spawnSync(
    "node",
    ["--import", "tsx", RUN_INSPECTOR_ENTRY, ...(skipBuild ? ["--skip-build"] : [])],
    {
      cwd: pathFromRepoRoot("."),
      encoding: "utf8",
      env: withNestedNegativeProofEnv({
        ...process.env,
        [SKIP_NEGATIVE_PROOF_ENV]: "1",
        [SKIP_CODE_PURITY_NEGATIVE_PROOF_ENV]: "1",
        [SKIP_AUDIT_SYSTEM_CODE_PURITY_ENV]: "1",
        [NEGATIVE_PROOF_PHASE_ENV]: "static-clause-coverage",
        TSX_DISABLE_CACHE: "1",
      }),
    },
  );

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

const formatInspectorOutput = (result: InspectorProcessResult): string => `${result.stdout}\n${result.stderr}`;

const getMutatedContent = (mutation: Mutation, original: string): string => {
  if (mutation.mode === "write") {
    return mutation.content ?? "";
  }
  if (!mutation.search || mutation.replace === undefined) {
    throw new Error(`Mutation ${mutation.name} is missing search/replace content.`);
  }

  return original.replace(mutation.search, mutation.replace);
};

async function mutateAndVerify(mutation: Mutation, baseline: InspectorProcessResult): Promise<MutationProof> {
  const filePath = pathFromRepoRoot(mutation.file);
  const state = await readAuditFileState(filePath);
  const mutatedContent = getMutatedContent(mutation, state.original);
  await applyAuditMutation(filePath, state.original, mutation);

  try {
    const failRun = runInspectorProcess(mutation.skipBuild);
    const combinedOutput = formatInspectorOutput(failRun);
    if (failRun.status === 0) {
      throw new Error(`Mutation ${mutation.name} did not fail inspector as expected.\n${combinedOutput}`);
    }
    if (!combinedOutput.includes(mutation.expectedNeedle)) {
      throw new Error(`Mutation ${mutation.name} failed, but not for the expected reason. Missing needle: ${mutation.expectedNeedle}`);
    }

    return {
      name: mutation.name,
      file: mutation.file,
      expectedNeedle: mutation.expectedNeedle,
      originalContent: state.original,
      mutatedContent,
      failOutput: combinedOutput,
    };
  } finally {
    await restoreAuditFileState(filePath, state);
  }
}

async function verifyRollback(mutation: Mutation, baseline: InspectorProcessResult): Promise<void> {
  const rollbackRun = runInspectorProcess(mutation.skipBuild);
  if (rollbackRun.status !== baseline.status || formatInspectorOutput(rollbackRun) !== formatInspectorOutput(baseline)) {
    throw new Error(`Mutation ${mutation.name} did not restore the baseline inspector result after rollback.\n${rollbackRun.stdout}\n${rollbackRun.stderr}`);
  }
}

function createPassResult(summary: string): { findings: Finding[]; phase: InspectorPhase } {
  return {
    findings: [],
    phase: createPhase("negative-proof-harness", "PASS", true, summary),
  };
}

function createFatalResult(message: string, summary: string): { findings: Finding[]; phase: InspectorPhase } {
  return {
    findings: [
      createFinding({
        lawId: LAW_ID,
        file: INSPECTOR_ENTRY,
        line: 1,
        severity: "fatal",
        message,
      }),
    ],
    phase: createPhase("negative-proof-harness", "FAKE ENFORCEMENT", false, summary),
  };
}

export async function runNegativeProofHarness(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  try {
    const baseline = runInspectorProcess(true);
    const baselineOutput = formatInspectorOutput(baseline);

    if (MUTATIONS.some((mutation) => baselineOutput.includes(mutation.expectedNeedle))) {
      return createFatalResult(
        "Audit-system negative-proof harness baseline already contains a mutation target finding and cannot prove a delta safely.",
        "Audit-system negative-proof harness cannot start because the baseline output already contains a mutation target finding.",
      );
    }

    const proofs: MutationProof[] = [];
    for (const mutationGroup of createMutationGroups()) {
      for (const mutation of mutationGroup) {
        const proof = await mutateAndVerify(mutation, baseline);
        await verifyRollback(mutation, baseline);
        proofs.push(proof);
      }
    }

    await writeStaticClauseCoverageProof({ scenarios: proofs, rollbackOutput: baselineOutput });

    const reports = proofs.map((proof) => `${proof.name}: fail-ok rollback-ok`);

    return createPassResult(`Audit-system negative-proof harness rejects ${reports.join(", ")}.`);
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Audit-system negative-proof harness failed.",
      "Audit-system negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}
