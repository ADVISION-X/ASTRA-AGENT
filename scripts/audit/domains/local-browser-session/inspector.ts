import { existsSync, readFileSync } from "node:fs";

import { createFinding } from "../../shared/finding-utils.js";
import type {
  InspectorContext,
  InspectorFinding,
  InspectorOutput,
  SessionInspectorOutput,
} from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { inspectRetiredBrowserPaths } from "./inspector-old-path-zero.js";

type LawBinding = Readonly<{ lawId: string; clauseId: string }>;

const LAW_EXACT: LawBinding = {
  lawId: "APEX-LOCAL-BROWSER-001-V2",
  clauseId: "apex-local-browser-001-v2-requirement",
};
const LAW_AUTH: LawBinding = {
  lawId: "APEX-LOCAL-BROWSER-002-V2",
  clauseId: "apex-local-browser-002-v2-requirement",
};
const LAW_EXECUTOR: LawBinding = {
  lawId: "APEX-LOCAL-BROWSER-003-V2",
  clauseId: "apex-local-browser-003-v2-requirement",
};
const LAW_EVALUATE: LawBinding = {
  lawId: "APEX-LOCAL-BROWSER-004-V2",
  clauseId: "apex-local-browser-004-v2-requirement",
};
const LAW_RELEASE: LawBinding = {
  lawId: "APEX-LOCAL-BROWSER-005-V1",
  clauseId: "apex-local-browser-005-v1-requirement",
};

const requiredFiles = [
  "src/lib/browser/browser-controller.ts",
  "src/lib/browser/current-chrome-browser-controller.ts",
  "src/lib/browser/current-chrome-browser-controller-runtime.ts",
  "src/lib/browser/authority/browser-authority-certificate.ts",
  "src/lib/browser/authority/browser-authority-issuer.ts",
  "src/lib/browser/profile/browser-profile-enrollment.ts",
  "src/lib/browser/profile/browser-profile-config.ts",
  "src/lib/browser/profile/browser-process-supervisor.ts",
  "src/lib/browser/release/browser-release-identity.ts",
  "src/lib/browser/transport/browser-session-crypto.ts",
  "src/lib/browser/transport/command-permit.ts",
  "src/lib/browser/exact-target/browser-command-runtime.ts",
  "src/lib/browser/exact-target/browser-native-transport-server.ts",
  "src/lib/browser/exact-target/browser-file-artifact-grant.ts",
  "src/lib/browser/exact-target/browser-target-ref.ts",
  "src/lib/browser/exact-target/browser-target-registry.ts",
  "src/lib/browser/chrome-extension/manifest.json",
  "src/lib/browser/chrome-extension/protocol.ts",
  "src/lib/browser/chrome-extension/service-worker-session-crypto.ts",
  "src/lib/browser/chrome-extension/service-worker-native-transport.ts",
  "src/lib/browser/chrome-extension/service-worker.ts",
  "src/lib/browser/native-messaging-host/Cargo.toml",
  "src/lib/browser/native-messaging-host/crates/host/src/main.rs",
  "src/lib/browser/native-messaging-host/crates/browserctl/src/main.rs",
  "src/lib/browser/native-messaging-host/install.mjs",
  "src/lib/local-runtime/workbench-browser-support.ts",
  "src/lib/local-runtime/workbench-assembly.ts",
  "src/lib/local-runtime/workbench-status.ts",
  "src/lib/local-runtime/workbench.ts",
  "src/app/server.ts",
] as const;

const text = (filePath: string): string => {
  const absolute = resolveFromRepo(filePath);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : "";
};

const add = (
  findings: InspectorFinding[],
  checkId: string,
  law: LawBinding,
  filePath: string,
  message: string,
): void => {
  findings.push(createFinding({
    checkId,
    lawId: law.lawId,
    clauseId: law.clauseId,
    filePath,
    message,
  }));
};

const requireFile = (
  findings: InspectorFinding[],
  checkId: string,
  law: LawBinding,
  filePath: string,
): string => {
  const value = text(filePath);
  if (!value) add(findings, checkId, law, filePath, "required Browser Authority production source is missing");
  return value;
};

const requireContains = (
  findings: InspectorFinding[],
  checkId: string,
  law: LawBinding,
  filePath: string,
  value: string,
  required: readonly string[],
): void => {
  for (const token of required) {
    if (!value.includes(token)) add(findings, checkId, law, filePath, `required production invariant is missing: ${token}`);
  }
};

