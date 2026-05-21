import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const generatedDir = resolve(repoRoot, "scripts/audit/generated");

type Violation = {
  file: string;
  reason: string;
};

const sourceRoots = ["package.json", "scripts", "src"] as const;

const retiredPathFragments = [
  "src/capabilities/nerve-bus",
  "src/capabilities/orchestration",
  "src/capabilities/geometry-guard",
  "src/capabilities/mouse-click",
  "src/capabilities/mouse-scroll",
  "src/capabilities/text-input",
  "src/capabilities/open",
  "src/capabilities/screenshot",
  "src/capabilities/video-download",
  "src/capabilities/ai/",
  "src/visual-mission",
  "src/plugins/product-video-dom-runtime",
] as const;

const retiredScriptFragments = [
  "audit:build",
  "audit:code-purity",
  "audit:runtime-logging",
  "audit:quality-kernel",
  "audit:audit-system",
  "audit:pure-visual-round",
  "audit:dom-automation",
  "acceptance:product-video",
  "acceptance:ai-input-gateway-web-chat-fixture-smoke",
] as const;

const aiPlannerFragments = ["nextAction", "actionPlan"] as const;

const walkFiles = (root: string): string[] => {
  const absolute = resolve(repoRoot, root);
  if (!existsSync(absolute)) return [];
  const stat = statSync(absolute);
  if (stat.isFile()) return [absolute];
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = resolve(absolute, entry.name);
    if (entry.isDirectory()) return walkFiles(relative(repoRoot, child));
    return entry.isFile() ? [child] : [];
  });
};

const readText = (file: string): string => readFileSync(file, "utf8");

const isTextFile = (file: string): boolean =>
  /\.(ts|tsx|js|jsx|mjs|json|md)$/u.test(file) || file.endsWith("package.json");

const runCommand = async (
  name: string,
  command: readonly [string, ...string[]],
): Promise<void> => {
  process.stdout.write(`[CI-FULL][RUN] ${name}\n`);
  const [executable, ...args] = command;
  const exitCode = await new Promise<number>((resolvePromise, rejectPromise) => {
    const child = spawn(executable, args, {
      cwd: repoRoot,
      stdio: "inherit",
    });
    child.once("error", rejectPromise);
    child.once("exit", (code) => resolvePromise(code ?? 1));
  });
  if (exitCode !== 0) {
    throw new Error(`${name} failed with exit code ${exitCode}`);
  }
  process.stdout.write(`[CI-FULL][PASS] ${name}\n`);
};

const checkForbiddenFiles = (): Violation[] => {
  const violations: Violation[] = [];
  for (const fragment of retiredPathFragments) {
    const absolute = resolve(repoRoot, fragment);
    if (existsSync(absolute)) {
      violations.push({
        file: fragment,
        reason: "Retired architecture path still exists.",
      });
    }
  }
  return violations;
};

const checkForbiddenReferences = (): Violation[] => {
  const violations: Violation[] = [];
  const files = sourceRoots.flatMap(walkFiles).filter(isTextFile);
  for (const file of files) {
    const repoPath = relative(repoRoot, file);
    const text = readText(file);
    if (repoPath === "MIGRATION_FILE_DECISION_TABLE.md") continue;
    if (repoPath === "scripts/audit/ci-full.ts") continue;
    for (const fragment of retiredPathFragments) {
      if (text.includes(fragment)) {
        violations.push({
          file: repoPath,
          reason: `Active file references retired path fragment: ${fragment}`,
        });
      }
    }
    if (repoPath === "package.json") {
      for (const fragment of retiredScriptFragments) {
        if (text.includes(fragment)) {
          violations.push({
            file: repoPath,
            reason: `package.json still exposes retired script fragment: ${fragment}`,
          });
        }
      }
    }
    if (repoPath.endsWith("local-workbench-plugin-tasks.ts") && text.includes("ProductVideo")) {
      violations.push({
        file: repoPath,
        reason: "Local workbench plugin tasks still export product-video task surfaces.",
      });
    }
    if (repoPath.includes("ai-input-gateway") || repoPath.includes("src/plugins/")) {
      for (const fragment of aiPlannerFragments) {
        if (text.includes(fragment)) {
          violations.push({
            file: repoPath,
            reason: `AI choice judge surface still contains planner fragment: ${fragment}`,
          });
        }
      }
    }
  }
  return violations;
};

const runArchitectureCheck = (): void => {
  const violations = [...checkForbiddenFiles(), ...checkForbiddenReferences()];
  mkdirSync(generatedDir, { recursive: true });
  writeFileSync(
    resolve(generatedDir, "simple-architecture-summary.generated.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        status: violations.length === 0 ? "PASS" : "FAIL",
        violations,
      },
      null,
      2,
    )}\n`,
  );
  if (violations.length > 0) {
    process.stdout.write("[CI-FULL] FAIL — simple architecture guard blocked retired surface resurrection.\n");
    for (const violation of violations) {
      process.stdout.write(`- ${violation.file}: ${violation.reason}\n`);
    }
    throw new Error("architecture-check failed");
  }
  process.stdout.write("[CI-FULL][PASS] architecture-check\n");
};

const main = async (): Promise<void> => {
  await runCommand("typecheck", ["npm", "run", "typecheck"]);
  runArchitectureCheck();
  await runCommand("amazon-invoice-upload-smoke", ["npm", "run", "acceptance:amazon-invoice-upload-smoke"]);
  process.stdout.write("[CI-FULL] PASS — typecheck, architecture, and Amazon smoke passed.\n");
};

await main();
