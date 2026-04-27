import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

const requireFile = async (relativePath) => {
  const absolutePath = path.join(repoRoot, ...relativePath.split("/"));
  return readFile(absolutePath, "utf8");
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const collectRepoFiles = async (directoryPath, prefix = "") => {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (["node_modules", ".git", "dist", ".grasseye-local", ".grasseye-data", ".grasseye-demo-data"].includes(entry.name)) {
      continue;
    }

    const absolutePath = path.join(directoryPath, entry.name);
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...await collectRepoFiles(absolutePath, relativePath));
      continue;
    }

    files.push(relativePath);
  }

  return files;
};

async function main() {
  const [visualOnlyLaw, visualOnlyBlueprint, visualOnlyType, platformActionLaw, commentLaw, browseFlowLaw, packageJsonText] = await Promise.all([
    requireFile(".github/instructions/cursor-rules/modules/module-visual-only-runtime.instructions.md"),
    requireFile("docs/法案辅助文件/GrassEye 视觉唯一运行模式施工图.md"),
    requireFile("src/types/visual-only-runtime.ts"),
    requireFile(".github/instructions/cursor-rules/modules/module-platform-action.instructions.md"),
    requireFile(".github/instructions/cursor-rules/modules/module-comment-intelligence.instructions.md"),
    requireFile(".github/instructions/cursor-rules/modules/module-agent-browse-flow.instructions.md"),
    requireFile("package.json"),
  ]);
  const repoFiles = await collectRepoFiles(repoRoot);
  const packageJson = JSON.parse(packageJsonText);

  assert(visualOnlyLaw.includes("GRASSEYE-VISUAL-ONLY-RUNTIME-001-V1"), "module-visual-only-runtime.instructions.md must exist with active law");
  assert(visualOnlyBlueprint.includes("# GrassEye 视觉唯一运行模式施工图"), "GrassEye 视觉唯一运行模式施工图.md must exist");
  assert(visualOnlyType.includes("VisualOnlyRuntimePolicySchema"), "visual-only-runtime type must exist");
  assert(visualOnlyType.includes("domFallbackAllowed: z.literal(false)"), "domFallbackAllowed must be false");
  assert(visualOnlyType.includes("selectorActionAllowed: z.literal(false)"), "selectorActionAllowed must be false");
  assert(visualOnlyType.includes("commentDomExtractionAllowed: z.literal(false)"), "commentDomExtractionAllowed must be false");
  assert(visualOnlyType.includes("metricDomExtractionAllowed: z.literal(false)"), "metricDomExtractionAllowed must be false");

  assert(platformActionLaw.includes("selector or semantic execution is not a real-platform acceptance path"), "platform action law must ban DOM semantic fallback as production path");
  assert(commentLaw.includes("DOM comment scraping is forbidden."), "comment intelligence law must ban DOM comment scraping");
  assert(browseFlowLaw.includes("collect metrics, comment reading, button targeting, and next-video detection must be visual-only."), "browse flow law must ban DOM page understanding");

  assert(!repoFiles.some((file) => /(^|\/)(crawler|scraper|dom-reader|page-parser)(\/|$)/i.test(file)), "repo must not contain crawler / scraper / dom-reader / page-parser folders");
  assert(!repoFiles.some((file) => /(^|\/)(tests|__tests__)\/|\.test\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(file)), "repo must not contain tests / __tests__ / *.test.* files");

  assert(Boolean(packageJson.scripts?.["verify:visual-only-runtime"]), "package.json must expose verify:visual-only-runtime");
  assert(String(packageJson.scripts?.["verify:phase3"] ?? "").includes("verify:visual-only-runtime"), "verify:phase3 must include verify:visual-only-runtime");
  assert(String(packageJson.scripts?.["ci:full"] ?? "").includes("verify:visual-only-runtime"), "ci:full must include verify:visual-only-runtime");

  process.stdout.write("verify-visual-only-runtime: PASS\n");
}

await main();