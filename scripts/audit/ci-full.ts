import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

type CiStep = {
  label: string;
  args: string[];
  timeoutMs: number;
  env?: Record<string, string>;
};

type CiStageExecutionMode = "serial" | "bounded";

type CiStage = {
  label: string;
  executionMode: CiStageExecutionMode;
  steps: CiStep[];
  maxConcurrency?: number;
};

type MemorySnapshot = {
  runnerRssMb: number;
  childRssMb: number;
  totalRssMb: number;
  heapUsedMb: number;
  externalMb: number;
  activeChildCount: number;
};

const execFileAsync = promisify(execFile);

const QUICK_STEP_TIMEOUT_MS = 120_000;
const OWNER_STEP_TIMEOUT_MS = 300_000;
const CODE_PURITY_TIMEOUT_MS = 600_000;
const ABILITY_GROUP_DEFAULT_MAX_CONCURRENCY = 2;
const ABILITY_GROUP_SAFE_MAX_CONCURRENCY = 2;
const DEFAULT_MAX_RSS_MB = 12_000;
const MEMORY_SAMPLE_INTERVAL_MS = 1_000;
const MAX_CONCURRENCY_ENV = "GRASSEYE_CI_FULL_MAX_CONCURRENCY";
const MAX_RSS_ENV = "GRASSEYE_CI_MAX_RSS_MB";

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

const ACTIVE_CHILD_PIDS = new Set<number>();

let activeStageResourceError: Error | undefined;

const readPositiveIntegerEnv = (name: string): number | undefined => {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) {
    return undefined;
  }

  const parsedValue = Number(rawValue);
  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    throw new Error(`[CI FULL CONFIG] ${name} must be a positive integer.`);
  }

  return parsedValue;
};

const roundMb = (bytes: number): number => Math.round((bytes / 1024 / 1024) * 10) / 10;

const readPidRssMb = async (pid: number): Promise<number> => {
  try {
    const { stdout } = await execFileAsync("ps", ["-o", "rss=", "-p", String(pid)]);
    const rssKb = Number(stdout.trim());
    return Number.isFinite(rssKb) && rssKb > 0 ? Math.round((rssKb / 1024) * 10) / 10 : 0;
  } catch {
    return 0;
  }
};

const captureMemorySnapshot = async (): Promise<MemorySnapshot> => {
  const runnerUsage = process.memoryUsage();
  const childRssValues = await Promise.all([...ACTIVE_CHILD_PIDS].map((pid) => readPidRssMb(pid)));
  const childRssMb = Math.round(childRssValues.reduce((sum, value) => sum + value, 0) * 10) / 10;
  const runnerRssMb = roundMb(runnerUsage.rss);

  return {
    runnerRssMb,
    childRssMb,
    totalRssMb: Math.round((runnerRssMb + childRssMb) * 10) / 10,
    heapUsedMb: roundMb(runnerUsage.heapUsed),
    externalMb: roundMb(runnerUsage.external),
    activeChildCount: ACTIVE_CHILD_PIDS.size,
  };
};

const formatMemorySnapshot = (snapshot: MemorySnapshot): string =>
  `runnerRssMB=${snapshot.runnerRssMb} childRssMB=${snapshot.childRssMb} totalRssMB=${snapshot.totalRssMb} heapUsedMB=${snapshot.heapUsedMb} externalMB=${snapshot.externalMb} activeChildren=${snapshot.activeChildCount}`;

const logMemorySnapshot = async (prefix: string): Promise<void> => {
  const snapshot = await captureMemorySnapshot();
  process.stdout.write(`[CI FULL] ${prefix} memory ${formatMemorySnapshot(snapshot)}.\n`);
};

const stopActiveChildren = (): void => {
  for (const pid of ACTIVE_CHILD_PIDS) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Ignore races for already-exited children.
    }
  }
};

const MAX_RSS_MB = readPositiveIntegerEnv(MAX_RSS_ENV) ?? DEFAULT_MAX_RSS_MB;

const createResourceLimitError = (stageLabel: string, snapshot: MemorySnapshot): Error =>
  new Error(`[CI_RESOURCE_LIMIT_EXCEEDED] stage ${stageLabel} exceeded ${MAX_RSS_MB}MB rss limit (${formatMemorySnapshot(snapshot)}).`);

const assertStageResourceHealthy = (): void => {
  if (activeStageResourceError) {
    throw activeStageResourceError;
  }
};

const startStageMemoryGuard = (stageLabel: string): (() => Promise<void>) => {
  let isStopped = false;
  let isChecking = false;
  const interval = setInterval(() => {
    if (isStopped || isChecking || activeStageResourceError) {
      return;
    }

    isChecking = true;
    void captureMemorySnapshot()
      .then((snapshot) => {
        if (snapshot.totalRssMb > MAX_RSS_MB) {
          activeStageResourceError = createResourceLimitError(stageLabel, snapshot);
          stopActiveChildren();
        }
      })
      .catch(() => {
        // Best-effort guard; ignore sampling errors.
      })
      .finally(() => {
        isChecking = false;
      });
  }, MEMORY_SAMPLE_INTERVAL_MS);

  return async () => {
    isStopped = true;
    clearInterval(interval);
  };
};

