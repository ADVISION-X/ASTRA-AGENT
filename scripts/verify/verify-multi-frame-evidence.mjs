import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const ignoredDirs = new Set([".git", "dist", "node_modules", ".grasseye-data", ".grasseye-local", ".grasseye-demo-data"]);

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
      if (ignoredDirs.has(entry.name)) {
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
  const [law, browseBlueprint, packetBlueprint, multiFrameTypes, visionTypes, resultHelper, packageJson, repoFiles] = await Promise.all([
    requireFile(".github/instructions/cursor-rules/modules/module-multi-frame-evidence.instructions.md"),
    requireFile("docs/法案辅助文件/GrassEye Agent 浏览决策树与AI询问契约施工图.md"),
    requireFile("docs/法案辅助文件/GrassEye Agent 取证表单与高级AI投喂契约施工图.md"),
    requireFile("src/types/multi-frame-evidence.ts"),
    requireFile("src/types/vision-product-presence.ts"),
    requireFile("src/lib/local-ai/vision-task-result.ts"),
    requireFile("package.json"),
    listRepoFiles(repoRoot),
  ]);

  assert(law.includes("Law GRASSEYE-MULTI-FRAME-EVIDENCE-001-V1"), "multi-frame-evidence law must exist");
  assert(law.includes("Default sample times are 3s, 6s, and 10s after video stability."), "law must define governed default sample times");
  assert(law.includes("contact sheet or governed multi-image input"), "law must require contact sheet or governed multi-image input");
  assert(law.includes("Single opening screenshot as the default product-presence input."), "law must forbid single opening screenshot as default input");

  assert(browseBlueprint.includes("CREATE_MULTI_FRAME_EVIDENCE_SET"), "browse-flow blueprint must define CREATE_MULTI_FRAME_EVIDENCE_SET");
  assert(browseBlueprint.includes("ASK_AI_PRODUCT_PRESENCE_MULTI_FRAME"), "browse-flow blueprint must define ASK_AI_PRODUCT_PRESENCE_MULTI_FRAME");
  assert(browseBlueprint.includes("3-panel contact sheet"), "browse-flow blueprint must define 3-panel contact sheet");
  assert(browseBlueprint.includes("validFrameCount"), "browse-flow blueprint must define validFrameCount");
  assert(browseBlueprint.includes("single_frame_fallback"), "browse-flow blueprint must define single_frame_fallback");

  assert(packetBlueprint.includes("contactSheetEvidenceId"), "evidence-packet blueprint must include contactSheetEvidenceId");
  assert(packetBlueprint.includes("validFrameCount"), "evidence-packet blueprint must include validFrameCount");
  assert(packetBlueprint.includes("3-panel contact sheet"), "evidence-packet blueprint must mention contact sheet preference");

  for (const marker of [
    "MultiFrameVideoEvidenceSetSchema",
    "ProductPresenceMultiFrameAIInputSchema",
    "fixed_3_6_10",
    "adaptive_short_video",
    "single_frame_fallback",
    "multi_frame_contact_sheet",
    "multi_image",
  ]) {
    assert(multiFrameTypes.includes(marker), `multi-frame types must include ${marker}`);
  }

  for (const marker of [
    "inputMode",
    "multiFrameEvidenceSetId",
    "contactSheetEvidenceId",
    "sampledFrameCount",
    "validFrameCount",
    "frameLevelObservations",
    "aggregateReason",
  ]) {
    assert(visionTypes.includes(marker), `vision product-presence types must include ${marker}`);
  }

  for (const marker of [
    "inputMode: request.input.inputMode",
    "multiFrameEvidenceSetId: request.input.multiFrameEvidenceSetId",
    "contactSheetEvidenceId: request.input.contactSheetEvidenceId",
    "sampledFrameCount: request.input.sampledFrameCount",
    "validFrameCount: request.input.validFrameCount",
    "aggregateReason: input.aggregateReason",
    "frameLevelObservations: input.frameLevelObservations",
  ]) {
    assert(resultHelper.includes(marker), `vision task result helper must emit ${marker}`);
  }

  const packageJsonText = packageJson;
  assert(packageJsonText.includes('"verify:multi-frame-evidence"'), "package.json must expose verify:multi-frame-evidence");
  assert(packageJsonText.includes("verify:multi-frame-evidence &&"), "phase or ci chain must invoke verify:multi-frame-evidence");

  const forbiddenTests = repoFiles.filter((file) => /(^|\/)(tests|__tests__)\/|\.test\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file));
  assert(forbiddenTests.length === 0, `multi-frame verification forbids repository test artifacts: ${forbiddenTests.join(", ")}`);

  process.stdout.write("verify-multi-frame-evidence: PASS\n");
}

await main();