const forbidContains = (
  findings: InspectorFinding[],
  checkId: string,
  law: LawBinding,
  filePath: string,
  value: string,
  forbidden: readonly string[],
): void => {
  for (const token of forbidden) {
    if (value.includes(token)) add(findings, checkId, law, filePath, `forbidden production invariant is present: ${token}`);
  }
};

const assertBefore = (
  findings: InspectorFinding[],
  checkId: string,
  law: LawBinding,
  filePath: string,
  value: string,
  first: string,
  second: string,
  message: string,
): void => {
  const firstIndex = value.indexOf(first);
  const secondIndex = value.indexOf(second);
  if (firstIndex < 0 || secondIndex < 0 || firstIndex >= secondIndex) {
    add(findings, checkId, law, filePath, message);
  }
};

const inspectExactTarget = (findings: InspectorFinding[]): void => {
  const controller = requireFile(findings, "local-browser-session/exact-target-authority", LAW_EXACT, "src/lib/browser/browser-controller.ts");
  const runtime = requireFile(findings, "local-browser-session/exact-target-authority", LAW_EXACT, "src/lib/browser/exact-target/browser-command-runtime.ts");
  const registry = requireFile(findings, "local-browser-session/exact-target-authority", LAW_EXACT, "src/lib/browser/exact-target/browser-target-registry.ts");
  requireContains(findings, "local-browser-session/exact-target-authority", LAW_EXACT, "src/lib/browser/browser-controller.ts", controller, [
    "BrowserTargetSession",
    "BrowserTargetRef",
    "BrowserDocumentRef",
    "getAuthoritySnapshot",
  ]);
  requireContains(findings, "local-browser-session/exact-target-authority", LAW_EXACT, "src/lib/browser/exact-target/browser-command-runtime.ts", runtime, [
    "authorityBindingOf",
    "registry.resolve",
    "expectedLoaderId",
    "DOCUMENT_STALE",
    "OUTCOME_UNKNOWN",
  ]);
  requireContains(findings, "local-browser-session/exact-target-authority", LAW_EXACT, "src/lib/browser/exact-target/browser-target-registry.ts", registry, [
    "TARGET_FOREIGN_SESSION",
    "DOCUMENT_STALE",
  ]);
  for (const forbidden of ["evaluateActiveTab", "closeActiveTab", "activeTab", "firstPage", "currentPage"]) {
    if (controller.includes(forbidden) || runtime.includes(forbidden)) {
      add(findings, "local-browser-session/exact-target-authority", LAW_EXACT, "src/lib/browser/browser-controller.ts", `exact-target production owner contains forbidden target fallback token ${forbidden}`);
    }
  }
};

const inspectNoUnauthenticatedSession = (findings: InspectorFinding[]): void => {
  const productionPaths = [
    "src/lib/browser/browser-controller.ts",
    "src/lib/browser/current-chrome-browser-controller.ts",
    "src/lib/browser/current-chrome-browser-controller-runtime.ts",
    "src/lib/browser/exact-target/browser-command-runtime.ts",
    "src/lib/local-runtime/workbench-browser-support.ts",
    "src/lib/local-runtime/workbench-assembly.ts",
    "src/lib/local-runtime/workbench-status.ts",
    "src/lib/local-runtime/workbench.ts",
    "src/app/server.ts",
  ] as const;
  for (const filePath of productionPaths) {
    const value = requireFile(findings, "local-browser-session/no-unauth-session-type", LAW_AUTH, filePath);
    forbidContains(findings, "local-browser-session/no-unauth-session-type", LAW_AUTH, filePath, value, [
      "transportReady",
      'name: "browserSession"',
      "Browser session transport is not authenticated",
      "UnauthenticatedBrowserSession",
      "authenticated: false",
    ]);
  }
  const certificate = requireFile(findings, "local-browser-session/no-unauth-session-type", LAW_AUTH, "src/lib/browser/authority/browser-authority-certificate.ts");
  requireContains(findings, "local-browser-session/no-unauth-session-type", LAW_AUTH, "src/lib/browser/authority/browser-authority-certificate.ts", certificate, [
    'state: "AUTHORITY_ABSENT"',
    'state: "AUTHENTICATED_AUTHORITY_PRESENT"',
    "private constructor",
  ]);
};

