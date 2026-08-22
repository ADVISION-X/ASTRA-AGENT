import { existsSync, readFileSync } from "node:fs";

import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { astIdentifierName } from "../../shared/ast-node-identity.js";
import { selectLawId } from "../../shared/finding-utils.js";
import { splitLines } from "../../shared/no-regex.js";
import {
  type InspectorContext,
  type InspectorFinding,
  type InspectorOutput,
  type SessionInspectorOutput,
} from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import { collectTransportPayloadCeilingFindings } from "./transport-payload-ceiling-inspector.js";
import {
  blueprintPath,
  createLocalFinding,
  identifiers,
  lawPath,
  requireIdentifiers,
  requireSource,
  retiredPaths,
  sourcePaths,
  stringLiterals,
  targetAuthorityPath,
} from "./inspector-support.js";
import { inspectOperatorAdmission } from "./operator-admission-inspector.js";
import { inspectSingleTransport } from "./transport-inspector.js";

type RegistryMutationSources = Readonly<{
  actor: SourceFile;
  broker: SourceFile;
  commandActor: SourceFile;
  domRuntime: SourceFile;
  journal: SourceFile;
  manager: SourceFile;
  registry: SourceFile;
  targetAuthority: SourceFile;
}>;

const requireRegistryMutationSources = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): RegistryMutationSources | null => {
  const paths = [sourcePaths[1], targetAuthorityPath, sourcePaths[8], sourcePaths[6], sourcePaths[7], sourcePaths[5], sourcePaths[18], sourcePaths[19]];
  const sources = paths.map((path) => requireSource(context, findings, lawId, path));
  if (sources.some((source) => source === null)) return null;
  const [actor, targetAuthority, registry, commandActor, journal, manager, broker, domRuntime] = sources.map((source) => source!) as [SourceFile, SourceFile, SourceFile, SourceFile, SourceFile, SourceFile, SourceFile, SourceFile];
  return { actor, targetAuthority, registry, commandActor, journal, manager, broker, domRuntime };
};

const inspectExtensionExecutionBoundary = (
  sources: RegistryMutationSources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const actorStrings = new Set([...stringLiterals(sources.actor), ...stringLiterals(sources.targetAuthority)]);
  if (!actorStrings.has("DOM.setFileInputFiles") || !actorStrings.has("#upload-files")) {
    findings.push(createLocalFinding({
      checkId: "browser-authority/terminal-authority",
      lawId,
      filePath: sourcePaths[1],
      message: "The extension file-input command must use one observed #upload-files target and DOM.setFileInputFiles.",
    }));
  }
  if (identifiers(sources.domRuntime).has("DOMParser") || actorStrings.has("Runtime.evaluate")) {
    findings.push(createLocalFinding({
      checkId: "browser-authority/terminal-authority",
      lawId,
      filePath: sourcePaths[19],
      message: "The MV3 executor must use the deterministic CDP node tree and cannot retain DOMParser or Runtime.evaluate.",
    }));
  }
  const forbiddenExecutors = new Set(["eval", "Function", "executeScript"]);
  const forbidden = sources.actor.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => {
    const expression = call.getExpression();
    const name = Node.isIdentifier(expression) ? astIdentifierName(expression) : undefined;
    return name !== undefined && forbiddenExecutors.has(name);
  });
  if (forbidden) findings.push(createLocalFinding({
    checkId: "browser-authority/terminal-authority",
    lawId,
    filePath: sourcePaths[1],
    line: forbidden.getStartLineNumber(),
    message: "The fixed extension command actor must not execute arbitrary code.",
  }));
};

