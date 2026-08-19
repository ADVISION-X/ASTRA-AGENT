import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import {
  addBrowserFinding,
  externalTextHasAll,
  forbidAstFacts,
  requireAstFacts,
  requireAstSource,
  requireExternalText,
  type ExternalNonTypeScriptSource,
  type BrowserLawBinding,
} from "./browser-authority-inspector-support.js";

type ReleaseLaws = Readonly<{
  executor: BrowserLawBinding;
  release: BrowserLawBinding;
}>;

const requireExternalFacts = (input: {
  findings: InspectorFinding[];
  checkId: string;
  law: BrowserLawBinding;
  filePath: string;
  required: readonly string[];
  forbidden?: readonly string[];
}): ExternalNonTypeScriptSource => {
  const value = requireExternalText(
    input.findings,
    input.checkId,
    input.law,
    input.filePath,
  );
  for (const token of input.required) {
    if (!externalTextHasAll(value, [token])) {
      addBrowserFinding(
        input.findings,
        input.checkId,
        input.law,
        input.filePath,
        `required external-source invariant is missing: ${token}`,
      );
    }
  }
  for (const token of input.forbidden ?? []) {
    if (externalTextHasAll(value, [token])) {
      addBrowserFinding(
        input.findings,
        input.checkId,
        input.law,
        input.filePath,
        `forbidden external-source invariant is present: ${token}`,
      );
    }
  }
  return value;
};

const inspectExtensionManifest = (
  findings: InspectorFinding[],
  laws: ReleaseLaws,
): void => {
  requireExternalFacts({
    findings,
    checkId: "local-browser-session/extension-only-executor",
    law: laws.executor,
    filePath: "src/lib/browser/chrome-extension/manifest.json",
    required: [
      '"manifest_version": 3',
      '"minimum_chrome_version": "120"',
      '"debugger"',
      '"nativeMessaging"',
    ],
    forbidden: ['"cookies"', '"storage"', '"file:///*"'],
  });
};

const inspectProfileEnrollment = (
  context: InspectorContext,
  findings: InspectorFinding[],
  laws: ReleaseLaws,
): void => {
  const checkId = "local-browser-session/profile-process-enrollment";
  const configPath = "src/lib/browser/profile/browser-profile-config.ts";
  const config = requireAstSource(context, findings, checkId, laws.release, configPath);
  if (config) requireAstFacts({
    source: config,
    findings,
    checkId,
    law: laws.release,
    filePath: configPath,
    identifiers: ["readBrowserProfileEnrollment"],
  });
  const supervisorPath = "src/lib/browser/profile/browser-process-supervisor.ts";
  const supervisor = requireAstSource(context, findings, checkId, laws.release, supervisorPath);
  if (supervisor) requireAstFacts({
    source: supervisor,
    findings,
    checkId,
    law: laws.release,
    filePath: supervisorPath,
    strings: ["--user-data-dir=", "--profile-directory="],
  });
  requireExternalFacts({
    findings,
    checkId,
    law: laws.release,
    filePath: "src/lib/browser/native-messaging-host/crates/host/src/main.rs",
    required: [
      "assert_caller_origin",
      "assert_enrolled_browser_ancestry",
      "BROWSER_HOST_PROFILE_PROCESS_ATTESTATION_FAILED",
    ],
  });
};

const inspectReleaseTuple = (
  context: InspectorContext,
  findings: InspectorFinding[],
  laws: ReleaseLaws,
): void => {
  const checkId = "local-browser-session/protocol-release-identity";
  const releasePath = "src/lib/browser/release/browser-release-identity.ts";
  const protocolPath = "src/lib/browser/chrome-extension/protocol.ts";
  const release = requireAstSource(context, findings, checkId, laws.release, releasePath);
  const protocol = requireAstSource(context, findings, checkId, laws.release, protocolPath);
  const tuple = [
    "grasseye-browser-v2",
    "grasseye-browser-runtime-2026-08-18-v2",
    "mepfnlhndaiihhfejbbhfehegpbdnipl",
  ] as const;
  for (const [filePath, source] of [[releasePath, release], [protocolPath, protocol]] as const) {
    if (!source) continue;
    requireAstFacts({ source, findings, checkId, law: laws.release, filePath, strings: tuple });
  }
  const hostPath = "src/lib/browser/native-messaging-host/crates/host/src/main.rs";
  const browserctlPath = "src/lib/browser/native-messaging-host/crates/browserctl/src/main.rs";
  const host = requireExternalText(findings, checkId, laws.release, hostPath);
  const browserctl = requireExternalText(findings, checkId, laws.release, browserctlPath);
  for (const token of tuple) {
    if (!externalTextHasAll(host, [token]) || !externalTextHasAll(browserctl, [token])) {
      addBrowserFinding(
        findings,
        checkId,
        laws.release,
        releasePath,
        `release tuple is not identical across Controller, Extension, Host and browserctl: ${token}`,
      );
    }
  }
  if (release) requireAstFacts({
    source: release,
    findings,
    checkId,
    law: laws.release,
    filePath: releasePath,
    identifiers: ["GRASSEYE_BROWSER_RELEASE_SEQUENCE", "GRASSEYE_BROWSER_MINIMUM_ACCEPTED_RELEASE_SEQUENCE"],
    numbers: [3],
  });
  requireExternalFacts({
    findings,
    checkId,
    law: laws.release,
    filePath: browserctlPath,
    required: ["--enroll-profile", "--doctor", "profile-enrollment.json", "RELEASE_SEQUENCE: u64 = 3"],
  });
};

