import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const transpile = (source, fileName) => {
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      strict: true,
    },
    fileName,
    reportDiagnostics: true,
  });
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  if (errors.length > 0) {
    throw new Error(
      `extension TypeScript transpile failed: ${errors.map((item) => item.messageText).join("; ")}`,
    );
  }
  return result.outputText;
};

const resolveServiceWorkerSource = (serviceWorkerSource) => {
  const resolved = path.resolve(serviceWorkerSource ?? path.join(sourceDir, "service-worker.ts"));
  if (resolved !== path.join(sourceDir, "service-worker.ts")) {
    throw new Error("BROWSER_EXTENSION_SERVICE_WORKER_SOURCE_INVALID");
  }
  return resolved;
};

const writeTranspiled = async (distDir, sourcePath, outputName, replacement) => {
  const source = await readFile(sourcePath, "utf8");
  await writeFile(
    path.join(distDir, outputName),
    transpile(replacement(source), sourcePath),
    { mode: 0o600 },
  );
};

const writeProtocolArtifacts = async (distDir) => {
  const canonicalProtocolPath = path.join(
    sourceDir,
    "..",
    "protocol",
    "generated",
    "browser-protocol.ts",
  );
  await writeTranspiled(
    distDir,
    canonicalProtocolPath,
    "protocol.js",
    (source) => source,
  );

  for (const name of [
    "browser-protocol-capability-map",
    "browser-protocol-message-validator",
  ]) {
    const protocolSource = path.join(
      sourceDir,
      "..",
      "protocol",
      "generated",
      `${name}.ts`,
    );
    await writeTranspiled(
      distDir,
      protocolSource,
      `${name}.js`,
      (source) => source.replaceAll("./browser-protocol.js", "./protocol.js"),
    );
  }
};

const writeServiceWorkerArtifacts = async (distDir, serviceWorkerSource) => {
  for (const name of [
    "service-worker-contracts",
    "service-worker-origin-policy",
    "service-worker-click-command",
    "service-worker-session-crypto",
    "service-worker-command-execution",
    "atomic-dom-command",
    "service-worker-interaction-commands",
    "service-worker-keyboard",
    "service-worker-native-transport",
  ]) {
    await writeTranspiled(
      distDir,
      path.join(sourceDir, `${name}.ts`),
      `${name}.js`,
      (source) => source.replaceAll(
        "../protocol/generated/browser-protocol.js",
        "./protocol.js",
      ),
    );
  }
  await writeTranspiled(
    distDir,
    serviceWorkerSource,
    "service-worker.js",
    (source) => source.replaceAll(
      "../protocol/generated/browser-protocol.js",
      "./protocol.js",
    ),
  );
};

const writeExtensionManifest = async (distDir) => {
  const extensionArtifactDigest = process.env.GRASSEYE_BROWSER_EXTENSION_ARTIFACT_DIGEST?.trim();
  const supportedActivationTupleIds = process.env.GRASSEYE_BROWSER_SUPPORTED_ACTIVATION_TUPLE_IDS?.trim();
  if (!/^sha256:[0-9a-f]{64}$/u.test(extensionArtifactDigest ?? "")) {
    throw new Error("BROWSER_EXTENSION_ARTIFACT_IDENTITY_REQUIRED");
  }
  let tupleIds;
  try {
    tupleIds = JSON.parse(supportedActivationTupleIds ?? "");
  } catch {
    throw new Error("BROWSER_EXTENSION_ACTIVATION_TUPLES_REQUIRED");
  }
  if (!Array.isArray(tupleIds) || tupleIds.length === 0 || !tupleIds.every((item) => typeof item === "string" && item.length > 0)) {
    throw new Error("BROWSER_EXTENSION_ACTIVATION_TUPLES_REQUIRED");
  }
  const manifest = JSON.parse(
    await readFile(path.join(sourceDir, "manifest.json"), "utf8"),
  );
  manifest["x-grasseye-extension-artifact-digest"] = extensionArtifactDigest;
  manifest["x-grasseye-supported-activation-tuples"] = tupleIds;
  await writeFile(
    path.join(distDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { mode: 0o600 },
  );
};

export const buildChromeExtension = async ({ serviceWorkerSource } = {}) => {
  const distDir = path.join(sourceDir, "dist");
  const resolvedServiceWorkerSource = resolveServiceWorkerSource(serviceWorkerSource);
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
  await writeProtocolArtifacts(distDir);
  await writeServiceWorkerArtifacts(distDir, resolvedServiceWorkerSource);
  await writeExtensionManifest(distDir);
  return { distDir };
};

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  const sourceFlagIndex = process.argv.indexOf("--service-worker-source");
  await buildChromeExtension({
    serviceWorkerSource: sourceFlagIndex >= 0 ? process.argv[sourceFlagIndex + 1] : undefined,
  });
  process.stdout.write(JSON.stringify({ status: "PASS", distDir: path.join(sourceDir, "dist") }) + "\n");
}