const inspectRegistryAndMutationBoundary = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const sources = requireRegistryMutationSources(context, findings, lawId);
  if (!sources) return;
  const allIdentifiers = new Set([
    ...identifiers(sources.actor),
    ...identifiers(sources.targetAuthority),
    ...identifiers(sources.registry),
    ...identifiers(sources.commandActor),
    ...identifiers(sources.journal),
    ...identifiers(sources.manager),
    ...identifiers(sources.broker),
  ]);
  for (const required of [
    "admitExtensionCommand",
    "executeRegisteredCommand",
    "BrowserProofJournal",
    "previousEntryHash",
    "entryHash",
    "PREPARED",
    "UNKNOWN",
    "BrowserArtifactRegistry",
    "registerFileArtifact",
    "issueFileArtifactGrant",
    "resolveGrantPaths",
    "resolvedFilePaths",
  ]) {
    if (!allIdentifiers.has(required) && !stringLiterals(sources.journal).includes(required)) {
      findings.push(createLocalFinding({
        checkId: "browser-authority/terminal-authority",
        lawId,
        filePath: sourcePaths[7],
        message: `The registry/mutation chain must contain ${required}.`,
      }));
    }
  }
  inspectExtensionExecutionBoundary(sources, findings, lawId);
};

const inspectReleaseAndRetiredPaths = (findings: InspectorFinding[], lawId: string): void => {
  for (const path of retiredPaths) {
    if (existsSync(resolveFromRepo(path))) {
      findings.push(createLocalFinding({
        checkId: "browser-authority/terminal-authority",
        lawId,
        filePath: path,
        message: `${path} is a retired Browser transport/release path and must remain physically absent.`,
      }));
    }
  }
  const manifestPath = "src/lib/browser/chrome-extension/manifest.json";
  const manifest = JSON.parse(readFileSync(resolveFromRepo(manifestPath), "utf8")) as Record<string, unknown>;
  const background = manifest.background as Record<string, unknown> | undefined;
  const action = manifest.action as Record<string, unknown> | undefined;
  if (manifest.manifest_version !== 3
    || background?.service_worker !== "service-worker.js"
    || action?.default_popup !== "pairing.html"
    || Object.hasOwn(manifest, "externally_connectable")
    || JSON.stringify(manifest.host_permissions) !== JSON.stringify(["http://127.0.0.1/*"])) {
    findings.push(createLocalFinding({
      checkId: "browser-authority/terminal-authority",
      lawId,
      filePath: manifestPath,
      message: "The unpacked MV3 manifest must expose one bundled worker, one pairing popup and only the fixed loopback host permission.",
    }));
  }
};

const inspectBlueprintWorkspaceContract = (
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const blueprintLines = new Set(
    splitLines(readFileSync(resolveFromRepo(blueprintPath), "utf8")).map((line) => line.trim()),
  );
  const required = "- Workspace 和认证 certificate 不设置墙上时间到期，也不后台续期；普通空闲或长时间生产不能撤权。";
  if (blueprintLines.has(required)) return;
  findings.push(createLocalFinding({
    checkId: "browser-authority/terminal-authority",
    lawId,
    filePath: blueprintPath,
    message: "The Browser blueprint must require a connection-bound Workspace with no wall-clock expiry and contain no retired 8-hour TTL contract.",
  }));
};

