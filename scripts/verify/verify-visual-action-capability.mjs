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
      if (["node_modules", "dist", ".git", ".grasseye-data", ".grasseye-demo-data", ".grasseye-local"].includes(entry.name)) {
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
  const [law, blueprint, typesFile, visualTargetFile, policyFile, adapterFile, agentService, packageJson, repoFiles] = await Promise.all([
    requireFile(".github/instructions/cursor-rules/modules/module-visual-action-capability.instructions.md"),
    requireFile("docs/法案辅助文件/GrassEye 视觉目标与坐标动作能力施工图.md"),
    requireFile("src/types/visual-action.ts"),
    requireFile("src/features/platform-action/visual-target.ts"),
    requireFile("src/features/platform-action/coordinate-action-policy.ts"),
    requireFile("src/features/platform-action/adapters/tiktok-platform-adapter.ts"),
    requireFile("src/features/agent/agent-service.ts"),
    requireFile("package.json"),
    listRepoFiles(repoRoot),
  ]);

  assert(law.includes("Law GRASSEYE-VISUAL-ACTION-CAPABILITY-001-V1"), "visual-action-capability law must exist");
  assert(
    law.includes("Visual target failure must not silently fallback to DOM.") &&
      law.includes("Hidden or explicit DOM fallback after visual failure."),
    "visual-action-capability law must forbid hidden DOM primary path",
  );
  assert(law.includes("Coordinate clicks without boundingBox."), "visual-action-capability law must forbid bounding-box-free clicks");

  assert(blueprint.includes("Visual Target Catalog"), "visual-action blueprint must define the target catalog");
  assert(blueprint.includes("comments_button"), "visual-action blueprint must include comments_button target");
  assert(blueprint.includes("next_video_region"), "visual-action blueprint must include next_video_region target");
  assert(blueprint.includes("Coordinate Action Guard"), "visual-action blueprint must define guard rules");
  assert(blueprint.includes("Post-action Verification"), "visual-action blueprint must define post-action verification");

  assert(typesFile.includes("VisualTargetTypeSchema"), "visual-action types must define VisualTargetType");
  assert(typesFile.includes("VisualTargetSchema"), "visual-action types must define VisualTarget");
  assert(typesFile.includes("VisualActionResultSchema"), "visual-action types must define VisualActionResult");
  assert(typesFile.includes("verificationResult"), "visual-action types must require verificationResult");
  assert(typesFile.includes("sourceScreenshotEvidenceId"), "visual-action types must require sourceScreenshotEvidenceId");
  assert(typesFile.includes("boundingBox"), "visual-action types must require boundingBox");
  assert(typesFile.includes("clickPoint"), "visual-action types must require clickPoint");
  assert(!typesFile.includes(" as any"), "visual-action types must not use as any");

  for (const targetName of [
    "video_area",
    "current_video_content",
    "like_button",
    "save_button",
    "comments_button",
    "comments_panel",
    "close_comments_button",
    "not_interested_button",
    "next_video_region",
    "scroll_area",
    "login_wall",
    "captcha_challenge",
    "safety_page",
    "unknown_ui",
    "metric_like_count",
    "metric_comment_count",
    "metric_share_count",
    "metric_save_count",
  ]) {
    assert(typesFile.includes(`"${targetName}"`), `visual-action target catalog is missing ${targetName}`);
  }

  assert(visualTargetFile.includes("sourceScreenshotEvidenceId"), "visual-target helper must use sourceScreenshotEvidenceId");
  assert(visualTargetFile.includes("clickPoint"), "visual-target helper must expose clickPoint");
  assert(policyFile.includes("isBoundingBoxInsideScreenshot"), "coordinate policy must verify boundingBox inside screenshot");
  assert(policyFile.includes("isPointInsideBoundingBox"), "coordinate policy must verify clickPoint inside boundingBox");
  assert(policyFile.includes("minimumConfidence"), "coordinate policy must keep confidence threshold checks");
  assert(adapterFile.includes("verificationExpectation"), "real adapter must define post-action verification expectations");
  assert(adapterFile.includes("visual-only runtime forbids DOM fallback"), "real adapter must explicitly reject DOM fallback after visual failure");
  assert(!adapterFile.includes("operator-approved dom fallback"), "real adapter must not keep operator-approved dom fallback markers in visual-only runtime");
  assert(adapterFile.includes("visualActionResult"), "real adapter must produce visualActionResult payloads");

  assert(!agentService.includes("screenX"), "AgentRuntime must not own raw coordinate details");
  assert(!agentService.includes("screenY"), "AgentRuntime must not own raw coordinate details");
  assert(!agentService.includes("selector"), "AgentRuntime must not own selector recipes");

  const packageJsonText = packageJson;
  assert(packageJsonText.includes('"verify:visual-action-capability"'), "package.json must expose verify:visual-action-capability");
  assert(packageJsonText.includes("verify:visual-action-capability &&"), "phase or ci chain must invoke verify:visual-action-capability");

  const forbiddenTests = repoFiles.filter((file) => /(^|\/)(tests|__tests__)\/|\.test\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file));
  assert(forbiddenTests.length === 0, `visual-action verification forbids repository test artifacts: ${forbiddenTests.join(", ")}`);

  process.stdout.write("verify-visual-action-capability: PASS\n");
}

await main();