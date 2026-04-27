import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function requireFile(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function listRepoFiles(rootDir, relativeDir = "") {
  const entries = await readdir(path.join(rootDir, relativeDir), { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const nextRelativePath = path.posix.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "dist", ".git", ".grasseye-data"].includes(entry.name)) {
        continue;
      }

      files.push(...await listRepoFiles(rootDir, nextRelativePath));
      continue;
    }

    files.push(nextRelativePath);
  }

  return files;
}

async function main() {
  const [law, blueprint, typesFile, packageJson, phaseTodo, phaseReport, repoFiles] = await Promise.all([
    requireFile(".github/instructions/cursor-rules/modules/module-structured-logging.instructions.md"),
    requireFile("docs/法案辅助文件/GrassEye 结构化日志与运行证明施工图.md"),
    requireFile("src/types/structured-log.ts"),
    requireFile("package.json"),
    requireFile("docs/TODO/phase-03-TODO.md"),
    requireFile("docs/验收报告/phase-03-acceptance-report.md"),
    listRepoFiles(repoRoot),
  ]);

  assert(law.includes("Law GRASSEYE-STRUCTURED-LOGGING-001-V1"), "structured-logging law must exist");
  assert(law.includes("console.log as runtime truth."), "structured-logging law must forbid console.log as runtime truth");
  assert(law.includes("Fake structured logs."), "structured-logging law must forbid fake structured logs");
  assert(law.includes("Claiming live PASS without structured log sequence proof."), "structured-logging law must require live proof sequence");

  assert(blueprint.includes("GrassEye 结构化日志与运行证明施工图"), "structured-logging blueprint must exist");
  assert(blueprint.includes("StructuredRuntimeEvent"), "blueprint must define StructuredRuntimeEvent");
  assert(blueprint.includes("StructuredActionLog"), "blueprint must define StructuredActionLog");
  assert(blueprint.includes("open_target_page_completed"), "blueprint must define required event types");
  assert(blueprint.includes("next_video_wait_started"), "blueprint must define live proof tail event");
  assert(blueprint.includes("fake PASS"), "blueprint must forbid fake PASS");
  assert(!blueprint.includes("console.log 成为运行真相"), "blueprint must not describe console.log as allowed runtime truth");

  assert(typesFile.includes("StructuredRuntimeEventSchema"), "structured-log types must define StructuredRuntimeEvent");
  assert(typesFile.includes("StructuredActionLogSchema"), "structured-log types must define StructuredActionLog");
  assert(typesFile.includes("actionPurpose"), "structured-log types must require actionPurpose");
  assert(typesFile.includes("failureReason"), "structured-log types must require failureReason field");
  assert(typesFile.includes("reviewRequiredReason"), "structured-log types must require reviewRequiredReason field");
  assert(typesFile.includes("LiveProofLogSequence"), "structured-log types must define LiveProofLogSequence");
  assert(typesFile.includes("StructuredRuntimeEventTypeSchema"), "structured-log types must define event types");
  assert(typesFile.includes("open_target_page_completed"), "structured-log types must include required event types");
  assert(!typesFile.includes(" as any"), "structured-log types must not use as any");

  assert(packageJson.includes('"verify:structured-logging"'), "package.json must expose verify:structured-logging");
  assert(packageJson.includes("verify:structured-logging &&"), "phase or ci chain must invoke verify:structured-logging");

  assert(phaseTodo.includes("Structured Logging"), "phase-03 TODO must mention structured logging governance");
  assert(phaseReport.includes("Structured Logging law added"), "phase-03 acceptance report must mention structured logging law");
  assert(phaseReport.includes("verify:structured-logging"), "phase-03 acceptance report must mention verify:structured-logging result");
  assert(phaseReport.includes("runtime 还需要在后续代码建设中真实写入 structured logs"), "phase-03 acceptance report must keep the structured logging implementation gap explicit");

  const forbiddenTests = repoFiles.filter((file) => /(^|\/)(tests|__tests__)\/|\.test\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file));
  assert(forbiddenTests.length === 0, `structured-logging verification forbids repository test artifacts: ${forbiddenTests.join(", ")}`);

  process.stdout.write("verify-structured-logging: PASS\n");
}

await main();