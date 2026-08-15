#!/usr/bin/env node
import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const sourceDir = path.dirname(fileURLToPath(import.meta.url));
const browserDir = path.dirname(sourceDir);
const repoRoot = path.resolve(browserDir, "../../..");
const extensionDir = path.join(browserDir, "chrome-extension");
const sourceHostPath = path.join(sourceDir, "host.mjs");
const sourceControllerChannelPath = path.join(sourceDir, "controller-channel.mjs");
const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  if (process.argv[index] === "--data-dir") {
    const value = process.argv[index + 1];
    if (!value) throw new Error("--data-dir requires a path");
    args.set("--data-dir", value);
    index += 1;
  }
}
const uninstall = process.argv.includes("--uninstall");
const verify = process.argv.includes("--verify");
const dataDir = path.resolve(args.get("--data-dir") ?? path.join(repoRoot, ".grasseye-local"));
const appSupport = path.join(os.homedir(), "Library", "Application Support");
const grassEyeDir = path.join(appSupport, "GrassEye");
const installedHostDir = path.join(grassEyeDir, "native-messaging-host");
const installedHostPath = path.join(installedHostDir, "host.mjs");
const installedControllerChannelPath = path.join(installedHostDir, "controller-channel.mjs");
const chromeHostDir = path.join(appSupport, "Google", "Chrome", "NativeMessagingHosts");
const installedManifest = path.join(chromeHostDir, "com.grasseye.browser.json");
const connectionConfig = path.join(grassEyeDir, "browser-native-host.json");
const sourceExtensionManifest = JSON.parse(await readFile(path.join(extensionDir, "manifest.json"), "utf8"));
const extensionId = [...createHash("sha256")
  .update(Buffer.from(sourceExtensionManifest.key, "base64"))
  .digest()
  .subarray(0, 16)]
  .flatMap((byte) => [byte >> 4, byte & 15])
  .map((nibble) => String.fromCharCode("a".charCodeAt(0) + nibble))
  .join("");
const allowedOrigin = `chrome-extension://${extensionId}/`;

const renderInstalledHost = async () => {
  const source = await readFile(sourceHostPath, "utf8");
  const firstNewline = source.indexOf("\n");
  if (!source.startsWith("#!") || firstNewline < 0) {
    throw new Error("Native host source must begin with a shebang");
  }
  if (process.execPath.includes("\n")) {
    throw new Error("Node executable path cannot contain a newline");
  }
  return `#!${process.execPath}\n${source.slice(firstNewline + 1)}`;
};

if (uninstall) {
  await rm(installedManifest, { force: true });
  await rm(connectionConfig, { force: true });
  await rm(installedHostDir, { force: true, recursive: true });
  process.stdout.write(`${JSON.stringify({
    status: "UNINSTALLED",
    extensionId,
    installedManifest,
    connectionConfig,
    extensionRemoval: "remove the unpacked extension from chrome://extensions if it is still loaded",
  })}\n`);
  process.exit(0);
}

if (verify) {
  const expectedHost = await renderInstalledHost();
  const expectedControllerChannel = await readFile(sourceControllerChannelPath, "utf8");
  const [nativeManifestRaw, connectionConfigRaw, nativeManifestStat, configStat, hostStat, controllerChannelStat, installedHost, installedControllerChannel, distManifestRaw] = await Promise.all([
    readFile(installedManifest, "utf8"),
    readFile(connectionConfig, "utf8"),
    stat(installedManifest),
    stat(connectionConfig),
    stat(installedHostPath),
    stat(installedControllerChannelPath),
    readFile(installedHostPath, "utf8"),
    readFile(installedControllerChannelPath, "utf8"),
    readFile(path.join(extensionDir, "dist", "manifest.json"), "utf8"),
  ]);
  const nativeManifest = JSON.parse(nativeManifestRaw);
  const installedConnection = JSON.parse(connectionConfigRaw);
  const distManifest = JSON.parse(distManifestRaw);
  const expectedSocketPath = path.join(dataDir, "browser-runtime", "controller-native.sock");
  const failures = [];
  if (nativeManifest.name !== "com.grasseye.browser") failures.push("native host name mismatch");
  if (nativeManifest.path !== installedHostPath || !path.isAbsolute(nativeManifest.path)) failures.push("native host path mismatch");
  if (JSON.stringify(nativeManifest.allowed_origins) !== JSON.stringify([allowedOrigin])) failures.push("allowed_origins mismatch");
  if (installedConnection.protocolVersion !== "grasseye-browser-v1") failures.push("connection protocol mismatch");
  if (installedConnection.socketPath !== expectedSocketPath) failures.push("controller socket path mismatch");
  if (distManifest.key !== sourceExtensionManifest.key || distManifest.version !== sourceExtensionManifest.version) failures.push("extension build identity mismatch");
  if (installedHost !== expectedHost) failures.push("installed native host content mismatch");
  if (installedControllerChannel !== expectedControllerChannel) failures.push("installed controller channel content mismatch");
  if ((hostStat.mode & 0o100) === 0) failures.push("installed native host is not executable");
  if ((nativeManifestStat.mode & 0o077) !== 0 || (configStat.mode & 0o077) !== 0 || (hostStat.mode & 0o077) !== 0 || (controllerChannelStat.mode & 0o077) !== 0) failures.push("owner-only permission mismatch");
  if (failures.length > 0) throw new Error(`browser infrastructure verification failed: ${failures.join("; ")}`);
  process.stdout.write(`${JSON.stringify({
    status: "VERIFIED",
    extensionId,
    extensionVersion: distManifest.version,
    extensionDir: path.join(extensionDir, "dist"),
    installedManifest,
    hostPath: installedHostPath,
    connectionConfig,
    socketPath: expectedSocketPath,
  })}\n`);
  process.exit(0);
}
const build = spawnSync(process.execPath, [path.join(extensionDir, "build.mjs")], {
  cwd: repoRoot,
  encoding: "utf8",
});
if (build.status !== 0) throw new Error(build.stderr || build.stdout || "extension build failed");
await mkdir(chromeHostDir, { recursive: true, mode: 0o700 });
await mkdir(grassEyeDir, { recursive: true, mode: 0o700 });
await mkdir(installedHostDir, { recursive: true, mode: 0o700 });
await writeFile(installedHostPath, await renderInstalledHost(), { mode: 0o700 });
await writeFile(installedControllerChannelPath, await readFile(sourceControllerChannelPath), { mode: 0o600 });
await chmod(installedHostPath, 0o700);
await chmod(installedControllerChannelPath, 0o600);
const template = await readFile(path.join(sourceDir, "manifest.template.json"), "utf8");
await writeFile(installedManifest, template.replace("__HOST_ABSOLUTE_PATH__", installedHostPath), { mode: 0o600 });
await writeFile(connectionConfig, `${JSON.stringify({
  protocolVersion: "grasseye-browser-v1",
  socketPath: path.join(dataDir, "browser-runtime", "controller-native.sock"),
})}\n`, { mode: 0o600 });
process.stdout.write(`${JSON.stringify({
  status: "INSTALLED",
  extensionId,
  extensionVersion: sourceExtensionManifest.version,
  extensionDir: path.join(extensionDir, "dist"),
  installedManifest,
  hostPath: installedHostPath,
  connectionConfig,
})}\n`);
