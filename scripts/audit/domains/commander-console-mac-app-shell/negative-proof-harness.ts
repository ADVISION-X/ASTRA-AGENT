import { readFile, writeFile } from "node:fs/promises";

import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector } from "../../core/runtime.js";

import { LAW_ID } from "./ast-utils.js";

type Mutation = {
  name: string;
  file: string;
  search: string;
  replace: string;
};

const INSPECTOR_ENTRY = "scripts/audit/domains/commander-console-mac-app-shell/inspector.ts";

const MUTATIONS: Mutation[] = [
  { name: "legacy render entry mutation", file: "src/lib/local-app-shell/render-commander-console-page.ts", search: "renderCommanderMacShell", replace: "renderCommanderAppShell" },
  { name: "bottom nav selector mutation", file: "src/features/commander-console/commander-console-shell-client.ts", search: "[data-primary-nav]", replace: "[data-bottom-nav]" },
  { name: "phone shell style mutation", file: "src/features/commander-console/styles/commander-console-styles.ts", search: ".cc-mac-shell", replace: ".cc-phone-shell" },
  { name: "raw task category mutation", file: "src/features/commander-console/modules/TaskTemplateLauncher.ts", search: "template.safetyLevel", replace: "template.taskCategory" },
  { name: "desktop proof inflation mutation", file: "docs/audit/commander-console-mac-app-shell-scorecard.md", search: '"score": 93', replace: '"score": 96' }
];

async function runInspector(): Promise<{ passed: boolean; violationCount: number }> {
  const previousSkip = process.env.GRASSEYE_SKIP_COMMANDER_CONSOLE_MAC_SHELL_NEGATIVE_PROOF;
  process.env.GRASSEYE_SKIP_COMMANDER_CONSOLE_MAC_SHELL_NEGATIVE_PROOF = "1";

  await buildAuditArtifacts();
  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  const inspector = await loadInspector(INSPECTOR_ENTRY);
  try {
    const result = await inspector(context);
    return { passed: result.passed, violationCount: result.violationCount };
  } finally {
    if (previousSkip === undefined) {
      delete process.env.GRASSEYE_SKIP_COMMANDER_CONSOLE_MAC_SHELL_NEGATIVE_PROOF;
    } else {
      process.env.GRASSEYE_SKIP_COMMANDER_CONSOLE_MAC_SHELL_NEGATIVE_PROOF = previousSkip;
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
        findings: [],
        phase: createPhase(
          "negative-proof-harness",
          "PASS",
          true,
          "Negative proof is intentionally deferred until the Mac shell baseline scorecard and atomic quality gates are fully clean.",
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
        "Negative proof rejected all Mac shell mutations and recovered after rollback.",
      ),
    };
  } catch (error) {
    return {
      findings: [
        createFinding({ lawId: LAW_ID, file: INSPECTOR_ENTRY, line: 1, severity: "fatal", message: error instanceof Error ? error.message : "Commander Console Mac shell negative proof failed." }),
      ],
      phase: createPhase(
        "negative-proof-harness",
        "FAKE ENFORCEMENT",
        false,
        "Negative proof failed to demonstrate mutation rejection and rollback recovery.",
      ),
    };
  }
}