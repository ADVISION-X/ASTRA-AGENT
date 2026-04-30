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

const INSPECTOR_ENTRY = "scripts/audit/domains/nerve-bus-capability/inspector.ts";
const SKIP_NEGATIVE_PROOF_ENV = "GRASSEYE_SKIP_NERVE_BUS_NEGATIVE_PROOF";

const MUTATIONS: Mutation[] = [
  {
    name: "export-star escape mutation",
    file: "src/capabilities/nerve-bus/index.ts",
    search: 'export { listNerveBusChildren } from "./registry.js";',
    replace: 'export { listNerveBusChildren } from "./registry.js";\nexport * from "./schema.js";',
  },
  {
    name: "input gate bypass mutation",
    file: "src/capabilities/nerve-bus/runtime/nerve-bus-executor.ts",
    search: "const inputGate = enforceEnvelopeInputGate({ envelope: input.envelope, registryEntry: input.registryEntry });",
    replace: "const inputGate = { ok: true } as const;",
  },
  {
    name: "timeout relabel mutation",
    file: "src/capabilities/nerve-bus/runtime/transport-runner.ts",
    search: 'handlerDecision: "timed_out",',
    replace: 'handlerDecision: "missing_handler",',
  },
  {
    name: "proof drop mutation",
    file: "src/capabilities/nerve-bus/runtime/transport-proof-builder.ts",
    search: "    queueDecision: input.queueDecision,",
    replace: "    queueState: input.queueDecision,",
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
    const result = await runInspector();
    if (result.passed || result.violationCount === 0) {
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
            lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-003-V1",
            file: INSPECTOR_ENTRY,
            line: 1,
            severity: "fatal",
            message: "Nerve Bus inspector baseline must pass before negative-proof mutation checks.",
          }),
        ],
        phase: createPhase(
          "negative-proof-harness",
          "FAKE ENFORCEMENT",
          false,
          "Nerve Bus negative-proof harness cannot start because the baseline inspector is not passing.",
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
        "Nerve Bus negative-proof harness rejects export-star escape, gate bypass, timeout relabeling, and proof dropping mutations.",
      ),
    };
  } catch (error) {
    return {
      findings: [
        createFinding({
          lawId: "GRASSEYE-NERVE-BUS-CAPABILITY-003-V1",
          file: INSPECTOR_ENTRY,
          line: 1,
          severity: "fatal",
          message: error instanceof Error ? error.message : "Nerve Bus negative-proof harness failed.",
        }),
      ],
      phase: createPhase(
        "negative-proof-harness",
        "FAKE ENFORCEMENT",
        false,
        "Nerve Bus negative-proof harness failed to prove mutation rejection and rollback recovery.",
      ),
    };
  }
}