const inspectCompositionGate = (findings: InspectorFinding[]): void => {
  const assembly = requireFile(findings, "local-browser-session/composition-authority-gate", LAW_AUTH, "src/lib/local-runtime/workbench-assembly.ts");
  const browserSupport = requireFile(findings, "local-browser-session/composition-authority-gate", LAW_AUTH, "src/lib/local-runtime/workbench-browser-support.ts");
  const controller = requireFile(findings, "local-browser-session/composition-authority-gate", LAW_AUTH, "src/lib/browser/current-chrome-browser-controller.ts");
  const server = requireFile(findings, "local-browser-session/composition-authority-gate", LAW_AUTH, "src/app/server.ts");
  requireContains(findings, "local-browser-session/composition-authority-gate", LAW_AUTH, "src/lib/local-runtime/workbench-assembly.ts", assembly, [
    "await createWorkbenchBrowserController",
    'authority.state !== "AUTHENTICATED_AUTHORITY_PRESENT"',
    "createWorkbenchAiInputGateway",
  ]);
  assertBefore(findings, "local-browser-session/composition-authority-gate", LAW_AUTH, "src/lib/local-runtime/workbench-assembly.ts", assembly,
    "await createWorkbenchBrowserController", "createWorkbenchAiInputGateway(dataDir", "AI Gateway must be constructed after the authenticated BrowserController gate");
  requireContains(findings, "local-browser-session/composition-authority-gate", LAW_AUTH, "src/lib/local-runtime/workbench-browser-support.ts", browserSupport, [
    "async function createWorkbenchBrowserController",
    "resolveProductionBrowserProfileEnrollment",
    "CurrentChromeBrowserController.create",
  ]);
  requireContains(findings, "local-browser-session/composition-authority-gate", LAW_AUTH, "src/lib/browser/current-chrome-browser-controller.ts", controller, [
    "private constructor",
    "static async create",
  ]);
  assertBefore(findings, "local-browser-session/composition-authority-gate", LAW_AUTH, "src/app/server.ts", server,
    "await workbench.init()", "startServer()", "HTTP server must not listen before Workbench authority initialization succeeds");
};

const inspectMutualAuthorityCommit = (findings: InspectorFinding[]): void => {
  const issuer = requireFile(findings, "local-browser-session/authority-mutual-commit", LAW_AUTH, "src/lib/browser/authority/browser-authority-issuer.ts");
  const transport = requireFile(findings, "local-browser-session/authority-mutual-commit", LAW_AUTH, "src/lib/browser/exact-target/browser-native-transport-server.ts");
  const extension = requireFile(findings, "local-browser-session/authority-mutual-commit", LAW_AUTH, "src/lib/browser/chrome-extension/service-worker-native-transport.ts");
  requireContains(findings, "local-browser-session/authority-mutual-commit", LAW_AUTH, "src/lib/browser/authority/browser-authority-issuer.ts", issuer, [
    "prepare(input",
    "commit(candidate",
    "this.pending",
  ]);
  requireContains(findings, "local-browser-session/authority-mutual-commit", LAW_AUTH, "src/lib/browser/exact-target/browser-native-transport-server.ts", transport, [
    'value.type === "authority_grant_ack"',
    "handleAuthorityGrantAck",
    "verifyBrowserTranscriptProof",
    "authorityIssuer.commit(candidate)",
  ]);
  requireContains(findings, "local-browser-session/authority-mutual-commit", LAW_AUTH, "src/lib/browser/chrome-extension/service-worker-native-transport.ts", extension, [
    'type: "authority_grant_ack"',
    "verifyControllerProof",
    "this.authority = binding",
  ]);
  assertBefore(findings, "local-browser-session/authority-mutual-commit", LAW_AUTH, "src/lib/browser/exact-target/browser-native-transport-server.ts", transport,
    "verifyBrowserTranscriptProof(", "authorityIssuer.commit(candidate)", "Controller must verify the Extension grant ACK proof before committing authority");
  assertBefore(findings, "local-browser-session/authority-mutual-commit", LAW_AUTH, "src/lib/browser/chrome-extension/service-worker-native-transport.ts", extension,
    'type: "authority_grant_ack"', "this.authority = binding", "Extension must emit grant ACK before exposing local authority to command execution");
};

