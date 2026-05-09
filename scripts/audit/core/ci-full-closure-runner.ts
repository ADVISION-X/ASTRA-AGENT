import { spawn } from "node:child_process";

export const runCiFullClosure = async (runId: string): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "scripts/audit/ci-full-closure.ts"],
      {
        env: {
          ...process.env,
          GRASSEYE_CI_FULL_CLOSURE: "1",
          GRASSEYE_CI_FULL_RUN_ID: runId,
        },
        shell: process.platform === "win32",
        stdio: "inherit",
      },
    );

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`[CI FULL CLOSURE FAIL] closure validation failed${signal ? ` by ${signal}` : ""} with exit code ${code ?? 1}.`));
    });
  });
};