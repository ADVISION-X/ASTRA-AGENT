import { spawn } from "node:child_process";

type CiStep = {
  label: string;
  args: string[];
  timeoutMs: number;
  env?: Record<string, string>;
};

type CiStage = {
  label: string;
  parallel: boolean;
  steps: CiStep[];
};

const QUICK_STEP_TIMEOUT_MS = 120_000;
const OWNER_STEP_TIMEOUT_MS = 300_000;
const CODE_PURITY_TIMEOUT_MS = 600_000;

const SKIP_NEGATIVE_PROOF_ENV: Record<string, string> = {
  GRASSEYE_SKIP_AI_NEGATIVE_PROOF: "1",
  GRASSEYE_SKIP_AUDIT_SYSTEM_NEGATIVE_PROOF: "1",
  GRASSEYE_SKIP_CAPABILITY_GROUP_GOVERNANCE_NEGATIVE_PROOF: "1",
  GRASSEYE_SKIP_COMMANDER_STARTUP_EXIT_NEGATIVE_PROOF: "1",
  GRASSEYE_SKIP_FORENSICS_NEGATIVE_PROOF: "1",
  GRASSEYE_SKIP_GEOMETRY_GUARD_NEGATIVE_PROOF: "1",
  GRASSEYE_SKIP_MAP_PLUGIN_NEGATIVE_PROOF: "1",
  GRASSEYE_SKIP_MOUSE_CLICK_NEGATIVE_PROOF: "1",
  GRASSEYE_SKIP_MOUSE_SCROLL_NEGATIVE_PROOF: "1",
  GRASSEYE_SKIP_NERVE_BUS_NEGATIVE_PROOF: "1",
  GRASSEYE_SKIP_OPEN_NEGATIVE_PROOF: "1",
  GRASSEYE_SKIP_ORCHESTRATION_NEGATIVE_PROOF: "1",
  GRASSEYE_SKIP_PAGE_STATE_NEGATIVE_PROOF: "1",
  GRASSEYE_SKIP_POST_ACTION_NEGATIVE_PROOF: "1",
  GRASSEYE_SKIP_SCREENSHOT_NEGATIVE_PROOF: "1",
  GRASSEYE_SKIP_TEXT_INPUT_NEGATIVE_PROOF: "1",
  GRASSEYE_SKIP_VISUAL_TARGET_NEGATIVE_PROOF: "1",
};

