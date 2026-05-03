import path from "node:path";

import { readJsonFile } from "./json-utils.mjs";
import { getRepoRoot } from "./path-policy.mjs";

export async function readPackageScripts() {
  const packageJsonPath = path.join(getRepoRoot(), "package.json");
  const packageJson = await readJsonFile(packageJsonPath);
  return packageJson.scripts ?? {};
}

export async function resolvePackageScript(scriptName) {
  const scripts = await readPackageScripts();
  return typeof scripts[scriptName] === "string" ? scripts[scriptName] : null;
}

export async function hasPackageScript(scriptName) {
  return (await resolvePackageScript(scriptName)) !== null;
}