const inspectRevocationOrder = (findings: InspectorFinding[]): void => {
  const transportPath = "src/lib/browser/exact-target/browser-native-transport-server.ts";
  const transport = requireFile(findings, "local-browser-session/authority-revoke-before-side-effects", LAW_AUTH, transportPath);
  requireContains(findings, "local-browser-session/authority-revoke-before-side-effects", LAW_AUTH, transportPath, transport, [
    "revokeAuthority(reason",
    "revokeAndDestroy",
    "onClose(connection",
  ]);
  const closeStart = transport.indexOf("private onClose(connection");
  const closeEnd = transport.indexOf("private watchAuthorityLiveness", closeStart);
  const closeBody = closeStart >= 0 && closeEnd > closeStart ? transport.slice(closeStart, closeEnd) : "";
  assertBefore(findings, "local-browser-session/authority-revoke-before-side-effects", LAW_AUTH, transportPath, closeBody,
    "this.revokeAuthority", "this.failPending", "disconnect must revoke authority before rejecting pending commands or emitting reconnect-side effects");
  const revokeStart = transport.indexOf("private revokeAndDestroy(connection");
  const revokeEnd = transport.indexOf("private rejectPendingAndDestroy", revokeStart);
  const revokeBody = revokeStart >= 0 && revokeEnd > revokeStart ? transport.slice(revokeStart, revokeEnd) : "";
  assertBefore(findings, "local-browser-session/authority-revoke-before-side-effects", LAW_AUTH, transportPath, revokeBody,
    "this.revokeAuthority", "this.failPending", "protocol failure must revoke authority before pending-command failure/connection destruction");
};

const inspectPortActorFence = (findings: InspectorFinding[]): void => {
  const path = "src/lib/browser/chrome-extension/service-worker-native-transport.ts";
  const value = requireFile(findings, "local-browser-session/native-port-actor-generation-fence", LAW_AUTH, path);
  requireContains(findings, "local-browser-session/native-port-actor-generation-fence", LAW_AUTH, path, value, [
    "class NativePortActor",
    "activeActor !== this",
    "nativePortEpoch",
    "extensionInstanceId",
    "this.port.postMessage",
    "this.commandReceipts",
  ]);
  forbidContains(findings, "local-browser-session/native-port-actor-generation-fence", LAW_AUTH, path, value, [
    "let nativePort:",
    "authenticatedNonce",
    "lastAcceptedSequence = 0;\nlet",
  ]);
};

const inspectPermitAndFrameBinding = (findings: InspectorFinding[]): void => {
  const permit = requireFile(findings, "local-browser-session/command-permit-frame-binding", LAW_AUTH, "src/lib/browser/transport/command-permit.ts");
  const crypto = requireFile(findings, "local-browser-session/command-permit-frame-binding", LAW_AUTH, "src/lib/browser/transport/browser-session-crypto.ts");
  const transport = requireFile(findings, "local-browser-session/command-permit-frame-binding", LAW_AUTH, "src/lib/browser/exact-target/browser-native-transport-server.ts");
  requireContains(findings, "local-browser-session/command-permit-frame-binding", LAW_AUTH, "src/lib/browser/transport/command-permit.ts", permit, [
    "authorityCertificateHash",
    "connectionGeneration",
    "nativePortEpoch",
    "permitHash",
  ]);
  requireContains(findings, "local-browser-session/command-permit-frame-binding", LAW_AUTH, "src/lib/browser/transport/browser-session-crypto.ts", crypto, [
    'createECDH("prime256v1")',
    'hkdfSync("sha256"',
    'createCipheriv("aes-256-gcm"',
    "setAAD",
  ]);
  requireContains(findings, "local-browser-session/command-permit-frame-binding", LAW_AUTH, "src/lib/browser/exact-target/browser-native-transport-server.ts", transport, [
    "issueBrowserCommandPermit",
    "encryptBrowserFrame",
    "decryptBrowserFrame",
    "permitHash",
  ]);
};