const inspectRustHostAndArtifacts = (
  context: InspectorContext,
  findings: InspectorFinding[],
  laws: ReleaseLaws,
): void => {
  const checkId = "local-browser-session/rust-native-host-only";
  const astCases = [
    ["src/lib/browser/native-messaging-host/install.mjs", ["BROWSERCTL_PREBUILT_BINARY_REQUIRED", "grasseye-browserctl"], []],
    ["src/lib/browser/release/build-browser-runtime.mjs", ["Apple Development", "browser-artifact-set.test-public-key.pem", "grasseye-browser-artifact-set-v2"], ["loadBrowserRuntimeEnv", "resolveBrowserRuntimeMode", "treeSha256"]],
    ["src/lib/browser/release/verify-browser-artifact.mjs", ["BROWSER_EXTENSION_TREE_ARTIFACT_HASH_MISMATCH", "spctl"], ["resolveBrowserRuntimeMode", "artifactMode", "treeSha256"]],
    ["src/lib/browser/release/browser-runtime-env.mjs", ["production", ".env.local", ".env"], []],
    ["src/lib/browser/release/extension-tree-sha256.mjs", ["BROWSER_EXTENSION_TREE_SYMLINK_FORBIDDEN"], ["metadata", "size", "JSON", "stringify", "files"]],
    ["src/lib/browser/release/browser-activation-receipt.ts", ["BROWSER_ACTIVATION_RECEIPT_ARTIFACT_MISMATCH"], ["artifactSetSha256", "profileEnrollmentId"]],
  ] as const;
  for (const [filePath, strings, identifiers] of astCases) {
    const source = requireAstSource(context, findings, checkId, laws.release, filePath);
    if (!source) continue;
    requireAstFacts({ source, findings, checkId, law: laws.release, filePath, strings, identifiers });
    if (filePath.endsWith("install.mjs")) forbidAstFacts({
      source,
      findings,
      checkId,
      law: laws.release,
      filePath,
      identifiers: ["transpileModule"],
      strings: ["npm rebuild"],
    });
  }
  requireExternalFacts({
    findings,
    checkId,
    law: laws.release,
    filePath: "src/lib/browser/native-messaging-host/Cargo.toml",
    required: ['"crates/host"', '"crates/browserctl"'],
  });
  requireExternalFacts({
    findings,
    checkId,
    law: laws.release,
    filePath: "src/lib/browser/native-messaging-host/crates/host/src/main.rs",
    required: [
      "u32::from_ne_bytes",
      "EXTENSION_TO_HOST_MAX_BYTES",
      "HOST_TO_EXTENSION_MAX_BYTES",
      "runtime_mode",
      "existing_chrome_holds_enrolled_profile",
      "/usr/sbin/lsof",
    ],
  });
  requireExternalFacts({
    findings,
    checkId,
    law: laws.release,
    filePath: "src/lib/browser/native-messaging-host/crates/browserctl/src/main.rs",
    required: [
      "write_atomic",
      "host_sha256",
      "artifact_set_sha256",
      "extension_tree_sha256",
      "verify_artifact_signature",
      "allowed_origins",
      "stable_local_state_identity_hash",
    ],
  });
};

export const inspectBrowserAuthorityRelease = (
  context: InspectorContext,
  findings: InspectorFinding[],
  laws: ReleaseLaws,
): void => {
  inspectExtensionManifest(findings, laws);
  inspectProfileEnrollment(context, findings, laws);
  inspectReleaseTuple(context, findings, laws);
  inspectRustHostAndArtifacts(context, findings, laws);
};