const inspectAuthenticatedRuntimeRegressionGuards = (
  context: InspectorContext,
  findings: InspectorFinding[],
): void => {
  const transportLawId = selectLawId(context.planEntry.lawIds, "APEX-LOCAL-BROWSER-001-V4");
  const authLawId = selectLawId(context.planEntry.lawIds, "APEX-LOCAL-BROWSER-002-V4");
  const targetLawId = selectLawId(context.planEntry.lawIds, "APEX-LOCAL-BROWSER-003-V6");
  const channel = requireSource(context, findings, authLawId, sourcePaths[0]);
  const actor = requireSource(context, findings, authLawId, sourcePaths[1]);
  const crypto = requireSource(context, findings, authLawId, sourcePaths[20]);
  const upgrade = requireSource(context, findings, authLawId, sourcePaths[21]);
  const heartbeat = requireSource(context, findings, authLawId, sourcePaths[22]);
  const acceptance = requireSource(context, findings, authLawId, sourcePaths[15]);
  if (!channel || !actor || !crypto || !upgrade || !heartbeat || !acceptance) return;

  requireIdentifiers(crypto, ["aad", "protocolVersion", "kind", "epoch", "sequence", "deadline"], findings, authLawId,
    "Extension AES-GCM AAD must be reconstructed from the five authenticated header fields.");
  requireIdentifiers(channel, ["aadForFrame", "protocolVersion", "kind", "epoch", "sequence", "deadline"], findings, authLawId,
    "Workbench AES-GCM AAD must be reconstructed from the same five authenticated header fields.");
  requireIdentifiers(upgrade, ["decodeClientWebSocketFrames", "controlReplies", "closed", "encodeControlFrame"], findings, authLawId,
    "The sole WebSocket upgrader must distinguish text, ping/pong and close control frames.");
  requireIdentifiers(upgrade, ["writeBigUInt64BE", "readBigUInt64BE", "fragmentedMessage"], findings, transportLawId,
    "The sole WebSocket upgrader must carry owner-admitted payloads with RFC 6455 64-bit lengths and continuation reassembly.");
  requireIdentifiers(channel, ["sendTargetClaimAcknowledgement", "parseBrowserAuthorityTargetClaim", "nonNegativeIntegerField"], findings, targetLawId,
    "Workbench target admission must accept epoch zero and return one encrypted acknowledgement.");
  requireIdentifiers(actor, ["TargetClaimAwaiter", "targetClaims", "sendTargetFrame", "acceptTargetClaimAcknowledgement", "begin", "accept", "fail"], findings, targetLawId,
    "The extension must not report target success before the Workbench acknowledgement.");
  requireIdentifiers(heartbeat, ["startHeartbeat", "sendLivenessPulse", "getPlatformInfo"], findings, authLawId,
    "The MV3 heartbeat owner must invoke the Chrome API liveness pulse on the authenticated channel.");
  requireIdentifiers(actor, ["onSocketClosed", "releaseActiveTarget", "close", "reasonCode"], findings, authLawId,
    "The MV3 socket owner must release stale debugger state after disconnect and expose every programmatic close reason.");
  requireIdentifiers(actor, ["extensionCommandDiagnostic", "commandStage", "commandKind", "commandIntentKind", "capabilityId"], findings, authLawId,
    "Every authenticated command failure must emit a non-fatal redacted diagnostic with command-stage and capability identity.");
  requireIdentifiers(channel, ["commandStage", "commandKind", "commandIntentKind", "capabilityId"], findings, authLawId,
    "The Workbench authority socket must retain the redacted authenticated-command diagnostic fields.");
  if (!stringLiterals(actor).includes("HEARTBEAT")) findings.push(createLocalFinding({
    checkId: "browser-authority/terminal-authority", lawId: authLawId, filePath: sourcePaths[1],
    message: "The MV3 worker must send an authenticated HEARTBEAT liveness frame.",
  }));
  requireIdentifiers(acceptance, ["decrypt", "encrypt", "encryptBrowserAuthorityFrame", "decryptBrowserAuthorityFrame", "decodeClientWebSocketFrames", "parseBrowserAuthorityTargetClaim"], findings, targetLawId,
    "The local Browser terminal acceptance must retain the crypto, control-frame and epoch-zero regression probes.");
  const parseClaim = channel.getVariableDeclaration("parseBrowserAuthorityTargetClaim");
  const navigationEpoch = parseClaim?.getDescendantsOfKind(SyntaxKind.VariableDeclaration)
    .find((declaration) => declaration.getName() === "navigationEpoch");
  const initializer = navigationEpoch?.getInitializerIfKind(SyntaxKind.CallExpression)?.getExpression();
  if (!initializer || !Node.isIdentifier(initializer) || astIdentifierName(initializer) !== "nonNegativeIntegerField") {
    findings.push(createLocalFinding({
      checkId: "browser-authority/terminal-authority",
      lawId: targetLawId,
      filePath: sourcePaths[0],
      message: "The first target claim must parse navigationEpoch with the non-negative integer boundary so epoch zero remains valid.",
    }));
  }
};

