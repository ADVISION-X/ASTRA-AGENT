import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

type CommandSpec = {
  name: string;
  command: string;
  args: string[];
};

type CommandResult = {
  name: string;
  command: string;
  exitCode: number;
  durationMs: number;
};

const OUT_DIR = path.join(process.cwd(), "tmp", "audit", "ability-law-census", "audit-runs");
const SUMMARY_PATH = path.join(OUT_DIR, "summary.json");
const COMMANDS: CommandSpec[] = [
  { name: "audit:build", command: "npm", args: ["run", "audit:build"] },
  { name: "audit:audit-system", command: "npm", args: ["run", "audit:audit-system"] },
  { name: "audit:capability-group-governance", command: "npm", args: ["run", "audit:capability-group-governance"] },
  { name: "audit:ai", command: "npm", args: ["run", "audit:ai"] },
  { name: "typecheck", command: "npm", args: ["run", "typecheck"] },
  { name: "lint", command: "npm", args: ["run", "lint"] },
  { name: "audit", command: "npm", args: ["run", "audit"] },
  { name: "ci:full", command: "npm", args: ["run", "ci:full"] },
  { name: "git-diff-check", command: "git", args: ["diff", "--check"] },
  { name: "audit:build-final", command: "npm", args: ["run", "audit:build"] },
];

const slugify = (name: string): string => name.replace(/[^a-z0-9.-]+/gi, "-");

const runCommand = async (spec: CommandSpec): Promise<CommandResult> => {
  const start = Date.now();
  const result = spawnSync(spec.command, spec.args, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const durationMs = Date.now() - start;
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  await writeFile(path.join(OUT_DIR, `${slugify(spec.name)}.txt`), output, "utf8");

  return {
    name: spec.name,
    command: [spec.command, ...spec.args].join(" "),
    exitCode: result.status ?? 1,
    durationMs,
  };
};

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  const results: CommandResult[] = [];

  for (const spec of COMMANDS) {
    const result = await runCommand(spec);
    results.push(result);
    await writeFile(SUMMARY_PATH, `${JSON.stringify(results, null, 2)}\n`, "utf8");
    process.stdout.write(`[STATIC-CLAUSE-COVERAGE-CMD] ${spec.name} exit=${result.exitCode} durationMs=${result.durationMs}\n`);
  }
}

void main();