import { existsSync, readFileSync } from "node:fs";

import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, InspectorOutput, SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { inspectRetiredBrowserPaths } from "./inspector-old-path-zero.js";

const ownerPaths = [
  "src/lib/browser/browser-controller.ts",
  "src/lib/browser/current-chrome-browser-controller.ts",
  "src/lib/browser/current-chrome-browser-controller-runtime.ts",
  "src/lib/browser/exact-target/browser-target-ref.ts",
  "src/lib/browser/exact-target/browser-target-registry.ts",
  "src/lib/browser/exact-target/browser-command-runtime.ts",
  "src/lib/browser/exact-target/browser-native-transport-server.ts",
  "src/lib/browser/exact-target/physical-focus-lease.ts",
  "src/lib/browser/chrome-extension/service-worker.ts",
  "src/lib/browser/chrome-extension/protocol.ts"
] as const;

const add = (findings: InspectorFinding[], lawId: string, clauseId: string, filePath: string, message: string): void => {
  findings.push(createFinding({ checkId: "local-browser-session/owner-assertion-set", lawId, clauseId, filePath, message }));
};

const source = (context: InspectorContext, filePath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(filePath));

const inspectOwnerAst = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const lawId = "APEX-LOCAL-BROWSER-001-V1";
  const clauseId = "apex-local-browser-001-requirement";
  const files = ownerPaths.flatMap((filePath) => {
    const value = source(context, filePath);
    if (!value) add(findings, lawId, clauseId, filePath, "required exact-target Browser owner source is missing");
    return value ? [value] : [];
  });
  const identifiers = new Set(files.flatMap((file) => [
    ...file.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()),
    ...file.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()),
  ]));
  for (const required of ["BrowserTargetRef", "BrowserDocumentRef", "BrowserTargetRegistry", "createTargetSession", "expectedLoaderId", "DOCUMENT_STALE", "TARGET_FOREIGN_SESSION"]) {
    if (!identifiers.has(required)) add(findings, lawId, clauseId, ownerPaths[0], `exact-target owner AST is missing ${required}`);
  }
  for (const file of context.project.getSourceFiles()) {
    const repoPath = file.getFilePath().replace(`${resolveFromRepo("")}/`, "");
    if (!repoPath.startsWith("src/") && !repoPath.startsWith("scripts/")) continue;
    const values = new Set(file.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()));
    if (values.has("evaluateActiveTab") || values.has("closeActiveTab")) {
      add(findings, lawId, clauseId, repoPath, "active-tab Browser API is forbidden after exact-target cutover");
    }
  }
  findings.push(...inspectRetiredBrowserPaths(lawId));
};

const inspectTransport = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const lawId = "APEX-LOCAL-BROWSER-002-V1";
  const clauseId = "apex-local-browser-002-requirement";
  const protocol = source(context, "src/lib/browser/chrome-extension/protocol.ts");
  const worker = source(context, "src/lib/browser/chrome-extension/service-worker.ts");
  const transport = source(context, "src/lib/browser/exact-target/browser-native-transport-server.ts");
  const ids = new Set([protocol, worker, transport].flatMap((file) => file?.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()) ?? []));
  for (const required of ["GRASSEYE_BROWSER_PROTOCOL_VERSION", "GRASSEYE_NATIVE_HOST_NAME", "chrome", "debugger", "nonce", "commandId", "mutationClass"]) {
    if (!ids.has(required)) add(findings, lawId, clauseId, "src/lib/browser/chrome-extension/protocol.ts", `private transport AST is missing ${required}`);
  }
  const manifestPath = "src/lib/browser/chrome-extension/manifest.json";
  if (!existsSync(resolveFromRepo(manifestPath))) {
    add(findings, lawId, clauseId, manifestPath, "MV3 manifest is missing");
  } else {
    const manifest = JSON.parse(readFileSync(resolveFromRepo(manifestPath), "utf8")) as { manifest_version?: number; permissions?: string[]; key?: string };
    if (manifest.manifest_version !== 3 || !manifest.key || !manifest.permissions?.includes("debugger") || !manifest.permissions.includes("nativeMessaging")) {
      add(findings, lawId, clauseId, manifestPath, "MV3 manifest must fix extension identity and declare only governed debugger/nativeMessaging transport");
    }
    if (manifest.permissions?.some((permission) => ["cookies", "storage", "passwords"].includes(permission))) {
      add(findings, lawId, clauseId, manifestPath, "MV3 manifest requests forbidden secret-bearing permissions");
    }
  }
};

