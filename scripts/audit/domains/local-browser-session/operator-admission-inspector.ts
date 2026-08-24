import { SyntaxKind, type SourceFile } from "ts-morph";

import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";
import {
  createLocalFinding,
  identifiers,
  propertyValue,
  requireSource,
  sourcePaths,
  stringLiterals,
} from "./inspector-support.js";

type OperatorAdmissionSources = Readonly<{
  supervisor: SourceFile;
  workspace: SourceFile;
  support: SourceFile;
  handle: SourceFile;
  boundary: SourceFile;
  server: SourceFile;
  commandBar: SourceFile;
  client: SourceFile;
}>;

const requireOperatorAdmissionSources = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): OperatorAdmissionSources | null => {
  const selected = [
    sourcePaths[3],
    sourcePaths[4],
    sourcePaths[9],
    sourcePaths[10],
    sourcePaths[11],
    sourcePaths[12],
    sourcePaths[13],
    sourcePaths[14],
  ] as const;
  const sources = selected.map((path) => requireSource(context, findings, lawId, path));
  if (sources.some((source) => source === null)) return null;
  const [supervisor, workspace, support, handle, boundary, server, commandBar, client] = sources as SourceFile[];
  return { supervisor: supervisor!, workspace: workspace!, support: support!, handle: handle!, boundary: boundary!, server: server!, commandBar: commandBar!, client: client! };
};

const inspectRequiredIdentifiers = (
  sources: OperatorAdmissionSources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const requiredIdentifiers = new Map<SourceFile, readonly string[]>([
    [sources.supervisor, ["readOperatorPairingState", "establishClaimBoundWorkspace", "onTargetClaim"]],
    [sources.support, ["readOperatorPairingState"]],
    [sources.handle, ["readBrowserAuthorityPairingState"]],
    [sources.server, ["readBrowserAuthorityPairingState"]],
  ]);
  for (const [source, required] of requiredIdentifiers) {
    const sourceIdentifiers = identifiers(source);
    for (const identifier of required) {
      if (sourceIdentifiers.has(identifier)) continue;
      findings.push(createLocalFinding({
        checkId: "browser-authority/terminal-authority",
        lawId,
        filePath: source.getFilePath().slice(resolveFromRepo("").length + 1),
        message: `The operator admission chain must contain ${identifier}.`,
      }));
    }
  }
};

const inspectForbiddenApprovalIdentifiers = (
  sources: OperatorAdmissionSources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const forbiddenNames = [
    "approveSessionWorkspace",
    "installSessionWorkspaceApproval",
    "approveBrowserSessionWorkspace",
    "approveBrowserWorkspace",
  ] as const;
  for (const source of Object.values(sources)) {
    const sourceIdentifiers = identifiers(source);
    for (const forbidden of forbiddenNames) {
      if (!sourceIdentifiers.has(forbidden)) continue;
      findings.push(createLocalFinding({
        checkId: "browser-authority/terminal-authority",
        lawId,
        filePath: source.getFilePath().slice(resolveFromRepo("").length + 1),
        message: `Pair plus claim is the only admission; ${forbidden} is a forbidden second approval surface.`,
      }));
    }
  }
};

const inspectWorkspaceShape = (
  sources: OperatorAdmissionSources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const workspaceClass = sources.workspace.getClass("BrowserSessionWorkspace");
  const names = identifiers(sources.workspace);
  const invalid = !names.has("SessionWorkspaceBindingV6")
    || !workspaceClass?.getMethod("belongsTo")
    || Boolean(workspaceClass.getMethod("renew"))
    || names.has("expiresAt")
    || names.has("eightHoursMs");
  if (!invalid) return;
  findings.push(createLocalFinding({
    checkId: "browser-authority/terminal-authority",
    lawId,
    filePath: sourcePaths[4],
    message: "Session Workspace must be claim-bound to the current authority/connection and must not contain a wall-clock expiry or renewal path.",
  }));
};

const inspectPairingRoute = (
  sources: OperatorAdmissionSources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const routeRules = sources.boundary.getVariableDeclaration("WORKBENCH_API_ROUTE_RULES")
    ?.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression)
    ?.getElements()
    .filter((node): node is import("ts-morph").ObjectLiteralExpression => node.getKind() === SyntaxKind.ObjectLiteralExpression) ?? [];
  const rule = routeRules.find((candidate) => propertyValue(candidate, "path") === "/api/browser-authority/pairing");
  if (rule && propertyValue(rule, "method") === "GET"
    && propertyValue(rule, "localUiAllowed") === true
    && propertyValue(rule, "externalApiAllowed") === false) return;
  findings.push(createLocalFinding({
    checkId: "browser-authority/terminal-authority",
    lawId,
    filePath: sourcePaths[11],
    message: "GET /api/browser-authority/pairing must be local-UI-only and unavailable to external websites.",
  }));
};

const inspectRemovedWorkspaceSurface = (
  sources: OperatorAdmissionSources,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const literals = [sources.boundary, sources.server, sources.commandBar, sources.client]
    .flatMap(stringLiterals);
  if (literals.includes("/api/browser-authority/workspace")
    || literals.includes("data-browser-workspace")) findings.push(createLocalFinding({
    checkId: "browser-authority/terminal-authority",
    lawId,
    filePath: sourcePaths[11],
    message: "The separate Session Workspace approval route and UI must be physically absent.",
  }));
  if (!sources.commandBar.getVariableDeclaration("renderCommandBar")
    || !sources.client.getVariableDeclaration("WORKBENCH_HOME_CLIENT")) findings.push(createLocalFinding({
    checkId: "browser-authority/terminal-authority",
    lawId,
    filePath: sourcePaths[13],
    message: "Workbench must retain one typed command-bar renderer and one bundled client surface for operator admission actions.",
  }));
};

export const inspectOperatorAdmission = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const sources = requireOperatorAdmissionSources(context, findings, lawId);
  if (!sources) return;
  inspectRequiredIdentifiers(sources, findings, lawId);
  inspectForbiddenApprovalIdentifiers(sources, findings, lawId);
  inspectWorkspaceShape(sources, findings, lawId);
  inspectPairingRoute(sources, findings, lawId);
  inspectRemovedWorkspaceSurface(sources, findings, lawId);
};
