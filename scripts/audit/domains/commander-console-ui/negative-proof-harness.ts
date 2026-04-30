import { readFile, unlink, writeFile } from "node:fs/promises";

import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { createInspectorContext, loadGeneratedArtifacts, loadInspector } from "../../core/runtime.js";

import { LAW_ID } from "./ast-utils.js";

type Mutation = {
  name: string;
  file: string;
  mode?: "replace" | "write";
  search?: string;
  replace?: string;
  content?: string;
};

const INSPECTOR_ENTRY = "scripts/audit/domains/commander-console-ui/inspector.ts";

const MUTATIONS: Mutation[] = [
  {
    name: "primary-page removal mutation",
    file: "src/features/commander-console/types.ts",
    search: '  | "run-policy";',
    replace: ";",
  },
  {
    name: "legacy dashboard reimport mutation",
    file: "src/lib/local-app-shell/render-commander-console-page.ts",
    search: 'import { renderCommanderConsoleShell } from "../../features/commander-console/CommanderConsoleShell.js";\nimport type { Locale } from "../localization/dictionaries.js";\n\nexport function renderCommanderConsolePage(dashboard: CommanderMissionDashboardView, options: {\n  locale: Locale;\n  requestUrl: URL;\n}): string {\n  return renderCommanderConsoleShell(dashboard, options);\n}',
    replace: 'import { commanderConsolePageClient } from "./commander-console-page-client.js";\nimport type { Locale } from "../localization/dictionaries.js";\n\nexport function renderCommanderConsolePage(_dashboard: CommanderMissionDashboardView, _options: {\n  locale: Locale;\n  requestUrl: URL;\n}): string {\n  return commanderConsolePageClient;\n}',
  },
  {
    name: "legacy dashboard file resurrection mutation",
    file: "src/lib/local-app-shell/commander-console-page-client.ts",
    mode: "write",
    content: 'export const commanderConsolePageClient = "legacy-dashboard";\n',
  },
  {
    name: "private runtime import mutation",
    file: "src/features/commander-console/CommanderConsoleShell.ts",
    search: 'import { commanderConsoleShellClient } from "./commander-console-shell-client.js";',
    replace: 'import { GrassEyeWorkbench } from "../../lib/local-runtime/workbench.js";\nimport { commanderConsoleShellClient } from "./commander-console-shell-client.js";\nvoid GrassEyeWorkbench;',
  },
  {
    name: "candidate delete bypass mutation",
    file: "src/app/candidate-api-handlers.ts",
    search: '  response.writeHead(410, { "content-type": "application/json; charset=utf-8" });\n  response.end(JSON.stringify({ error: "candidate_delete_removed_from_commander_console_ui" }));',
    replace: '  await _activeWorkbench.deleteCandidate("mutated-candidate-id");\n  response.writeHead(200, { "content-type": "application/json; charset=utf-8" });\n  response.end(JSON.stringify({ ok: true }));',
  },
  {
    name: "start contract relaxation mutation",
    file: "src/capabilities/commander-console/children/issue-human-command/schema.ts",
    search: '  if (!value.requestedPlatformId || !value.selectedMapId) {',
    replace: '  if (!value.requestedPlatformId && !value.selectedMapId) {',
  },
  {
    name: "public handler rename mutation",
    file: "src/features/commander-console/types.ts",
    search: '  onEmergencyStop: () => Promise<void>;',
    replace: '  onEmergencyAbort: () => Promise<void>;',
  },
];

async function runInspector(): Promise<{ passed: boolean; violationCount: number }> {
  await buildAuditArtifacts();
  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  const inspector = await loadInspector(INSPECTOR_ENTRY);
  const result = await inspector(context);
  return { passed: result.passed, violationCount: result.violationCount };
}

async function mutateAndVerify(mutation: Mutation): Promise<void> {
  const filePath = pathFromRepoRoot(mutation.file);
  let original = "";
  let existed = false;

  try {
    original = await readFile(filePath, "utf8");
    existed = true;
  } catch {
    existed = false;
  }

  if (mutation.mode === "write") {
    await writeFile(filePath, mutation.content ?? "", "utf8");
  } else {
    if (!mutation.search || mutation.replace === undefined) {
      throw new Error(`Replace mutation is missing search/replace for ${mutation.name}`);
    }
    if (!original.includes(mutation.search)) {
      throw new Error(`Mutation seed not found for ${mutation.name} in ${mutation.file}`);
    }
    await writeFile(filePath, original.replace(mutation.search, mutation.replace), "utf8");
  }

  try {
    const result = await runInspector();
    if (result.passed || result.violationCount === 0) {
      throw new Error(`Inspector did not fail for ${mutation.name}`);
    }
  } finally {
    if (existed) {
      await writeFile(filePath, original, "utf8");
    } else {
      await unlink(filePath);
    }
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
            lawId: LAW_ID,
            file: INSPECTOR_ENTRY,
            line: 1,
            severity: "fatal",
            message: "Commander Console UI inspector baseline must pass before negative-proof mutation checks.",
          }),
        ],
        phase: createPhase(
          "negative-proof-harness",
          "FAKE ENFORCEMENT",
          false,
          "Commander Console UI negative-proof harness cannot start because the baseline inspector is not passing.",
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
        "Commander Console UI negative-proof harness rejects topology deletion, legacy dashboard return, private runtime imports, delete bypasses, contract relaxation, and public handler renames.",
      ),
    };
  } catch (error) {
    return {
      findings: [
        createFinding({
          lawId: LAW_ID,
          file: INSPECTOR_ENTRY,
          line: 1,
          severity: "fatal",
          message: error instanceof Error ? error.message : "Commander Console UI negative-proof harness failed.",
        }),
      ],
      phase: createPhase(
        "negative-proof-harness",
        "FAKE ENFORCEMENT",
        false,
        "Commander Console UI negative-proof harness failed to prove mutation rejection and rollback recovery.",
      ),
    };
  }
}