const resolveAbilityGroupConcurrency = (): number => {
  const configuredValue = readPositiveIntegerEnv(MAX_CONCURRENCY_ENV) ?? ABILITY_GROUP_DEFAULT_MAX_CONCURRENCY;
  if (configuredValue > ABILITY_GROUP_SAFE_MAX_CONCURRENCY) {
    throw new Error(`[CI FULL CONFIG] ${MAX_CONCURRENCY_ENV} must not exceed ${ABILITY_GROUP_SAFE_MAX_CONCURRENCY} on the memory-safe topology.`);
  }
  return configuredValue;
};

const CI_STAGES: CiStage[] = [
  {
    label: "foundation-layer",
    executionMode: "serial",
    steps: [
      { label: "audit build", args: ["run", "audit:build"], timeoutMs: QUICK_STEP_TIMEOUT_MS },
      { label: "code-purity", args: ["run", "audit:code-purity"], timeoutMs: CODE_PURITY_TIMEOUT_MS },
      { label: "typecheck", args: ["run", "typecheck"], timeoutMs: QUICK_STEP_TIMEOUT_MS },
      { label: "capability-group-governance", args: ["run", "audit:capability-group-governance"], timeoutMs: OWNER_STEP_TIMEOUT_MS, env: SKIP_NEGATIVE_PROOF_ENV },
      { label: "type-safety", args: ["run", "audit:type-safety"], timeoutMs: QUICK_STEP_TIMEOUT_MS },
      { label: "security-privacy", args: ["run", "audit:security-privacy"], timeoutMs: QUICK_STEP_TIMEOUT_MS },
      { label: "audit-system", args: ["run", "audit:audit-system"], timeoutMs: OWNER_STEP_TIMEOUT_MS, env: { ...SKIP_NEGATIVE_PROOF_ENV, GRASSEYE_SKIP_AUDIT_SYSTEM_CODE_PURITY: "1" } },
    ],
  },
  {
    label: "map-layer",
    executionMode: "serial",
    steps: [
      { label: "map-plugin-package", args: ["run", "audit:map-plugin-package"], timeoutMs: OWNER_STEP_TIMEOUT_MS, env: SKIP_NEGATIVE_PROOF_ENV },
    ],
  },
  {
    label: "ability-group-layer",
    executionMode: "bounded",
    maxConcurrency: ABILITY_GROUP_DEFAULT_MAX_CONCURRENCY,
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
  assertStageResourceHealthy();
  process.stdout.write(`[CI FULL] ${stageLabel} starting ${step.label}...\n`);
  await logMemorySnapshot(`before ${stageLabel}/${step.label}`);

  try {
    await new Promise<void>((resolve, reject) => {
    const child = spawn("npm", step.args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, ...step.env },
    });
    if (typeof child.pid === "number") {
      ACTIVE_CHILD_PIDS.add(child.pid);
    }
    let settled = false;
    let timeoutHandle: ReturnType<typeof setTimeout>;

    const finish = (error?: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutHandle);
      if (typeof child.pid === "number") {
        ACTIVE_CHILD_PIDS.delete(child.pid);
      }
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
      if (activeStageResourceError) {
        finish(activeStageResourceError);
        return;
      }
      if (code === 0) {
        finish();
        return;
      }
      finish(new Error(`[CI FULL FAIL-FAST] stopped at ${step.label}${signal ? ` by ${signal}` : ""} with exit code ${code ?? 1}.`));
    });
    });
  } finally {
    await logMemorySnapshot(`after ${stageLabel}/${step.label}`);
  }
};

const runBoundedStage = async (stage: CiStage, maxConcurrency: number): Promise<void> => {
  const pendingSteps = [...stage.steps];
  const workerCount = Math.min(maxConcurrency, pendingSteps.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (pendingSteps.length > 0) {
      assertStageResourceHealthy();
      const step = pendingSteps.shift();
      if (!step) {
        return;
      }
      await runCiStep(step, stage.label);
    }
  });
  await Promise.all(workers);
};

const runCiStage = async (stage: CiStage): Promise<void> => {
  const maxConcurrency = stage.executionMode === "bounded" ? resolveAbilityGroupConcurrency() : 1;
  process.stdout.write(`[CI FULL] stage ${stage.label} starting (${stage.executionMode}${stage.executionMode === "bounded" ? ` maxConcurrency=${maxConcurrency}` : ""}).\n`);
  await logMemorySnapshot(`before stage ${stage.label}`);
  activeStageResourceError = undefined;
  const stopMemoryGuard = startStageMemoryGuard(stage.label);
  try {
    if (stage.executionMode === "serial") {
      for (const step of stage.steps) {
        await runCiStep(step, stage.label);
      }
    } else {
      await runBoundedStage(stage, maxConcurrency);
    }
  } finally {
    await stopMemoryGuard();
  }
  assertStageResourceHealthy();
  await logMemorySnapshot(`after stage ${stage.label}`);
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