const CI_STAGES: CiStage[] = [
  {
    label: "foundation-layer",
    parallel: false,
    steps: [
      { label: "code-purity", args: ["run", "audit:code-purity"], timeoutMs: CODE_PURITY_TIMEOUT_MS, env: { GRASSEYE_SKIP_CODE_PURITY_NEGATIVE_PROOF: "1" } },
      { label: "typecheck", args: ["run", "typecheck"], timeoutMs: QUICK_STEP_TIMEOUT_MS },
      { label: "audit build", args: ["run", "audit:build"], timeoutMs: QUICK_STEP_TIMEOUT_MS },
      { label: "capability-group-governance", args: ["run", "audit:capability-group-governance"], timeoutMs: OWNER_STEP_TIMEOUT_MS, env: SKIP_NEGATIVE_PROOF_ENV },
      { label: "type-safety", args: ["run", "audit:type-safety"], timeoutMs: QUICK_STEP_TIMEOUT_MS },
      { label: "security-privacy", args: ["run", "audit:security-privacy"], timeoutMs: QUICK_STEP_TIMEOUT_MS },
      { label: "audit-system", args: ["run", "audit:audit-system"], timeoutMs: OWNER_STEP_TIMEOUT_MS, env: { ...SKIP_NEGATIVE_PROOF_ENV, GRASSEYE_SKIP_AUDIT_SYSTEM_CODE_PURITY: "1" } },
    ],
  },
  {
    label: "map-layer",
    parallel: false,
    steps: [
      { label: "map-plugin-package", args: ["run", "audit:map-plugin-package"], timeoutMs: OWNER_STEP_TIMEOUT_MS, env: SKIP_NEGATIVE_PROOF_ENV },
    ],
  },
  {
    label: "ability-group-layer",
    parallel: true,
    steps: [
      { label: "commander-console", args: ["run", "audit:commander-console"], timeoutMs: OWNER_STEP_TIMEOUT_MS, env: SKIP_NEGATIVE_PROOF_ENV },
      { label: "orchestration", args: ["run", "audit:orchestration"], timeoutMs: OWNER_STEP_TIMEOUT_MS, env: SKIP_NEGATIVE_PROOF_ENV },
      { label: "nerve-bus", args: ["run", "audit:nerve-bus"], timeoutMs: OWNER_STEP_TIMEOUT_MS, env: SKIP_NEGATIVE_PROOF_ENV },
      { label: "ai", args: ["run", "audit:ai"], timeoutMs: OWNER_STEP_TIMEOUT_MS, env: SKIP_NEGATIVE_PROOF_ENV },
      { label: "open", args: ["run", "audit:open"], timeoutMs: OWNER_STEP_TIMEOUT_MS, env: SKIP_NEGATIVE_PROOF_ENV },
      { label: "screenshot", args: ["run", "audit:screenshot"], timeoutMs: OWNER_STEP_TIMEOUT_MS, env: SKIP_NEGATIVE_PROOF_ENV },
      { label: "visual-target", args: ["run", "audit:visual-target"], timeoutMs: OWNER_STEP_TIMEOUT_MS, env: SKIP_NEGATIVE_PROOF_ENV },
      { label: "geometry-guard", args: ["run", "audit:geometry-guard"], timeoutMs: OWNER_STEP_TIMEOUT_MS, env: SKIP_NEGATIVE_PROOF_ENV },
      { label: "mouse-click", args: ["run", "audit:mouse-click"], timeoutMs: OWNER_STEP_TIMEOUT_MS, env: SKIP_NEGATIVE_PROOF_ENV },
      { label: "text-input", args: ["run", "audit:text-input-capability"], timeoutMs: OWNER_STEP_TIMEOUT_MS, env: SKIP_NEGATIVE_PROOF_ENV },
      { label: "mouse-scroll", args: ["run", "audit:mouse-scroll"], timeoutMs: OWNER_STEP_TIMEOUT_MS, env: SKIP_NEGATIVE_PROOF_ENV },
      { label: "post-action-verification", args: ["run", "audit:post-action-verification"], timeoutMs: OWNER_STEP_TIMEOUT_MS, env: SKIP_NEGATIVE_PROOF_ENV },
      { label: "forensics-persistence", args: ["run", "audit:forensics-persistence"], timeoutMs: OWNER_STEP_TIMEOUT_MS, env: SKIP_NEGATIVE_PROOF_ENV },
      { label: "page-state", args: ["run", "audit:page-state"], timeoutMs: OWNER_STEP_TIMEOUT_MS, env: SKIP_NEGATIVE_PROOF_ENV },
    ],
  },
];

const exitNow = (code: number): never => {
  process.exit(code);
};

const runCiStep = async (step: CiStep, stageLabel: string): Promise<void> => {
  process.stdout.write(`[CI FULL] ${stageLabel} starting ${step.label}...\n`);

  await new Promise<void>((resolve, reject) => {
    const child = spawn("npm", step.args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, ...step.env },
    });
    let settled = false;
    let timeoutHandle: ReturnType<typeof setTimeout>;

    const finish = (error?: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutHandle);
      if (error) {
        reject(error);
        return;
      }
      process.stdout.write(`[CI FULL] ${step.label} passed.\n`);
      resolve();
    };

    timeoutHandle = setTimeout(() => {
      child.kill("SIGTERM");
      finish(new Error(`[CI FULL FAIL-FAST] stopped at ${step.label} after ${step.timeoutMs}ms.`));
    }, step.timeoutMs);

    child.on("error", (error) => {
      finish(new Error(`[CI FULL FAIL-FAST] ${step.label} could not start: ${error.message}`));
    });
    child.on("exit", (code, signal) => {
      if (code === 0) {
        finish();
        return;
      }
      finish(new Error(`[CI FULL FAIL-FAST] stopped at ${step.label}${signal ? ` by ${signal}` : ""} with exit code ${code ?? 1}.`));
    });
  });
};

const runCiStage = async (stage: CiStage): Promise<void> => {
  process.stdout.write(`[CI FULL] stage ${stage.label} starting (${stage.parallel ? "parallel" : "serial"}).\n`);
  if (stage.parallel) {
    await Promise.all(stage.steps.map((step) => runCiStep(step, stage.label)));
  } else {
    for (const step of stage.steps) {
      await runCiStep(step, stage.label);
    }
  }
  process.stdout.write(`[CI FULL] stage ${stage.label} passed.\n`);
};

const main = async (): Promise<void> => {
  for (const stage of CI_STAGES) {
    await runCiStage(stage);
  }
  process.stdout.write("[CI FULL PASS] foundation, map, and 14 ability-group audits all passed.\n");
  exitNow(0);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  exitNow(1);
});