const inspectPhysicalActionOwnership = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
  clauseId: string,
): void => {
  for (const file of context.project.getSourceFiles()) {
    const repoPath = file.getFilePath().replace(`${resolveFromRepo("")}/`, "");
    if (!repoPath.startsWith("src/capabilities/") && !repoPath.startsWith("src/plugins/")) continue;
    const literals = new Set(file.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()));
    const ids = new Set(file.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()));
    if (literals.has("osascript") || ids.has("execFileAsync") && repoPath.includes("web-chat-clipboard")) {
      add(findings, lawId, clauseId, repoPath, "capability/plugin must not own a direct system keyboard or clipboard transport");
    }
  }
};

const inspectFocusLease = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const lawId = "APEX-LOCAL-BROWSER-003-V1";
  const clauseId = "apex-local-browser-003-requirement";
  const focus = source(context, "src/lib/browser/exact-target/physical-focus-lease.ts");
  const commandRuntime = source(context, "src/lib/browser/exact-target/browser-command-runtime.ts");
  const physicalFileActions = source(context, "src/lib/browser/current-chrome-native-multi-file-picker.ts");
  const literals = new Set(focus?.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()) ?? []);
  for (const required of ["native_file_picker", "os_pointer_action", "os_keyboard_action", "FOCUS_LEASE_DENIED", "OPERATOR_INTERRUPTED"]) {
    if (!literals.has(required)) add(findings, lawId, clauseId, "src/lib/browser/exact-target/physical-focus-lease.ts", `focus lease contract is missing ${required}`);
  }
  const numeric = new Set(focus?.getDescendantsOfKind(SyntaxKind.NumericLiteral).map((node) => node.getLiteralValue()) ?? []);
  if (!numeric.has(15_000)) add(findings, lawId, clauseId, "src/lib/browser/exact-target/physical-focus-lease.ts", "focus lease must cap at 15000ms");
  const commandIds = new Set(commandRuntime?.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()) ?? []);
  const commandLiterals = new Set(commandRuntime?.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()) ?? []);
  if (!commandIds.has("pasteFileFromSystemClipboard") || !commandIds.has("focusLease") || !commandLiterals.has("os_keyboard_action")) {
    add(findings, lawId, clauseId, "src/lib/browser/exact-target/browser-command-runtime.ts", "system clipboard paste must be owned by the exact-target Browser session under os_keyboard_action focus lease");
  }
  const clipboardIds = new Set(physicalFileActions?.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()) ?? []);
  if (!clipboardIds.has("pasteCurrentChromeFileFromSystemClipboard") || !clipboardIds.has("execFileAsync")) {
    add(findings, lawId, clauseId, "src/lib/browser/current-chrome-native-multi-file-picker.ts", "Browser owner must contain the only system clipboard paste implementation");
  }
  inspectPhysicalActionOwnership(context, findings, lawId, clauseId);
};

const inspectDomainEvaluation = async (
  context: InspectorContext,
): Promise<Omit<InspectorOutput, "executedChecks">> => {
  const findings: InspectorFinding[] = [];
  inspectOwnerAst(context, findings);
  inspectTransport(context, findings);
  inspectFocusLease(context, findings);
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [...ownerPaths, "src/lib/browser/chrome-extension/manifest.json"],
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
