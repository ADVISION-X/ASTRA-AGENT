import { once } from "node:events";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";

export class BrowserOwnerLock {
  private constructor(
    private readonly helper: ChildProcessWithoutNullStreams,
    readonly lockPath: string,
  ) {}

  static async acquire(input: {
    helperPath: string;
    lockPath: string;
    timeoutMs?: number;
  }): Promise<BrowserOwnerLock> {
    const helper = spawn(input.helperPath, ["hold-owner-lock", input.lockPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stderr: string[] = [];
    helper.stderr.setEncoding("utf8");
    helper.stderr.on("data", (chunk: string) => stderr.push(chunk));
    const lines = createInterface({ input: helper.stdout });
    const timeoutMs = input.timeoutMs ?? 2_000;
    const timeout = setTimeout(() => helper.kill("SIGKILL"), timeoutMs);
    try {
      const line = await Promise.race([
        once(lines, "line").then(([value]) => String(value)),
        once(helper, "exit").then(() => {
          throw new Error(stderr.join("") || "BROWSER_CONTROLLER_ALREADY_OWNED");
        }),
      ]);
      const ack = JSON.parse(line) as { status?: unknown };
      if (ack.status !== "LOCKED") {
        helper.kill("SIGKILL");
        throw new Error("BROWSER_CONTROLLER_ALREADY_OWNED");
      }
      return new BrowserOwnerLock(helper, input.lockPath);
    } finally {
      clearTimeout(timeout);
      lines.close();
    }
  }

  isAlive(): boolean {
    return this.helper.exitCode === null && !this.helper.killed;
  }

  async release(): Promise<void> {
    if (this.helper.exitCode !== null) return;
    this.helper.stdin.end();
    await Promise.race([
      once(this.helper, "exit").then(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, 1_000)),
    ]);
    if (this.helper.exitCode === null) this.helper.kill("SIGKILL");
  }
}