const inspectAuthorityLiveness = (findings: InspectorFinding[]): void => {
  const issuer = requireFile(findings, "local-browser-session/authority-liveness", LAW_AUTH, "src/lib/browser/authority/browser-authority-issuer.ts");
  const transport = requireFile(findings, "local-browser-session/authority-liveness", LAW_AUTH, "src/lib/browser/exact-target/browser-native-transport-server.ts");
  requireContains(findings, "local-browser-session/authority-liveness", LAW_AUTH, "src/lib/browser/authority/browser-authority-issuer.ts", issuer, [
    "BROWSER_AUTHORITY_HEARTBEAT_INTERVAL_MS = 1_000",
    "BROWSER_AUTHORITY_HARD_EXPIRY_MS = 5_000",
    "BROWSER_AUTHORITY_MAX_AGE_MS",
    "heartbeat(input",
    "requireCurrent()",
  ]);
  requireContains(findings, "local-browser-session/authority-liveness", LAW_AUTH, "src/lib/browser/exact-target/browser-native-transport-server.ts", transport, [
    "setInterval(() => this.watchAuthorityLiveness(), 250)",
    "stale heartbeat cannot renew browser authority",
  ]);
  forbidContains(findings, "local-browser-session/authority-liveness", LAW_AUTH, "src/lib/browser/authority/browser-authority-issuer.ts", issuer, [
    "if (!this.current) this.prepare",
    "if (!this.current) this.commit",
  ]);
};

const inspectExecutorBoundary = (findings: InspectorFinding[]): void => {
  const manifestPath = "src/lib/browser/chrome-extension/manifest.json";
  const manifest = requireFile(findings, "local-browser-session/extension-only-executor", LAW_EXECUTOR, manifestPath);
  const worker = requireFile(findings, "local-browser-session/extension-only-executor", LAW_EXECUTOR, "src/lib/browser/chrome-extension/service-worker.ts");
  const protocol = requireFile(findings, "local-browser-session/extension-only-executor", LAW_EXECUTOR, "src/lib/browser/chrome-extension/protocol.ts");
  requireContains(findings, "local-browser-session/extension-only-executor", LAW_EXECUTOR, manifestPath, manifest, [
    '"manifest_version": 3',
    '"minimum_chrome_version": "120"',
    '"debugger"',
    '"nativeMessaging"',
  ]);
  forbidContains(findings, "local-browser-session/extension-only-executor", LAW_EXECUTOR, manifestPath, manifest, [
    '"cookies"',
    '"storage"',
    '"file:///*"',
  ]);
  for (const token of ["focus_target", "native_file_picker", "os_pointer_action", "os_keyboard_action", "PhysicalFocusLease"]) {
    if (worker.includes(token) || protocol.includes(token)) {
      add(findings, "local-browser-session/extension-only-executor", LAW_EXECUTOR, "src/lib/browser/chrome-extension/protocol.ts", `extension command surface contains forbidden physical-focus transport: ${token}`);
    }
  }
};

const inspectFileGrant = (findings: InspectorFinding[]): void => {
  const grant = requireFile(findings, "local-browser-session/file-artifact-grant", LAW_EXECUTOR, "src/lib/browser/exact-target/browser-file-artifact-grant.ts");
  const protocol = requireFile(findings, "local-browser-session/file-artifact-grant", LAW_EXECUTOR, "src/lib/browser/chrome-extension/protocol.ts");
  const interaction = requireFile(findings, "local-browser-session/file-artifact-grant", LAW_EXECUTOR, "src/lib/browser/chrome-extension/service-worker-interaction-commands.ts");
  requireContains(findings, "local-browser-session/file-artifact-grant", LAW_EXECUTOR, "src/lib/browser/exact-target/browser-file-artifact-grant.ts", grant, [
    "realpath(input.filePath)",
    "approvedRoots",
    "before.dev !== after.dev",
    "before.ino !== after.ino",
    "sha256",
  ]);
  requireContains(findings, "local-browser-session/file-artifact-grant", LAW_EXECUTOR, "src/lib/browser/chrome-extension/protocol.ts", protocol, [
    "BrowserWireFileGrant",
    "fileGrant: BrowserWireFileGrant",
  ]);
  if (/kind:\s*"set_file_input_files"[\s\S]{0,300}filePath\s*:/u.test(protocol)) {
    add(findings, "local-browser-session/file-artifact-grant", LAW_EXECUTOR, "src/lib/browser/chrome-extension/protocol.ts", "wire contract must not accept a raw filePath for set_file_input_files");
  }
  requireContains(findings, "local-browser-session/file-artifact-grant", LAW_EXECUTOR, "src/lib/browser/chrome-extension/service-worker-interaction-commands.ts", interaction, [
    "command.fileGrant.grantId",
    "command.fileGrant.resolvedPath",
  ]);
};

