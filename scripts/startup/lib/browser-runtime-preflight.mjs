import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

import { verifyBrowserArtifactSet } from "../../../src/lib/browser/release/verify-browser-artifact.mjs";

const outputLimit = 16 * 1024;

const boundedAppend = (current, chunk) => {
  if (current.length >= outputLimit) return current;
  return `${current}${String(chunk)}`.slice(0, outputLimit);
};

const errorCodeFromOutput = (output) =>
  String(output).match(/\b(BROWSER_[A-Z0-9_]+|BROWSERCTL_[A-Z0-9_]+)\b/)?.[1]
  ?? "BROWSER_RUNTIME_VERIFY_FAILED";

const blocked = (code, actionableMessage, extra = {}) => ({
  status: "BLOCKED",
  code,
  actionableMessage,
  ...extra,
});

const runBrowserctlVerify = (browserctlPath, rootDir, env) => new Promise((resolve) => {
  const child = spawn(browserctlPath, ["--doctor", "--read-only"], {
    cwd: rootDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";

  child.stdout?.on("data", (chunk) => {
    stdout = boundedAppend(stdout, chunk);
  });
  child.stderr?.on("data", (chunk) => {
    stderr = boundedAppend(stderr, chunk);
  });
  child.once("error", (error) => {
    resolve(blocked(
      "BROWSER_RUNTIME_VERIFY_FAILED",
      "Run the explicit browserctl verify/doctor path and repair the installed Browser Runtime before restarting.",
      { detail: error.message },
    ));
  });
  child.once("close", (exitCode) => {
    if (exitCode === 0) {
      resolve({ status: "READY", browserctlOutput: stdout.trim().slice(0, outputLimit) });
      return;
    }
    resolve(blocked(
      errorCodeFromOutput(`${stdout}\n${stderr}`),
      "Run the explicit browserctl verify/doctor path and repair the installed Browser Runtime before restarting.",
    ));
  });
});

export const resolveBrowserRuntimeArtifactRoot = (rootDir, platform = process.platform, architecture = process.arch) =>
  path.join(rootDir, "artifacts", "browser-runtime", `${platform}-${architecture}`);

export async function runBrowserRuntimePreflight({ rootDir, env = process.env }) {
  const artifactRoot = resolveBrowserRuntimeArtifactRoot(rootDir);
  const artifactManifestPath = path.join(artifactRoot, "browser-artifact-set.json");
  const artifactSignaturePath = path.join(artifactRoot, "browser-artifact-set.sig");
  if (!existsSync(artifactRoot) || !existsSync(artifactManifestPath) || !existsSync(artifactSignaturePath)) {
    return blocked(
      "BROWSERCTL_PREBUILT_BINARY_REQUIRED",
      "Provide the signed prebuilt Browser Runtime for this platform; the startup path never compiles or installs the Native Host.",
    );
  }

  let verifiedArtifact;
  try {
    verifiedArtifact = await verifyBrowserArtifactSet(artifactRoot);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return blocked(
      errorCodeFromOutput(reason),
      "Verify the signed Browser Runtime artifact set and its release tuple before restarting.",
    );
  }

  const browserctlResult = await runBrowserctlVerify(verifiedArtifact.browserctlPath, rootDir, env);
  if (browserctlResult.status !== "READY") return browserctlResult;
  return {
    status: "READY",
    artifactRoot,
    browserctlPath: verifiedArtifact.browserctlPath,
  };
}