const inspectRealChromeProofRoute = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const verifier = requireSource(context, findings, lawId, sourcePaths[24]);
  const supervisor = requireSource(context, findings, lawId, sourcePaths[3]);
  const journal = requireSource(context, findings, lawId, sourcePaths[7]);
  if (!verifier || !supervisor || !journal) return;
  requireIdentifiers(verifier, [
    "readBrowserProofJournal", "buildStartupSourceFingerprint",
    "GRASSEYE_UNPACKED_EXTENSION_ID", "releaseRecord", "candidateHash",
    "authenticated", "claimed", "completed", "revoked",
  ], findings, lawId, "The real-Chrome verifier must bind canonical journal bytes to current source and release identity.");
  requireIdentifiers(supervisor, ["BrowserProofJournal", "recordLifecycle"], findings, lawId,
    "The Browser supervisor must produce lifecycle facts in the canonical proof journal.");
  requireIdentifiers(journal, ["previousEntryHash", "entryHash", "fsyncSync"], findings, lawId,
    "The canonical Browser proof journal must be hash chained and durably appended.");
  const phases = new Set(stringLiterals(verifier));
  for (const phase of ["AUTHENTICATED", "TARGET_CLAIMED", "COMPLETED", "AUTHORITY_REVOKED"]) {
    if (phases.has(phase)) continue;
    findings.push(createLocalFinding({
      checkId: "browser-authority/terminal-authority", lawId, filePath: sourcePaths[24],
      message: `The real-Chrome verifier must require ${phase}.`,
    }));
  }
};

const inspectDomainEvaluation = async (context: InspectorContext): Promise<Omit<InspectorOutput, "executedChecks">> => {
  const lawId = selectLawId(context.planEntry.lawIds, "APEX-LOCAL-BROWSER-001-V4");
  const findings: InspectorFinding[] = [];
  for (const path of [lawPath, blueprintPath]) {
    if (!existsSync(resolveFromRepo(path))) {
      findings.push(createLocalFinding({
        checkId: "browser-authority/terminal-authority",
        lawId,
        filePath: path,
        message: `${path} must exist.`,
      }));
    }
  }
  for (const path of [...sourcePaths, targetAuthorityPath]) {
    if (context.project.getSourceFile(resolveFromRepo(path))) continue;
    findings.push(createLocalFinding({
      checkId: "browser-authority/terminal-authority",
      lawId,
      filePath: path,
      message: `${path} must exist in the ts-morph project.`,
    }));
  }
  inspectSingleTransport(context, findings, lawId);
  const workspaceLawId = selectLawId(context.planEntry.lawIds, "APEX-LOCAL-BROWSER-003-V6");
  inspectBlueprintWorkspaceContract(findings, workspaceLawId);
  inspectOperatorAdmission(context, findings, workspaceLawId);
  inspectRegistryAndMutationBoundary(context, findings, selectLawId(context.planEntry.lawIds, "APEX-LOCAL-BROWSER-004-V4"));
  inspectAuthenticatedRuntimeRegressionGuards(context, findings);
  inspectRealChromeProofRoute(context, findings, selectLawId(context.planEntry.lawIds, "APEX-LOCAL-BROWSER-005-V4"));
  findings.push(...collectTransportPayloadCeilingFindings(context, lawId));
  inspectReleaseAndRetiredPaths(findings, selectLawId(context.planEntry.lawIds, "APEX-LOCAL-BROWSER-005-V4"));
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [lawPath, blueprintPath, "src/lib/browser/chrome-extension/manifest.json", targetAuthorityPath, ...sourcePaths, ...retiredPaths].sort(),
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  if (!context.checks) throw new Error("local-browser-session requires a runner-owned check session.");
  await context.checks.runAll(async () => {
    const evaluation = await inspectDomainEvaluation(context);
    return {
      findings: evaluation.findings,
      evidenceRefs: [context.planEntry.ownerInspectorPath, ...evaluation.inspectedFiles],
    };
  });
  return context.checks.output();
};