const inspectEvaluationBoundary = (findings: InspectorFinding[]): void => {
  const runtime = requireFile(findings, "local-browser-session/side-effect-free-observation", LAW_EVALUATE, "src/lib/browser/exact-target/browser-command-runtime.ts");
  const worker = requireFile(findings, "local-browser-session/side-effect-free-observation", LAW_EVALUATE, "src/lib/browser/chrome-extension/service-worker.ts");
  requireContains(findings, "local-browser-session/side-effect-free-observation", LAW_EVALUATE, "src/lib/browser/exact-target/browser-command-runtime.ts", runtime, [
    "toBrowserEvaluationExpression(input.script)",
    '"observation"',
  ]);
  requireContains(findings, "local-browser-session/side-effect-free-observation", LAW_EVALUATE, "src/lib/browser/chrome-extension/service-worker.ts", worker, [
    "throwOnSideEffect: !allowSideEffects",
    "const observe =",
    'command.kind === "evaluate_target"',
  ]);
  const dedicated = ["click_target", "click_dom_target", "fill_dom_target", "scroll_target", "text_target", "set_file_input_files"];
  for (const command of dedicated) {
    if (!worker.includes(command) && !text("src/lib/browser/chrome-extension/service-worker-interaction-commands.ts").includes(command)) {
      add(findings, "local-browser-session/dedicated-mutation-surface", LAW_EVALUATE, "src/lib/browser/chrome-extension/service-worker.ts", `dedicated exact-target mutation command is missing: ${command}`);
    }
  }
  requireContains(findings, "local-browser-session/dedicated-mutation-surface", LAW_EVALUATE, "src/lib/browser/chrome-extension/service-worker.ts", worker, [
    "Input.dispatchMouseEvent",
  ]);
  requireContains(findings, "local-browser-session/dedicated-mutation-surface", LAW_EVALUATE, "src/lib/browser/chrome-extension/service-worker-interaction-commands.ts", text("src/lib/browser/chrome-extension/service-worker-interaction-commands.ts"), [
    '"Input.insertText"',
  ]);
};

const inspectProfileAndRelease = (findings: InspectorFinding[]): void => {
  const config = requireFile(findings, "local-browser-session/profile-process-enrollment", LAW_RELEASE, "src/lib/browser/profile/browser-profile-config.ts");
  const supervisor = requireFile(findings, "local-browser-session/profile-process-enrollment", LAW_RELEASE, "src/lib/browser/profile/browser-process-supervisor.ts");
  const host = requireFile(findings, "local-browser-session/profile-process-enrollment", LAW_RELEASE, "src/lib/browser/native-messaging-host/crates/host/src/main.rs");
  requireContains(findings, "local-browser-session/profile-process-enrollment", LAW_RELEASE, "src/lib/browser/profile/browser-profile-config.ts", config, [
    'requireEnv("GRASSEYE_CHROME_USER_DATA_DIR")',
    'requireEnv("GRASSEYE_BROWSER_PROFILE_REF")',
    'requireEnv("GRASSEYE_CHROME_EXECUTABLE")',
  ]);
  requireContains(findings, "local-browser-session/profile-process-enrollment", LAW_RELEASE, "src/lib/browser/profile/browser-process-supervisor.ts", supervisor, [
    "--user-data-dir=",
    "--profile-directory=",
  ]);
  requireContains(findings, "local-browser-session/profile-process-enrollment", LAW_RELEASE, "src/lib/browser/native-messaging-host/crates/host/src/main.rs", host, [
    "assert_caller_origin",
    "assert_enrolled_browser_ancestry",
    "BROWSER_HOST_PROFILE_PROCESS_ATTESTATION_FAILED",
  ]);

  const release = requireFile(findings, "local-browser-session/protocol-release-identity", LAW_RELEASE, "src/lib/browser/release/browser-release-identity.ts");
  const protocol = requireFile(findings, "local-browser-session/protocol-release-identity", LAW_RELEASE, "src/lib/browser/chrome-extension/protocol.ts");
  const browserctl = requireFile(findings, "local-browser-session/protocol-release-identity", LAW_RELEASE, "src/lib/browser/native-messaging-host/crates/browserctl/src/main.rs");
  for (const token of [
    "grasseye-browser-v2",
    "grasseye-browser-runtime-2026-08-18-v2",
    "mepfnlhndaiihhfejbbhfehegpbdnipl",
  ]) {
    if (!release.includes(token) || !protocol.includes(token) || !host.includes(token) || !browserctl.includes(token)) {
      add(findings, "local-browser-session/protocol-release-identity", LAW_RELEASE, "src/lib/browser/release/browser-release-identity.ts", `release tuple is not identical across Controller/Extension/Host/browserctl: ${token}`);
    }
  }
};

