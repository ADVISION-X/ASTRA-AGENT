import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relative: string): string => readFileSync(path.join(repoRoot, relative), "utf8");

const retired = [
  "src/lib/browser/local-browser-session.ts",
  "src/types/local-browser-session.ts",
  "src/lib/browser/native-messaging-host/host.mjs",
  "src/lib/browser/native-messaging-host/controller-channel.mjs",
];
for (const relative of retired) {
  assert.equal(existsSync(path.join(repoRoot, relative)), false, `${relative} must remain physically retired`);
}

const productionFiles = [
  "src/lib/browser/browser-controller.ts",
  "src/lib/browser/current-chrome-browser-controller.ts",
  "src/lib/browser/current-chrome-browser-controller-runtime.ts",
  "src/lib/browser/exact-target/browser-command-runtime.ts",
  "src/lib/local-runtime/workbench-browser-support.ts",
  "src/lib/local-runtime/workbench-assembly.ts",
  "src/lib/local-runtime/workbench-status.ts",
  "src/lib/local-runtime/workbench.ts",
  "src/app/server.ts",
];
for (const relative of productionFiles) {
  const source = read(relative);
  assert.equal(source.includes("transportReady"), false, `${relative} must not expose transportReady`);
  assert.equal(source.includes('name: "browserSession"'), false, `${relative} must not expose browserSession health`);
  assert.equal(source.includes("Browser session transport is not authenticated"), false, `${relative} must not model an unauthenticated session`);
}

const assembly = read("src/lib/local-runtime/workbench-assembly.ts");
assert.ok(assembly.indexOf("await createWorkbenchBrowserController") >= 0);
assert.ok(assembly.indexOf("await createWorkbenchBrowserController") < assembly.indexOf("createWorkbenchAiInputGateway(dataDir"));
assert.match(assembly, /authority\.state !== "AUTHENTICATED_AUTHORITY_PRESENT"/u);

const server = read("src/app/server.ts");
const serverStart = server.indexOf("const server = startServer();");
assert.ok(server.indexOf("await workbench.init()") < serverStart);

const profileConfig = read("src/lib/browser/profile/browser-profile-config.ts");
assert.match(profileConfig, /readBrowserProfileEnrollment/u);
const profileEnrollment = read("src/lib/browser/profile/browser-profile-enrollment.ts");
assert.match(profileEnrollment, /normalizeBrowserRuntimePlatform/u);
assert.match(profileEnrollment, /platform === "darwin" \? "macos"/u);
assert.match(profileEnrollment, /info_cache/u);
assert.match(profileEnrollment, /gaiaId: info\?\.gaia_id/u);
const browserLaw = read(".github/instructions/agent-rules/modules/module-local-browser-session.instructions.md");
assert.match(browserLaw, /operator-designated/u);
assert.match(browserLaw, /GRASSEYE_BROWSER_RUNTIME_MODE=test/u);
const artifactBuilder = read("src/lib/browser/release/build-browser-runtime.mjs");
assert.match(artifactBuilder, /loadBrowserRuntimeEnv/u);
assert.match(artifactBuilder, /resolveBrowserRuntimeMode/u);
assert.match(artifactBuilder, /Apple Development/u);
const artifactVerifier = read("src/lib/browser/release/verify-browser-artifact.mjs");
assert.match(artifactVerifier, /manifest\.artifactMode/u);
assert.match(artifactVerifier, /spctl/u);

const transport = read("src/lib/browser/exact-target/browser-native-transport-server.ts");
assert.match(transport, /clearStaleSocketIfUnowned/u);
assert.match(transport, /ECONNREFUSED/u);
assert.match(transport, /authority_grant_ack/u);
assert.ok(transport.indexOf("verifyBrowserTranscriptProof(") < transport.indexOf("authorityIssuer.commit(candidate)"));
const closeStart = transport.indexOf("private onClose(connection");
const closeEnd = transport.indexOf("private watchAuthorityLiveness", closeStart);
const closeBody = transport.slice(closeStart, closeEnd);
assert.ok(closeBody.indexOf("this.revokeAuthority") < closeBody.indexOf("this.failPending"));

const extension = read("src/lib/browser/chrome-extension/service-worker-native-transport.ts");
assert.match(extension, /class NativePortActor/u);
assert.match(extension, /activeActor !== this/u);
assert.equal(extension.includes("let nativePort:"), false);
assert.equal(extension.includes("authenticatedNonce"), false);
assert.ok(extension.indexOf('type: "authority_grant_ack"') < extension.indexOf("this.authority = binding"));

const worker = read("src/lib/browser/chrome-extension/service-worker.ts");
assert.match(worker, /throwOnSideEffect: !allowSideEffects/u);
assert.match(worker, /Input\.dispatchMouseEvent/u);

const interactions = read("src/lib/browser/chrome-extension/service-worker-interaction-commands.ts");
assert.match(interactions, /Input\.insertText/u);
assert.match(interactions, /command\.fileGrant\.resolvedPath/u);

const installer = read("src/lib/browser/native-messaging-host/install.mjs");
assert.match(installer, /BROWSERCTL_PREBUILT_BINARY_REQUIRED/u);
assert.equal(installer.includes("transpileModule"), false);
assert.equal(existsSync(path.join(repoRoot, "src/lib/browser/native-messaging-host/crates/host/src/main.rs")), true);
assert.equal(existsSync(path.join(repoRoot, "src/lib/browser/native-messaging-host/crates/browserctl/src/main.rs")), true);
assert.match(read("src/lib/browser/native-messaging-host/crates/browserctl/src/main.rs"), /stable_local_state_identity_hash/u);
const hostSource = read("src/lib/browser/native-messaging-host/crates/host/src/main.rs");
assert.match(hostSource, /runtime_mode/u);
assert.match(hostSource, /existing_chrome_holds_enrolled_profile/u);
assert.match(hostSource, /\/usr\/sbin\/lsof/u);

process.stdout.write("local-browser-authority-cutover PASS\n");
