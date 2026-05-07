import { spawnSync } from "node:child_process";
import path from "node:path";

import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import {
  applyThrowawayAuditMutation,
  createThrowawayAuditWorkspace,
  readThrowawayAuditFileState,
  restoreThrowawayAuditFileState,
} from "../_shared/throwaway-audit-workspace.js";

import { capabilityGroupGovernanceConstants } from "./inspection-constants.js";

type Mutation = {
  name: string;
  file: string;
  search: string;
  replace: string;
  expectedNeedle: string;
  phase: TargetNegativeProofPhase;
  skipBuild?: boolean;
};

type TargetNegativeProofPhase =
  | "package-audit-entrypoints"
  | "negative-proof-wiring"
  | "ai-only-media-change-boundary"
  | "ai-only-cognition-surface-boundary";

type MutationGroup = {
  name: string;
  phase: TargetNegativeProofPhase;
  mutations: Mutation[];
  skipBuild: boolean;
};

const {
  INSPECTOR_ENTRY,
  LAW_ID_001,
  SKIP_NEGATIVE_PROOF_ENV,
} = capabilityGroupGovernanceConstants;

const RUN_INSPECTOR_ENTRY = "scripts/audit/domains/capability-group-governance/run-inspector.ts";
const NEGATIVE_PROOF_PHASE_ENV = "GRASSEYE_CAPABILITY_GROUP_NEGATIVE_PROOF_PHASE";
const THROWAWAY_WORKSPACE_PATHS = [
  ".github",
  "config",
  "docs",
  "scripts",
  "src",
  "package.json",
  "tsconfig.json",
] as const;

const MUTATIONS: Mutation[] = [
  {
    name: "package audit entrypoint drift mutation",
    file: "package.json",
    search: '    "audit:mouse-click": "node --import tsx scripts/audit/domains/mouse-click-capability/run-inspector.ts",',
    replace: '    "audit:runtime-debug-transparency": "node --import tsx scripts/audit/domains/mouse-click-capability/run-inspector.ts",',
    expectedNeedle: "package.json must not expose audit:runtime-debug-transparency; only constitutional owners may publish audit entrypoints.",
    phase: "package-audit-entrypoints",
  },
  {
    name: "negative-proof invocation removed mutation",
    file: INSPECTOR_ENTRY,
    search: "    : await runNegativeProofHarness();",
    replace: "    : { findings: [], phase: { name: \"negative-proof-harness\", classification: \"PASS\" as const, passed: true, summary: \"negative-proof removed by mutation\" } };",
    expectedNeedle: "Capability-group-governance inspector must invoke and report the negative-proof harness.",
    phase: "negative-proof-wiring",
  },
  {
    name: "retired video-change child revived mutation",
    file: "src/capabilities/post-action-verification/shared/post-action-types.ts",
    search: "  \"observe-comments-panel-close-attempt\",\n  \"observe-not-interested-attempt\",\n",
    replace: "  \"observe-comments-panel-close-attempt\",\n  \"verify-video-changed-after-scroll\",\n  \"observe-not-interested-attempt\",\n",
    expectedNeedle: "Non-AI capability or support code must not revive verify-video-changed-after-scroll or related non-AI video-change outputs.",
    phase: "ai-only-media-change-boundary",
  },
  {
    name: "non-ai local sensitive detector revived mutation",
    file: "src/capabilities/text-input/shared/text-input-redaction.ts",
    search: "export function buildRedactedPreview(value: string, maxPreviewChars: number): string {\n",
    replace: "export function detectSensitiveText(value: string): boolean {\n  return /@|https?:\\/\\/|\\b\\d{6,}\\b/.test(value);\n}\n\nexport function buildRedactedPreview(value: string, maxPreviewChars: number): string {\n",
    expectedNeedle: "Non-AI ability code must not expose AI-owned detect, classification, freshness, threshold, ambiguity-policy, or local sensitive-text cognition surfaces.",
    phase: "ai-only-cognition-surface-boundary",
  },
  {
    name: "visual-target detect child revived mutation",
    file: "src/capabilities/visual-target/shared/visual-target-types.ts",
    search: "const VISUAL_TARGET_CHILD_CAPABILITY_IDS = [\n  \"observe-like-button\",\n",
    replace: "const VISUAL_TARGET_CHILD_CAPABILITY_IDS = [\n  \"detect-like-button\",\n  \"observe-like-button\",\n",
    expectedNeedle: "Non-AI ability code must not publish detect-* child ids, legacy cognition field names, local selection-policy literals, or wall/domain verdict literals.",
    phase: "ai-only-cognition-surface-boundary",
  },
];

