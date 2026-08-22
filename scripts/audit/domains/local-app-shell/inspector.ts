import { existsSync } from "node:fs";

import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { astIdentifierName } from "../../shared/ast-node-identity.js";
import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, InspectorOutput, SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { resolveFromRepo, toRepoPath } from "../../shared/paths.js";

const checkId = "local-app-shell/terminal-authority";
const laws = {
  upgrade: { lawId: "APEX-LOCAL-APP-SHELL-001-V2", clauseId: "apex-local-app-shell-001-v2-single-upgrade" },
  boundary: { lawId: "APEX-LOCAL-APP-SHELL-002-V2", clauseId: "apex-local-app-shell-002-v2-boundary" },
} as const;

const sourceAt = (context: InspectorContext, path: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(path));

const finding = (
  law: typeof laws.upgrade | typeof laws.boundary,
  filePath: string,
  message: string,
): InspectorFinding => createFinding({ checkId, lawId: law.lawId, clauseId: law.clauseId, filePath, message });

const imports = (file: SourceFile): readonly string[] =>
  file.getImportDeclarations().map((declaration) => declaration.getModuleSpecifierValue());

const identifiers = (file: SourceFile): ReadonlySet<string> =>
  new Set(file.getDescendantsOfKind(SyntaxKind.Identifier).map((identifier) => identifier.getText()));

const inspectDomainEvaluation = async (context: InspectorContext): Promise<Omit<InspectorOutput, "executedChecks">> => {
  const findings: InspectorFinding[] = [];
  const serverPath = "src/app/create-workbench-server.ts";
  const upgradePath = "src/app/workbench-browser-websocket-upgrade.ts";
  const shellPath = "src/app/workbench-home-page.ts";
  const server = sourceAt(context, serverPath);
  const upgrade = sourceAt(context, upgradePath);
  const shell = sourceAt(context, shellPath);

  if (!server) findings.push(finding(laws.upgrade, serverPath, "the unique App Server source is missing"));
  if (!upgrade) findings.push(finding(laws.upgrade, upgradePath, "the exact Browser Authority upgrade owner is missing"));
  if (server && !imports(server).some((value) => value.endsWith("workbench-browser-websocket-upgrade.js"))) {
    findings.push(finding(laws.upgrade, serverPath, "App Server must import the sole Browser Authority WebSocket upgrade owner"));
  }
  if (upgrade && !identifiers(upgrade).has("upgradeWorkbenchBrowserAuthoritySocket")) {
    findings.push(finding(laws.upgrade, upgradePath, "upgrade module must export the exact Browser Authority upgrade function"));
  }
  for (const retiredPath of [
    "src/app/workbench-browser-extension-channel-client.ts",
    "src/app/workbench-browser-extension-channel-routes.ts",
  ]) {
    if (existsSync(resolveFromRepo(retiredPath))) findings.push(finding(laws.upgrade, retiredPath, "retired App relay file remains physically present"));
  }

  if (!shell) {
    findings.push(finding(laws.boundary, shellPath, "Workbench home page source is missing"));
  } else {
    for (const name of ["BrowserAuthoritySocket", "BrowserCommandActor", "BrowserTargetLeaseManager"]) {
      if (identifiers(shell).has(name)) findings.push(finding(laws.boundary, toRepoPath(shell.getFilePath()), `App Shell cannot own Browser authority symbol ${name}`));
    }
    if (imports(shell).some((value) => value.includes("/browser/") && !value.endsWith("browser-authority-api.js"))) {
      findings.push(finding(laws.boundary, shellPath, "App Shell imports Browser private runtime instead of a narrow public status contract"));
    }
    const localStorageAccess = shell.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
      .some((expression) => Node.isIdentifier(expression.getExpression())
        && astIdentifierName(expression.getExpression()) === "localStorage");
    if (localStorageAccess) findings.push(finding(laws.boundary, shellPath, "App Shell cannot use localStorage as production truth"));
  }
  return {
    capabilityDomain: context.planEntry.capabilityDomain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [serverPath, upgradePath, shellPath],
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  if (!context.checks) throw new Error("local-app-shell requires a runner-owned check session.");
  await context.checks.runAll(async () => {
    const evaluation = await inspectDomainEvaluation(context);
    return { findings: evaluation.findings, evidenceRefs: [context.planEntry.ownerInspectorPath, ...evaluation.inspectedFiles] };
  });
  return context.checks.output({ reportMarkdown: "# Local App Shell terminal ownership\n\nOne runner-signed evaluation covers the sole WebSocket upgrade and the App Shell boundary." });
};
