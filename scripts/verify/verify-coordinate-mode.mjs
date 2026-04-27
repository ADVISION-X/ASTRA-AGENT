import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

async function requireFile(relativePath) {
  const absolutePath = path.join(repoRoot, ...relativePath.split("/"));
  const content = await readFile(absolutePath, "utf8");
  return { relativePath, content };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const files = await Promise.all([
    requireFile("src/features/platform-action/coordinate-action-policy.ts"),
    requireFile("src/features/platform-action/screen-geometry-guard.ts"),
    requireFile("src/features/platform-action/visual-target.ts"),
    requireFile("src/features/platform-action/adapters/vision-coordinate-platform-adapter.ts"),
    requireFile("src/lib/browser/screen-capture-controller.ts"),
    requireFile("src/lib/browser/os-input-controller.ts"),
    requireFile("package.json"),
  ]);

  const joined = files.map((file) => file.content).join("\n").toLowerCase();
  const forbiddenKeywords = [
    "stealth",
    "anti-detect",
    "fingerprint spoof",
    "captcha bypass",
    "proxy pool",
    "account pool",
    "cookie export",
    "session export",
  ];

  for (const keyword of forbiddenKeywords) {
    assert(!joined.includes(keyword), `forbidden keyword found in coordinate mode sources: ${keyword}`);
  }

  const packageJson = JSON.parse(files.find((file) => file.relativePath === "package.json").content);
  assert(Boolean(packageJson.scripts?.launch), "package.json must expose launch script");
  assert(Boolean(packageJson.scripts?.["verify:coordinate"]), "package.json must expose verify:coordinate script");

  process.stdout.write("verify-coordinate: PASS\n");
}

await main();