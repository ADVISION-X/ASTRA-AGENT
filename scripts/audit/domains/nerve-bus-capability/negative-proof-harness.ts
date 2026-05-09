import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector } from "../../core/runtime.js";
import { applyAuditMutation, readAuditFileState, restoreAuditFileState } from "../_shared/read-audit-file-state.js";
import { LAW_IDS } from "./config.js";

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
    name: "commander bypass mutation",
    file: "src/lib/local-runtime/workbench-commander-command-transport.ts",
    search: "    runtime.nerveBusAbilityGroup.dispatchHumanCommand(input),",
    replace: "    runtime.orchestrationAbilityGroup.executeMissionControlCommand(input as never),",
  },
  {
    name: "review transport bypass mutation",
    file: "src/capabilities/orchestration/runtime/orchestration-nerve-bus-adapter.ts",
    search: "    const transport = await nerveBus.dispatchCommanderMessage({",
    replace: "    const transport = await nerveBus.requestAi({",
  },
  {
    name: "ai contract drift mutation",
    file: "src/capabilities/orchestration/runtime/orchestration-nerve-bus-envelope-builders.ts",
    search: "    promptContractVersion: input.promptContractVersion,",
    replace: "    promptVersion: input.promptContractVersion,",
  },
  {
    name: "default injection mutation",
    file: "src/lib/local-runtime/workbench-human-command-dispatch.ts",
    search: "    targetRecordRef: command.targetRecordRef?.recordId ?? null,",
    replace: "    targetRecordRef: command.targetRecordRef?.recordId ?? \"record:default\",",
  },
  {
    name: "proof chain drop mutation",
    file: "src/capabilities/nerve-bus/runtime/transport-proof-builder.ts",
    search: "  activationSnapshotRef: envelope.activationSnapshotRef,",
    replace: "  activationSnapshotRefLegacy: envelope.activationSnapshotRef,",
  },
  {
    name: "ai request signal schema drop mutation",
    file: "src/capabilities/nerve-bus/schema-transport.schema.ts",
    search: "  signal: z.custom<AbortSignal>((value) => value instanceof AbortSignal).optional(),\n",
    replace: "",
  },
  {
    name: "orchestration to ai parent signal drop mutation",
    file: "src/capabilities/nerve-bus/children/orchestration-to-ai/implementation.ts",
    search: "      parentSignal: input.signal,\n",
    replace: "",
  },
  {
    name: "ai handler signal drop mutation",
    file: "src/capabilities/nerve-bus/runtime/transport-runner.ts",
    search: "    promise: input.invoke(handlerSignal),",
    replace: "    promise: input.invoke(controller.signal),",
  },
];

async function runInspector(): Promise<{ passed: boolean; violationCount: number }> {
  const previous = process.env[SKIP_NEGATIVE_PROOF_ENV];
  process.env[SKIP_NEGATIVE_PROOF_ENV] = "1";

  try {

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
  const state = await readAuditFileState(filePath);
  await applyAuditMutation(filePath, state.original, mutation);

  try {
    const result = await runInspector();
    if (result.passed || result.violationCount === 0) {
      throw new Error(`Inspector did not fail for ${mutation.name}`);
    }
  } finally {
    await restoreAuditFileState(filePath, state);
  }

  const restored = await runInspector();
  if (!restored.passed) {
    throw new Error(`Rollback verification failed for ${mutation.name}`);
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
        lawId: LAW_IDS.ENFORCEMENT,
        file: INSPECTOR_ENTRY,
        line: 1,
        severity: "fatal",
        message,
      }),
    ],
    phase: createPhase("negative-proof-harness", "FAKE ENFORCEMENT", false, summary),
  };
}

async function runMutations(): Promise<void> {
  for (const mutation of MUTATIONS) {
    await mutateAndVerify(mutation);
  }
}

export async function runNegativeProofHarness(): Promise<{ findings: Finding[]; phase: InspectorPhase }> {
  try {
    const baseline = await runInspector();
    if (!baseline.passed) {
      return createFatalResult(
        "Nerve Bus inspector baseline must pass before negative-proof mutation checks.",
        "Nerve Bus negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }

    await runMutations();

    return createPassResult("Nerve Bus negative-proof harness rejects export-star escape, commander/review bypass, AI contract drift, default injection, proof chain dropping, and AI AbortSignal drop mutations.");
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Nerve Bus negative-proof harness failed.",
      "Nerve Bus negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  }
}