function runInspectorProcess(input: {
  workspaceRoot: string;
  phase?: TargetNegativeProofPhase;
  skipBuild?: boolean;
}): { status: number | null; stdout: string; stderr: string } {
  const skipBuild = input.skipBuild ?? true;
  const result = spawnSync(
    "node",
    ["--import", "tsx", RUN_INSPECTOR_ENTRY, ...(skipBuild ? ["--skip-build"] : [])],
    {
      cwd: input.workspaceRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        [SKIP_NEGATIVE_PROOF_ENV]: "1",
        ...(input.phase ? { [NEGATIVE_PROOF_PHASE_ENV]: input.phase } : {}),
        TSX_DISABLE_CACHE: "1",
      },
    },
  );

  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function createMutationGroups(): MutationGroup[] {
  const groups = new Map<string, MutationGroup>();
  for (const mutation of MUTATIONS) {
    const skipBuild = mutation.skipBuild ?? true;
    const key = `${mutation.phase}:${skipBuild ? "skip-build" : "with-build"}`;
    const existing = groups.get(key);
    if (existing) {
      existing.mutations.push(mutation);
      continue;
    }

    groups.set(key, {
      name: key,
      phase: mutation.phase,
      mutations: [mutation],
      skipBuild,
    });
  }

  return [...groups.values()];
}

async function applyMutationGroup(workspaceRoot: string, group: MutationGroup): Promise<() => Promise<void>> {
  const rollbacks: Array<() => Promise<void>> = [];
  try {
    for (const mutation of group.mutations) {
      const filePath = path.join(workspaceRoot, mutation.file);
      const state = await readThrowawayAuditFileState(filePath);
      await applyThrowawayAuditMutation(filePath, state.original, mutation);
      rollbacks.push(async () => restoreThrowawayAuditFileState(filePath, state));
    }

    return async () => {
      for (const rollback of rollbacks.reverse()) {
        await rollback();
      }
    };
  } catch (error) {
    for (const rollback of rollbacks.reverse()) {
      await rollback();
    }
    throw error;
  }
}

async function mutateGroupAndVerifyFailure(workspaceRoot: string, group: MutationGroup): Promise<string> {
  const rollback = await applyMutationGroup(workspaceRoot, group);
  try {
    const failRun = runInspectorProcess({
      workspaceRoot,
      phase: group.phase,
      skipBuild: group.skipBuild,
    });
    const combinedOutput = `${failRun.stdout}\n${failRun.stderr}`;
    if (failRun.status === 0) {
      throw new Error(`Mutation group ${group.name} did not fail inspector as expected.\n${combinedOutput}`);
    }
    const missingNeedles = group.mutations
      .map((mutation) => mutation.expectedNeedle)
      .filter((needle) => !combinedOutput.includes(needle));
    if (missingNeedles.length > 0) {
      throw new Error(`Mutation group ${group.name} failed, but not for every expected reason. Missing needles: ${missingNeedles.join("; ")}`);
    }
  } finally {
    await rollback();
  }

  return `${group.name}: ${group.mutations.map((mutation) => mutation.name).join(", ")} fail-ok`;
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
        lawId: LAW_ID_001,
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
  const throwawayWorkspace = await createThrowawayAuditWorkspace({
    workspaceName: "capability-group-governance-negative-proof",
    relativePaths: THROWAWAY_WORKSPACE_PATHS,
  });

  try {
    const baseline = runInspectorProcess({
      workspaceRoot: throwawayWorkspace.workspaceRoot,
      skipBuild: true,
    });
    if (baseline.status !== 0) {
      return createFatalResult(
        "Capability-group-governance inspector baseline must pass before negative-proof mutation checks.",
        "Capability-group-governance negative-proof harness cannot start because the baseline inspector is not passing.",
      );
    }

    const reports: string[] = [];
    for (const group of createMutationGroups()) {
      reports.push(await mutateGroupAndVerifyFailure(throwawayWorkspace.workspaceRoot, group));
    }

    const rollbackRun = runInspectorProcess({
      workspaceRoot: throwawayWorkspace.workspaceRoot,
      skipBuild: false,
    });
    if (rollbackRun.status !== 0) {
      throw new Error(
        `Capability-group-governance negative-proof mutations did not restore inspector PASS after rollback.\n${rollbackRun.stdout}\n${rollbackRun.stderr}`,
      );
    }

    return createPassResult(
      `Capability-group-governance negative-proof harness rejects ${reports.join(", ")} in an isolated throwaway workspace.`,
    );
  } catch (error) {
    return createFatalResult(
      error instanceof Error ? error.message : "Capability-group-governance negative-proof harness failed.",
      "Capability-group-governance negative-proof harness failed to prove mutation rejection and rollback recovery.",
    );
  } finally {
    await throwawayWorkspace.cleanup();
  }
}
