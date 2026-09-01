import assert from "../audit/shared/governance-exam-assert.js";
import { existsSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { Node, Project, SyntaxKind } from "ts-morph";

import { createWorkbenchAssembly } from "../../src/lib/local-runtime/workbench-assembly.js";

const repoRoot = resolve(import.meta.dirname, "../..");
const retiredPaths = [
  "src/lib/local-runtime/workbench-browser-support.ts",
] as const;

for (const retiredPath of retiredPaths) {
  assert.equal(existsSync(resolve(repoRoot, retiredPath)), false, `Retired Local Runtime path remains: ${retiredPath}`);
}

const project = new Project({ tsConfigFilePath: resolve(repoRoot, "tsconfig.json") });
const assemblySource = project.getSourceFile(resolve(repoRoot, "src/lib/local-runtime/workbench-assembly.ts"));
assert.ok(assemblySource, "Workbench assembly must remain a TypeScript source file.");
assert.equal(
  assemblySource.getImportDeclarations().some((declaration) =>
    declaration.getModuleSpecifierValue().includes("workbench-browser-support")),
  false,
  "Workbench assembly must not import a retired Browser support path.",
);
const forbiddenAssemblyIdentifiers = new Set(["acquireTargetLease", "tryAcquireTargetLease", "createTargetSession"]);
const presentAssemblyIdentifiers = new Set(assemblySource.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()));
for (const identifier of forbiddenAssemblyIdentifiers) {
  assert.equal(presentAssemblyIdentifiers.has(identifier), false, `Workbench assembly must not ${identifier}.`);
}
assert.equal(
  assemblySource.getDescendantsOfKind(SyntaxKind.NewExpression).some((expression) =>
    Node.isIdentifier(expression.getExpression()) && expression.getExpression().getText() === "BrowserInfrastructureSupervisor"),
  false,
  "Workbench assembly must receive Browser authority through its Local Runtime support boundary.",
);

const dataDir = await mkdtemp(join(tmpdir(), "grasseye-local-runtime-browser-authority-"));
const assembly = await createWorkbenchAssembly({
  dataDir,
  baseUrl: "http://127.0.0.1:0",
  platformTarget: "agent-shell",
});
try {
  assert.equal("acquireTargetLease" in assembly.browserAuthority, false, "Local Runtime must expose the Broker, not a cached target lease surface.");
  assert.equal("tryAcquireTargetLease" in assembly.browserAuthority, false, "Local Runtime must not offer startup target-lease probing.");
  assert.deepEqual(Object.keys(assembly.browserAuthority.health()).sort(), ["browserAuthority", "browserInfrastructure"]);
  assert.equal(assembly.browserAuthority.health().browserInfrastructure.ok, true, "Workbench infrastructure must start before the extension page channel connects.");
  assert.equal(assembly.browserAuthority.health().browserAuthority.ok, false, "Browser authority must remain absent until the exact extension authenticates through the Workbench page.");
  const pairing = assembly.browserAuthority.readOperatorPairingState();
  assert.equal(pairing.authority, "absent");
  assert.match(pairing.pairingSecret ?? "", /^[a-f0-9]{64}$/u, "Cold start must issue one memory-only 256-bit operator pairing secret.");
  assert.equal(JSON.stringify(assembly.browserAuthority.health()).includes(pairing.pairingSecret ?? ""), false, "Pairing secret must not enter health output.");
  assert.equal("approveSessionWorkspace" in assembly.browserAuthority, false, "Pair plus claim must be the only operator admission; a second workspace approval surface is forbidden.");
  assert.equal("videoDownload" in assembly, false, "Retired video-download must not remain in Workbench composition.");
  assert.equal("mediaProcessing" in assembly, false, "Retired generic media-processing must not remain in Workbench composition.");
} finally {
  await assembly.browserAuthority.shutdown();
}

console.log("LOCAL_RUNTIME_BROWSER_AUTHORITY_ACCEPTANCE_PASS");