const inspectRustHostOnly = (findings: InspectorFinding[]): void => {
  const installPath = "src/lib/browser/native-messaging-host/install.mjs";
  const installer = requireFile(findings, "local-browser-session/rust-native-host-only", LAW_RELEASE, installPath);
  const cargo = requireFile(findings, "local-browser-session/rust-native-host-only", LAW_RELEASE, "src/lib/browser/native-messaging-host/Cargo.toml");
  const host = requireFile(findings, "local-browser-session/rust-native-host-only", LAW_RELEASE, "src/lib/browser/native-messaging-host/crates/host/src/main.rs");
  const browserctl = requireFile(findings, "local-browser-session/rust-native-host-only", LAW_RELEASE, "src/lib/browser/native-messaging-host/crates/browserctl/src/main.rs");
  requireContains(findings, "local-browser-session/rust-native-host-only", LAW_RELEASE, installPath, installer, [
    "BROWSERCTL_PREBUILT_BINARY_REQUIRED",
    "grasseye-browserctl",
  ]);
  forbidContains(findings, "local-browser-session/rust-native-host-only", LAW_RELEASE, installPath, installer, [
    "transpileModule",
    "process.execPath",
    "npm rebuild",
  ]);
  requireContains(findings, "local-browser-session/rust-native-host-only", LAW_RELEASE, "src/lib/browser/native-messaging-host/Cargo.toml", cargo, [
    '"crates/host"',
    '"crates/browserctl"',
  ]);
  requireContains(findings, "local-browser-session/rust-native-host-only", LAW_RELEASE, "src/lib/browser/native-messaging-host/crates/host/src/main.rs", host, [
    "u32::from_ne_bytes",
    "EXTENSION_TO_HOST_MAX_BYTES",
    "HOST_TO_EXTENSION_MAX_BYTES",
  ]);
  requireContains(findings, "local-browser-session/rust-native-host-only", LAW_RELEASE, "src/lib/browser/native-messaging-host/crates/browserctl/src/main.rs", browserctl, [
    "write_atomic",
    "host_sha256",
    "allowed_origins",
  ]);
};

const inspectDomainEvaluation = async (
  context: InspectorContext,
): Promise<Omit<InspectorOutput, "executedChecks">> => {
  const findings: InspectorFinding[] = [];
  for (const filePath of requiredFiles) {
    if (!existsSync(resolveFromRepo(filePath))) {
      add(findings, "local-browser-session/exact-target-authority", LAW_EXACT, filePath, "required Browser Authority production file is missing");
    }
  }
  inspectExactTarget(findings);
  inspectNoUnauthenticatedSession(findings);
  inspectCompositionGate(findings);
  inspectMutualAuthorityCommit(findings);
  inspectRevocationOrder(findings);
  inspectPortActorFence(findings);
  inspectPermitAndFrameBinding(findings);
  inspectAuthorityLiveness(findings);
  inspectExecutorBoundary(findings);
  inspectFileGrant(findings);
  inspectEvaluationBoundary(findings);
  inspectProfileAndRelease(findings);
  inspectRustHostOnly(findings);
  findings.push(...inspectRetiredBrowserPaths());

  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...requiredFiles],
    reportJson: { status: findings.length === 0 ? "PASS" : "FAIL", findings },
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  if (!context.checks) throw new Error("local-browser-session requires a runner-owned check session");
  let reportJson: unknown;
  await context.checks.runAll(async () => {
    const evaluation = await inspectDomainEvaluation(context);
    reportJson = evaluation.reportJson;
    return {
      findings: evaluation.findings,
      evidenceRefs: [context.planEntry.ownerInspectorPath, ...evaluation.inspectedFiles],
    };
  });
  return context.checks.output({ ...(reportJson === undefined ? {} : { reportJson }) });
};
