import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ASTRA_DATA_DIRECTORY } from "../browser/profile/browser-application-identity.js";

function productionRepository(): string {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  const sourceRoot = path.resolve(moduleDirectory, "../../..");
  const root = path.basename(sourceRoot) === "dist" ? path.dirname(sourceRoot) : sourceRoot;
  if (moduleDirectory !== path.join(sourceRoot, "src", "lib", "local-runtime")
    || realpathSync(root) !== root || realpathSync(process.cwd()) !== root) {
    throw new Error("ASTRA_REPOSITORY_MISMATCH");
  }
  const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as { name?: unknown };
  if (packageJson.name !== "astra-agent-local-workbench") throw new Error("ASTRA_REPOSITORY_MISMATCH");
  return root;
}

function assertLocalPath(filePath: string, kind: "directory" | "file"): void {
  try {
    const stat = lstatSync(filePath);
    const expected = kind === "directory" ? stat.isDirectory() : stat.isFile() && stat.nlink === 1;
    if (!expected) throw new Error("ASTRA_DATA_PATH_INVALID");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export function resolveProductionLocalDataDir(requested = process.env.GRASSEYE_DATA_DIR): string {
  const dataDir = path.join(productionRepository(), ASTRA_DATA_DIRECTORY);
  if (requested && path.resolve(requested) !== dataDir) throw new Error("ASTRA_DATA_DIRECTORY_MISMATCH");

  const browser = path.join(dataDir, "browser");
  const build = path.join(dataDir, "browser-build");
  const release = path.join(dataDir, "browser-release");
  for (const directory of [dataDir, browser, build, path.join(build, "extension"), release]) {
    assertLocalPath(directory, "directory");
  }
  assertLocalPath(path.join(release, "release-record.json"), "file");
  for (const database of [path.join(dataDir, "production-runtime.sqlite"), path.join(browser, "browser-mutations.sqlite")]) {
    for (const suffix of ["", "-wal", "-shm"]) assertLocalPath(database + suffix, "file");
  }
  return dataDir;
}
