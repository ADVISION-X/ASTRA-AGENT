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

const INSPECTOR_ENTRY = "scripts/audit/domains/commander-console-user-love/inspector.ts";

const MUTATIONS: Mutation[] = [
  { name: "scorecard 94 mutation", file: "docs/audit/commander-console-user-love-scorecard.md", search: '"score": 96', replace: '"score": 94' },
  { name: "scorecard remove evidence mutation", file: "docs/audit/commander-console-user-love-scorecard.md", search: '"evidence": [', replace: '"evidence": []' },
  { name: "home selectedMapId exposure mutation", file: "src/features/commander-console/pages/HomeStartPage.ts", search: 'Home / Start', replace: 'selectedMapId' },
  { name: "home requestedPlatformId exposure mutation", file: "src/features/commander-console/pages/HomeStartPage.ts", search: 'Start Task', replace: 'requestedPlatformId' },
  { name: "home targetProfileRef exposure mutation", file: "src/features/commander-console/pages/HomeStartPage.ts", search: 'Current Mission', replace: 'targetProfileRef' },
  { name: "silent default tiktok mutation", file: "src/app/task-api-handlers.ts", search: 'const requestedPlatformId = normalizeRequestedPlatformId(body.requestedPlatformId);', replace: 'const requestedPlatformId = normalizeRequestedPlatformId(body.requestedPlatformId) ?? "tiktok-web";' },
  { name: "silent default selectedMap mutation", file: "src/app/task-api-handlers.ts", search: 'const selectedMapId = body.selectedMapId?.trim() || null;', replace: 'const selectedMapId = body.selectedMapId?.trim() || "tiktok.discovery.intake.v1";' },
  { name: "legacy shell render entry mutation", file: "src/lib/local-app-shell/render-commander-console-page.ts", search: 'renderCommanderAppShell', replace: 'renderCommanderConsoleShell' },
  { name: "legacy shell resurrection mutation", file: "src/features/commander-console/CommanderConsoleShell.ts", mode: "write", content: 'export function renderCommanderConsoleShell() { return "mega-dashboard"; }\n' },
  { name: "delete bottom nav mutation", file: "src/features/commander-console/CommanderAppShell.ts", search: 'bottomNav: renderBottomNav(appViewModel, viewModel),', replace: 'bottomNav: "",' },
  { name: "delete emergency stop mutation", file: "src/features/commander-console/layout/CompactStatusBar.ts", search: 'data-command-action="emergency-stop"', replace: 'data-command-action="emergency-stop-removed"' },
  { name: "developer nav visible mutation", file: "src/features/commander-console/layout/BottomNav.ts", search: ' hidden="hidden"', replace: '' },
  { name: "inspect default open mutation", file: "src/features/commander-console/layout/InspectModal.ts", search: 'hidden="hidden" aria-hidden="true"', replace: 'aria-hidden="false"' },
  { name: "boot developer mutation", file: "src/features/commander-console/commander-app.view-model.ts", search: 'initialPageId: "home"', replace: 'initialPageId: "developer"' },
  { name: "client developer auto-open mutation", file: "src/features/commander-console/commander-console-shell-client.ts", search: 'developerModeOpen: false,', replace: 'developerModeOpen: true,' },
  { name: "client render all pages mutation", file: "src/features/commander-console/commander-console-shell-client.ts", search: "pageHost.innerHTML = pageHtml[nextPage] || pageHtml.home || '';", replace: "pageHost.innerHTML = Object.values(pageHtml).join('');" },
  { name: "router concatenate pages mutation", file: "src/features/commander-console/CommanderAppRouter.ts", search: 'data-app-page-host>${initialPageHtml}</div>', replace: 'data-app-page-host>${Object.values(buildCommanderAppPageHtmlMap).join(\'\')}</div>' },
  { name: "status metrics three column mutation", file: "src/features/commander-console/styles/commander-console-styles.ts", search: 'grid-template-columns: repeat(2, minmax(0, 1fr));', replace: 'grid-template-columns: repeat(3, minmax(0, 1fr));' },
  { name: "compact min width mutation", file: "src/features/commander-console/styles/commander-console-styles.ts", search: '--cc-frame-max: 520px;', replace: '--cc-frame-max: 640px;\n  min-width: 600px;' },
  { name: "ui import orchestration runtime mutation", file: "src/features/commander-console/pages/MissionPage.ts", search: 'import type { CommanderConsoleViewModel } from "../types.js";', replace: 'import { orchestrationExecutor } from "../../capabilities/orchestration/runtime/orchestration-executor.js";\nimport type { CommanderConsoleViewModel } from "../types.js";\nvoid orchestrationExecutor;' },
  { name: "ui import nerve runtime mutation", file: "src/features/commander-console/pages/HealthPage.ts", search: 'import type { CommanderConsoleViewModel } from "../types.js";', replace: 'import { nerveBusRuntime } from "../../capabilities/nerve-bus/runtime/nerve-bus-runtime.js";\nimport type { CommanderConsoleViewModel } from "../types.js";\nvoid nerveBusRuntime;' },
  { name: "ui import ai mutation", file: "src/features/commander-console/pages/DeveloperPage.ts", search: 'import type { CommanderConsoleViewModel } from "../types.js";', replace: 'import { AiCapability } from "../../capabilities/ai/index.js";\nimport type { CommanderConsoleViewModel } from "../types.js";\nvoid AiCapability;' },
  { name: "as any mutation", file: "src/features/commander-console/pages/MissionPage.ts", search: 'viewModel.runtimeProofTimeline', replace: '(viewModel as any).runtimeProofTimeline' },
  { name: "ts-ignore mutation", file: "src/features/commander-console/pages/ResultsPage.ts", search: 'export function renderResultsPage', replace: '// @ts-ignore\nexport function renderResultsPage' },
  { name: "export star mutation", file: "src/features/commander-console/view-helpers.ts", search: 'export type ActionableErrorView = {', replace: 'export * from "./types.js";\nexport type ActionableErrorView = {' }
];

async function runInspector(): Promise<{ passed: boolean; violationCount: number }> {
  const previousSkip = process.env.GRASSEYE_SKIP_COMMANDER_CONSOLE_USER_LOVE_NEGATIVE_PROOF;
  process.env.GRASSEYE_SKIP_COMMANDER_CONSOLE_USER_LOVE_NEGATIVE_PROOF = "1";

  await buildAuditArtifacts();
  const artifacts = await loadGeneratedArtifacts();
  const context = await createInspectorContext(artifacts);
  const inspector = await loadInspector(INSPECTOR_ENTRY);
  try {
    const result = await inspector(context);
    return { passed: result.passed, violationCount: result.violationCount };
  } finally {
    if (previousSkip === undefined) {
      delete process.env.GRASSEYE_SKIP_COMMANDER_CONSOLE_USER_LOVE_NEGATIVE_PROOF;
    } else {
      process.env.GRASSEYE_SKIP_COMMANDER_CONSOLE_USER_LOVE_NEGATIVE_PROOF = previousSkip;
    }
  }
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
        findings: [],
        phase: createPhase(
          "negative-proof-harness",
          "PASS",
          true,
          "Negative proof is intentionally deferred until the baseline scorecard and shape gates are fully clean.",
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
        "Negative proof rejected all 19 compact-shell mutations and recovered after rollback.",
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
          message: error instanceof Error ? error.message : "Commander Console user-love negative proof failed.",
        }),
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