import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Project, SyntaxKind, Node } from "ts-morph";

import { inspectLocalAppShellProject } from "../audit/domains/local-app-shell/inspector.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import { getHealthReport } from "../../src/lib/local-runtime/workbench-status.js";
import { readHealth } from "../../src/lib/local-runtime/production/runtime-loops.js";
import { BrowserMutationStore } from "../../src/lib/browser/exact-target/browser-mutation-store.js";
import { BrowserLaneCoordinator } from "../../src/lib/browser/infrastructure/browser-lane-coordinator.js";
import { BrowserAuthorityBroker } from "../../src/lib/browser/infrastructure/browser-authority-broker.js";
import { BrowserAuthorityIssuer } from "../../src/lib/browser/infrastructure/browser-authority-issuer.js";
import { createBrowserInfrastructureState } from "../../src/lib/browser/infrastructure/browser-infrastructure-state.js";
import { BrowserAuthorityWebSocket } from "../../src/lib/browser/transport/browser-authority-websocket.js";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { HASH_A, shutdownRuntimeFixture } from "./agent-production-runtime-fixtures.js";
import { identity, terminalFact } from "./local-browser-mutation-store-support.js";

const paths = [
  "src/app/server.ts",
  "src/app/create-workbench-server.ts",
  "src/app/workbench-browser-websocket-upgrade.ts",
  "src/lib/local-runtime/workbench-handle.ts",
  "src/lib/local-runtime/workbench-status.ts",
  "src/lib/local-runtime/workbench.ts",
  "src/lib/local-runtime/production/runtime-startup.ts",
] as const;

const fixture = (): Project => {
  const project = new Project({ useInMemoryFileSystem: true });
  for (const path of paths) project.createSourceFile(path, readFileSync(path, "utf8"));
  return project;
};
const checkIds = (project: Project): string[] => inspectLocalAppShellProject(project).map((finding) => finding.message);
const isPropertyCall = (node: Node, name: string): boolean => {
  if (!Node.isCallExpression(node)) return false;
  const expression = node.getExpression();
  return Node.isPropertyAccessExpression(expression) && expression.getName() === name;
};

assert.deepEqual(inspectLocalAppShellProject(fixture()), [], "the current owner contract must be the golden fixture");

{
  const project = fixture();
  project.getSourceFileOrThrow("src/app/server.ts").addStatements("server.listen(4174, '127.0.0.1');");
  assert.ok(checkIds(project).some((message) => message.includes("HTTP listener count must be exactly one")));
}
{
  const project = fixture();
  const start = project.getSourceFileOrThrow("src/app/server.ts").getFunctionOrThrow("startLocalRuntime");
  const init = start.getDescendantsOfKind(SyntaxKind.CallExpression).find((call) => isPropertyCall(call, "init"));
  const guarded = init?.getAncestors().find((ancestor) => isPropertyCall(ancestor, "catch"));
  guarded?.replaceWithText("workbench.init()");
  assert.ok(checkIds(project).some((message) => message.includes("initialization failure must be caught")));
}
{
  const project = fixture();
  project.getSourceFileOrThrow("src/lib/local-runtime/workbench-handle.ts").addTypeAlias({
    name: "ForbiddenBrowserControl",
    type: "{ selector: string }",
  });
  const findings = inspectLocalAppShellProject(project);
  assert.ok(findings.some((finding) => finding.lawId === "LAW-LOCAL-APP-SHELL-002-V3"
    && finding.message.includes("browser control field selector")));
}
{
  const project = fixture();
  const source = project.getSourceFileOrThrow("src/lib/local-runtime/workbench-status.ts");
  const property = source.getDescendantsOfKind(SyntaxKind.PropertySignature).find((item) => item.getName() === "executionState");
  property?.remove();
  const findings = inspectLocalAppShellProject(project);
  assert.ok(findings.some((finding) => finding.lawId === "LAW-LOCAL-APP-SHELL-003-V4"
    && finding.message.includes("executionState must remain an independently typed status dimension")));
}
{
  const project = fixture();
  const owner = project.getSourceFileOrThrow("src/lib/local-runtime/production/runtime-startup.ts");
  owner.replaceWithText(owner.getFullText().replaceAll('shellState: "ready"', 'shellState: "stopped"'));
  assert.ok(checkIds(project).some((message) => message.includes("must keep Shell ready")));
}
{
  const project = fixture();
  project.getSourceFileOrThrow("src/lib/local-runtime/workbench.ts")
    .addStatements("setInterval(() => workbench.getHealth(), 1000);");
  const findings = inspectLocalAppShellProject(project);
  assert.ok(findings.some((finding) => finding.lawId === "LAW-LOCAL-APP-SHELL-003-V4"
    && finding.message.includes("operator-refresh only")));
}

