import { spawn } from "node:child_process";
import { repoRoot } from "../../core/path-roots.js";
import type { ClauseCheckOutcome } from "./dom-automation-binary-types.js";

export const pass = (evidence: string): ClauseCheckOutcome => ({ status: "PASS", evidence });
export const fail = (evidence: string, failureReason: string): ClauseCheckOutcome => ({ status: "FAIL", evidence, failureReason });

export const runCommand = async (command: readonly [string, ...string[]]): Promise<ClauseCheckOutcome> => {
  const [executable, ...args] = command;
  const child = spawn(executable, args, { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  const append = (chunk: Buffer): void => {
    const text = chunk.toString();
    output = `${output}${text}`.slice(-24000);
    process.stdout.write(text);
  };
  child.stdout.on("data", append);
  child.stderr.on("data", append);
  return await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      const lastLines = output.trim().split(/\r?\n/u).slice(-12).join(" | ");
      if (code === 0) {
        resolve(pass(`command passed: ${command.join(" ")} :: ${lastLines || "no output"}`));
        return;
      }
      resolve(fail(`command failed: ${command.join(" ")}`, lastLines || `exit code ${code ?? "unknown"}`));
    });
  });
};
