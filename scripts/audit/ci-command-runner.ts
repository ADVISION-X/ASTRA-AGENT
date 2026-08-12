import { spawn } from "node:child_process";

import type { CommandStep } from "./ci-full-phase-plan.js";
import type { StepResult } from "./ci-full-summary.js";
import { repoRoot } from "./shared/paths.js";

type CommandOutcome = {
  cleanupVerified?: boolean;
  exitCode: number;
  timedOut: boolean;
  error?: string;
};

const delay = (durationMs: number): Promise<void> =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, durationMs));

const terminateProcessGroup = (pid: number | undefined, signal: NodeJS.Signals): void => {
  if (pid === undefined) return;
  try {
    if (process.platform === "win32") process.kill(pid, signal);
    else process.kill(-pid, signal);
  } catch {
    // The process may already have reached a terminal state.
  }
};

const processGroupIsAlive = (pid: number | undefined): boolean => {
  if (pid === undefined) return false;
  try {
    process.kill(process.platform === "win32" ? pid : -pid, 0);
    return true;
  } catch {
    return false;
  }
};

const waitForProcessGroupTermination = async (pid: number | undefined): Promise<boolean> => {
  const deadlineMs = Date.now() + 5_000;
  while (processGroupIsAlive(pid) && Date.now() < deadlineMs) await delay(50);
  return !processGroupIsAlive(pid);
};

const executeBoundedCommand = (
  command: readonly [string, ...string[]],
  timeoutMs: number,
): Promise<CommandOutcome> => new Promise((resolvePromise) => {
  let settled = false;
  let timedOut = false;
  let leaderExitCode: number | null = null;
  const [executable, ...args] = command;
  const child = spawn(executable, args, {
    cwd: repoRoot,
    stdio: "inherit",
    detached: process.platform !== "win32",
  });
  const deadline = setTimeout(() => {
    timedOut = true;
    void (async () => {
      terminateProcessGroup(child.pid, "SIGTERM");
      await delay(2_000);
      terminateProcessGroup(child.pid, "SIGKILL");
      const terminated = await waitForProcessGroupTermination(child.pid);
      finish({
        cleanupVerified: terminated,
        exitCode: leaderExitCode ?? 1,
        timedOut: true,
        ...(terminated ? {} : { error: "process group did not reach a verified terminal state after SIGKILL" }),
      });
    })();
  }, timeoutMs);
  const finish = (outcome: CommandOutcome): void => {
    if (settled) return;
    settled = true;
    clearTimeout(deadline);
    resolvePromise(outcome);
  };
  child.once("error", (error) => finish({ exitCode: 1, timedOut, error: error.message }));
  child.once("exit", (code) => {
    leaderExitCode = code ?? 1;
    if (!timedOut) finish({ exitCode: leaderExitCode, timedOut: false });
  });
});

export const runBoundedCommand = async (phase: string, stepSpec: CommandStep): Promise<StepResult> => {
  const [name, command, , lawId, , ownerId, timeoutMs] = stepSpec;
  const startedAtMs = Date.now();
  process.stdout.write(`[CI-FULL][RUN] ${name}\n`);
  const outcome = await executeBoundedCommand(command, timeoutMs);
  const endedAtMs = Date.now();
  const passed = outcome.exitCode === 0 && !outcome.timedOut;
  if (passed) process.stdout.write(`[CI-FULL][PASS] ${name}\n`);
  return {
    command: command.join(" "),
    durationMs: Math.max(0, endedAtMs - startedAtMs),
    endedAt: new Date(endedAtMs).toISOString(),
    error: passed
      ? undefined
      : outcome.timedOut
        ? outcome.cleanupVerified
          ? `${name} exceeded its ${timeoutMs}ms hard deadline; process-group termination was verified.`
          : `${name} exceeded its ${timeoutMs}ms hard deadline; cleanup failed closed: ${outcome.error ?? "process-group terminal state was not verified"}.`
        : outcome.error ?? `${name} failed with exit code ${outcome.exitCode}`,
    lawId,
    name,
    ownerId,
    phase,
    startedAt: new Date(startedAtMs).toISOString(),
    status: passed ? "PASS" : "FAIL",
    timeoutMs,
  };
};