const healthDirectory = mkdtempSync(path.join(tmpdir(), "local-shell-health-"));
const runtimeStore = new ProductionRuntimeStore(healthDirectory);
const mutationStore = new BrowserMutationStore(path.join(healthDirectory, "browser"));
mutationStore.verifyRuntimeTaskProvenance(null);
let actions = 0;
const forbiddenAction = (): never => { actions += 1; throw new Error("HEALTH_READ_MUTATION"); };
const issuer = new BrowserAuthorityIssuer();
const broker = new BrowserAuthorityBroker(issuer, forbiddenAction, forbiddenAction);
const websocket = new BrowserAuthorityWebSocket({
  pairingSecret: null, onPairingStarted: forbiddenAction, onHeartbeat: forbiddenAction,
  onAuthenticated: forbiddenAction, onMutationReceipt: forbiddenAction,
  onTargetClaim: forbiddenAction, onTargetRevoke: forbiddenAction,
  onDiagnostic: forbiddenAction, onRevoked: forbiddenAction,
});
const infrastructure = createBrowserInfrastructureState();
infrastructure.mutationState = mutationStore;
const lane = new BrowserLaneCoordinator(() => broker, websocket, issuer, infrastructure);
let authority: "present" | "absent" = "present";
let writable = true;
const runtimeLogger = Object.assign(createRuntimeLogger({
  producer: "shell-health-exam", owner: "production-runtime", component: "shell-health",
  terminalEnabled: false, fileSink: { directoryPath: path.join(healthDirectory, "logs") },
}), { isWritable: () => writable, getSinkState: (): "ready" | "failed" => writable ? "ready" : "failed" });
const state = shutdownRuntimeFixture({ store: runtimeStore, dataDir: healthDirectory, runtimeLogger,
  browser: {
    broker: { currentStatus: () => ({ kind: "AVAILABLE", certificateHash: HASH_A,
      authorityRefHash: HASH_A, channelSessionHash: HASH_A }) },
    readProductionRuntimeState: () => ({ browserAuthorityState: authority, browserTargetState: "absent" }),
    readBrowserLaneState: () => lane.readState(),
    acquireJobBoundTargetLease: forbiddenAction, acceptBrowserAuthoritySocket: forbiddenAction,
  },
});
state.session.request = forbiddenAction;
const report = () => getHealthReport({ browserAuthority: state.browserAuthority },
  { status: "ready", failureReason: null }, readHealth(state));
try {
  for (const busy of [false, true]) {
    Reflect.set(lane, "active", busy);
    const current = await report();
    assert.equal(current.components.find(component => component.name === "productionRuntimeBrowser")?.ok, true);
    assert.equal(current.components.find(component => component.name === "productionRuntimeExecution")?.ok, true);
    assert.match(current.components.find(component => component.name === "productionRuntimeBrowser")!.detail!, /target=absent/u);
  }
  Reflect.set(lane, "active", false);
  const command = identity("shell-unresolved-command", "shell-original-attempt");
  mutationStore.prepare(command); mutationStore.markDispatched(command.commandId);
  const before = mutationStore.readCommand(command.commandId);
  const blocked = await report();
  for (const name of ["productionRuntimeBrowser", "productionRuntimeExecution"]) {
    assert.equal(blocked.components.find(component => component.name === name)?.ok, true,
      "an old unresolved WAL row must not make the current shared lane unavailable");
  }
  assert.equal(blocked.status, "healthy", "overall health retains the Shell/Cloud diagnostic definition");
  assert.equal(lane.readState(), "idle");
  assert.equal(mutationStore.readCommand(command.commandId)?.state, "DISPATCHED",
    "shared readiness must preserve the unknown old command without fabricating its receipt");
  assert.deepEqual(mutationStore.readCommand(command.commandId), before);
  mutationStore.settleTerminalReceipt(terminalFact(command));
  assert.equal((await report()).components.find(component => component.name === "productionRuntimeExecution")?.ok, true);
  for (const dependency of ["authority", "log", "cloud", "draining"] as const) {
    authority = dependency === "authority" ? "absent" : "present";
    writable = dependency !== "log";
    state.lastErrorCode = dependency === "cloud" ? "AI_SESSION_BINDING_MISMATCH" : null;
    state.draining = dependency === "draining";
    const current = await report();
    assert.equal(current.components.find(component => component.name === "productionRuntimeShell")?.ok, true);
    assert.equal(current.components.find(component => component.name === "productionRuntimeExecution")?.ok, false);
    assert.equal(current.status, dependency === "cloud" ? "degraded" : "healthy");
    if (dependency === "authority") assert.match(current.components.find(component =>
      component.name === "productionRuntimeBrowser")!.actionableMessage!, /authenticated Browser Authority/u);
    if (dependency === "cloud") assert.match(current.components.find(component =>
      component.name === "agentCloudWorker")!.actionableMessage!, /enrolled device/u);
    assert.doesNotMatch(current.components.find(component =>
      component.name === "productionRuntimeExecution")!.actionableMessage!, /missing.*receipt/iu);
  }
  assert.equal(actions, 0, "diagnostic reading must not pair, claim, acquire or write to the Website");
  assert.equal(mutationStore.countDispatched(), 0);
} finally {
  mutationStore.close(); runtimeStore.close(); rmSync(healthDirectory, { recursive: true, force: true });
}

console.log("local-app-shell-acceptance-ok");
emitQualityProofObservation({ lawId: "LAW-LOCAL-APP-SHELL-001-V6", evidenceMode: "exam.golden", clauses: ["forbidden:0","forbidden:1","forbidden:2","forbidden:3","forbidden:5","forbidden:6","summary"], locator: "acceptance:local-shell:single-owned-shell", observedValue: "single repository-owned Shell health boundary verified" });
emitQualityProofObservation({ lawId: "LAW-LOCAL-APP-SHELL-002-V3", evidenceMode: "exam.golden", clauses: ["forbidden:0","forbidden:1","forbidden:2","forbidden:3","summary"], locator: "acceptance:local-shell:boundary-mutants", observedValue: "foreign and duplicate Shell boundary mutants rejected" });
emitQualityProofObservation({ lawId: "LAW-LOCAL-APP-SHELL-003-V4", evidenceMode: "exam.golden", clauses: ["forbidden:2","summary"], locator: "acceptance:local-shell:degraded-readiness", observedValue: "execution dependency failure keeps diagnostic Shell ready" });
