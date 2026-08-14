import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const scenarioRunner = path.join(scriptDirectory, "local-browser-real-chrome-scenarios.acceptance.ts");
const scenarios = Array.from({ length: 10 }, (_, index) => `ACC-023B-${String(index + 1).padStart(2, "0")}`);

const runScenario = (scenario: string): Promise<{ scenario: string; exitCode: number; output: string }> =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, ["--import", "tsx", scenarioRunner, "--scenario", scenario], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += String(chunk); });
    child.stderr.on("data", (chunk) => { output += String(chunk); });
    child.once("close", (exitCode) => resolve({ scenario, exitCode: exitCode ?? 1, output: output.trim() }));
  });

const results = [];
for (const scenario of scenarios) results.push(await runScenario(scenario));
const failed = results.filter((result) => result.exitCode !== 0);
const receipt = {
  status: failed.length === 0 ? "CHROME_VERIFIED" : "NOT_PRODUCTION_VERIFIED",
  candidateId: process.env.GRASSEYE_CANDIDATE_ID?.trim() || "working-tree",
  results,
};
process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
if (failed.length > 0) process.exitCode = 1;
