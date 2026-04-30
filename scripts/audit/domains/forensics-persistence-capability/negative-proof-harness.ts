import { readFile, writeFile } from "node:fs/promises";

import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector } from "../../core/runtime.js";

type Mutation = {
  name: string;
  file: string;
  search: string;
  replace: string;
};

const INSPECTOR_ENTRY = "scripts/audit/domains/forensics-persistence-capability/inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_FORENSICS_NEGATIVE_PROOF";
const LAW_ENFORCEMENT = "GRASSEYE-FORENSICS-PERSISTENCE-005-V1";

const MUTATIONS: Mutation[] = [
  {
    name: "structured log level field mutation",
    file: "src/types/structured-log.ts",
    search: "  level: StructuredRuntimeLogLevelSchema.default(\"INFO\"),",
    replace: "  severity: StructuredRuntimeLogLevelSchema.default(\"INFO\"),",
  },
  {
    name: "structured log prompt debug ref mutation",
    file: "src/types/structured-log.ts",
    search: "  promptDebugRef: nullableString,",
    replace: "  promptDiagnosticRef: nullableString,",
  },
  {
    name: "structured log raw response hash mutation",
    file: "src/types/structured-log.ts",
    search: "  rawResponseHash: nullableString,",
    replace: "  rawResponseDigest: nullableString,",
  },
  {
    name: "commander drafted event mutation",
    file: "src/app/task-api-handlers.ts",
    search: "      eventType: \"HUMAN_COMMAND_DRAFTED\",",
    replace: "      eventType: \"HUMAN_COMMAND_STARTED\",",
  },
  {
    name: "service shutdown event mutation",
    file: "scripts/startup/launch-grasseye.mjs",
    search: "SERVICE_SHUTDOWN_REQUESTED",
    replace: "SERVICE_STOP_REQUESTED",
  },
  {
    name: "workbench ai relay mutation",
    file: "src/lib/local-runtime/workbench.ts",
    search: "  async recordAiDebugEvent(input: AiRuntimeStructuredDebugEvent): Promise<void> {",
    replace: "  async recordAiEvent(input: AiRuntimeStructuredDebugEvent): Promise<void> {",
  },
];

async function runInspector(): Promise<{ passed: boolean; violationCount: number }> {
  const previous = process.env[SKIP_NEGATIVE_PROOF_ENV];
  process.env[SKIP_NEGATIVE_PROOF_ENV] = "1";

  try {
    await buildAuditArtifacts();
    const artifacts = await loadGeneratedArtifacts();
    const context = await createInspectorContext(artifacts);
    const inspector = await loadInspector(INSPECTOR_ENTRY);
    const result = await inspector(context);
    return { passed: result.passed, violationCount: result.violationCount };
  } finally {
    if (previous === undefined) {
      delete process.env[SKIP_NEGATIVE_PROOF_ENV];
    } else {
      process.env[SKIP_NEGATIVE_PROOF_ENV] = previous;
    }
  }
}

async function mutateAndVerify(mutation: Mutation): Promise<void> {
  const filePath = pathFromRepoRoot(mutation.file);
  const original = await readFile(filePath, "utf8");

  if (!original.includes(mutation.search)) {
    throw new Error(`Mutation seed not found for ${mutation.name} in ${mutation.file}`);
  }

  await writeFile(filePath, original.replace(mutation.search, mutation.replace), "utf8");

  try {
    const mutated = await runInspector();
    if (mutated.passed || mutated.violationCount === 0) {
      throw new Error(`Inspector did not fail for ${mutation.name}`);
    }
  } finally {
    await writeFile(filePath, original, "utf8");
  }

  const restored = await runInspector();
  if (!restored.passed) {
    throw new Error(`Rollback verification failed for ${mutation.name}`);
  }
}

export async function runNegativeProofHarness(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  try {
    const baseline = await runInspector();
    if (!baseline.passed) {
      return {
        findings: [
          createFinding({
            lawId: LAW_ENFORCEMENT,
            file: INSPECTOR_ENTRY,
            line: 1,
            severity: "fatal",
            message: "Forensics inspector baseline must pass before negative-proof mutation checks.",
          }),
        ],
        phase: createPhase(
          "negative-proof-harness",
          "FAKE ENFORCEMENT",
          false,
          "Forensics negative-proof harness cannot start because the baseline inspector is not passing.",
        ),
      };
    }

    for (const mutation of MUTATIONS) {
      await mutateAndVerify(mutation);
    }

    return {
      findings: [],
      phase: createPhase(
        "negative-proof-harness",
        "PASS",
        true,
        "Forensics negative-proof harness rejects structured-log field deletion, AI debug event drift, commander flow drift, startup exit drift, and workbench relay mutations.",
      ),
    };
  } catch (error) {
    return {
      findings: [
        createFinding({
          lawId: LAW_ENFORCEMENT,
          file: INSPECTOR_ENTRY,
          line: 1,
          severity: "fatal",
          message: error instanceof Error ? error.message : "Forensics negative-proof harness failed.",
        }),
      ],
      phase: createPhase(
        "negative-proof-harness",
        "FAKE ENFORCEMENT",
        false,
        "Forensics negative-proof harness failed to prove mutation rejection and rollback recovery.",
      ),
    };
  }
}