import path from "node:path";
import { pathToFileURL } from "node:url";

import { runCommand } from "./command-runner.mjs";
import { getRepoRoot } from "./path-policy.mjs";

const RESULT_MARKER = "DEBUG_LOOP_SCENARIO_RESULT:";

function toImportHref(relativePath) {
  return pathToFileURL(path.join(getRepoRoot(), relativePath)).href;
}

function buildSnippetPreamble(scenario) {
  return [
    `const scenario = ${JSON.stringify(scenario)};`,
    `const RESULT_MARKER = ${JSON.stringify(RESULT_MARKER)};`,
    "const emit = (result) => console.log(RESULT_MARKER + JSON.stringify(result));",
    "const createId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;",
    "const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));",
    "const baseOptions = { baseUrl: 'http://127.0.0.1:4173', platformTarget: scenario.platformId, browserHeadless: typeof scenario.browserHeadless === 'boolean' ? scenario.browserHeadless : scenario.scenarioKind === 'local-workbench' };",
  ].join("\n");
}

function buildLocalWorkbenchSnippet(scenario) {
  return [
    buildSnippetPreamble(scenario),
    `const { createWorkbenchRuntime } = await import(${JSON.stringify(toImportHref("src/lib/local-runtime/workbench-runtime.ts"))});`,
    `const { listCapabilityRoster } = await import(${JSON.stringify(toImportHref("src/lib/local-runtime/workbench-status.ts"))});`,
    "const runtime = createWorkbenchRuntime(baseOptions);",
    "await runtime.init();",
    "const health = await runtime.getHealthReport();",
    "const roster = await listCapabilityRoster();",
    "const runtimeEvents = await runtime.listRuntimeDebugEvents(200);",
    "const passed = health.status === 'ready' && roster.length > 0;",
    "emit({ status: passed ? 'PASS' : 'FAIL', scenarioId: scenario.scenarioId, successSignals: passed ? ['startupStatus=ready', 'abilityRegistryLoaded=true'] : [], blockingSignals: [], startupStatus: health.status, abilityRegistryLoaded: roster.length > 0, runtimeEvents, rootCause: health.actionableMessage });",
  ].join("\n");
}

function buildPlatformAuthSnippet(scenario) {
  return [
    buildSnippetPreamble(scenario),
    "import path from 'node:path';",
    `const { createLocalBrowserSessionConfig } = await import(${JSON.stringify(toImportHref("src/lib/browser/local-browser-session.ts"))});`,
    `const { CurrentChromeBrowserController } = await import(${JSON.stringify(toImportHref("src/lib/browser/current-chrome-browser-controller.ts"))});`,
    "const sessionConfig = createLocalBrowserSessionConfig({ platform: scenario.platformId });",
    "const controller = new CurrentChromeBrowserController({ sessionConfig, screenshotDir: path.join(process.cwd(), '.debug-loop', 'browser-captures') });",
    "const targetUrl = scenario.platformId === 'facebook-web' ? 'https://www.facebook.com/reel/' : 'https://www.tiktok.com/foryou';",
    "await controller.open({ url: targetUrl, title: scenario.platformId === 'facebook-web' ? 'Facebook Reels' : 'TikTok For You' });",
    "const session = controller.getSessionState();",
    "const classification = session.loginState === 'logged_in' ? 'platform_feed' : session.loginState === 'login_required' ? 'login_wall' : 'security_wall';",
    "const blockingSignals = [];",
    "if (session.profileStatus === 'profile_missing' || session.profileVerificationStatus === 'default_unverified') blockingSignals.push('PROFILE_INVALID');",
    "else if (/session/i.test(session.loginRequiredReason ?? '')) blockingSignals.push('SESSION_EXPIRED');",
    "else if (session.loginState === 'review_required' || ['captcha_wall', 'permission_wall', 'security_wall'].includes(classification)) blockingSignals.push(classification === 'captcha_wall' ? 'CAPTCHA_REQUIRED' : 'SECURITY_CHECK_REQUIRED');",
    "else if (session.loginState !== 'logged_in' || classification === 'login_wall') blockingSignals.push('AUTH_REQUIRED');",
    "const passed = classification === 'platform_feed' && session.loginState === 'logged_in';",
    "emit({ status: passed ? 'PASS' : blockingSignals.length > 0 ? 'BLOCKED' : 'FAIL', scenarioId: scenario.scenarioId, successSignals: passed ? ['authStatus=AUTH_OK', 'pageState=platform_ready'] : [], blockingSignals, authStatus: passed ? 'AUTH_OK' : blockingSignals[0] ?? null, pageState: classification === 'platform_feed' ? 'platform_ready' : classification, browserSession: session, runtimeEvents: [], rootCause: session.reviewRequiredReason ?? session.loginRequiredReason ?? null });",
  ].join("\n");
}

function buildMissionRuntimeSnippet(scenario) {
  return [
    buildSnippetPreamble(scenario),
    `const { createWorkbenchRuntime } = await import(${JSON.stringify(toImportHref("src/lib/local-runtime/workbench-runtime.ts"))});`,
    `const { resolveMissionStartBinding } = await import(${JSON.stringify(toImportHref("src/lib/local-app-shell/task-start-binding.ts"))});`,
    "const runtime = createWorkbenchRuntime(baseOptions);",
    "await runtime.init();",
    "const binding = resolveMissionStartBinding({ taskTemplateId: scenario.mapRequirement?.taskTemplateId ?? null, requestedPlatformId: scenario.platformId, selectedMapId: null });",
    "if (!binding.ok) { emit({ status: 'BLOCKED', scenarioId: scenario.scenarioId, successSignals: [], blockingSignals: ['BLOCKED_NO_ACTIVE_MAP'], runtimeEvents: [], rootCause: binding.failureReason }); process.exit(2); }",
    "const preflight = await runtime.getMissionStartPreflight({ requestedPlatformId: binding.requestedPlatformId, selectedMapId: binding.selectedMapId });",
    "if (preflight.status === 'blocked') { emit({ status: 'BLOCKED', scenarioId: scenario.scenarioId, successSignals: [], blockingSignals: [preflight.failureReason ?? 'MISSION_PREFLIGHT_BLOCKED'], runtimeEvents: [], rootCause: preflight.actionableMessage }); process.exit(2); }",
    "const initialPayload = { kind: 'start-mission', requestedBy: 'commander-console', requestedPlatformId: binding.requestedPlatformId, selectedMapId: binding.selectedMapId, taskTemplateId: binding.taskTemplateId, activationId: binding.activationId, ...(scenario.humanGoal ? { humanGoal: scenario.humanGoal } : {}), ...(scenario.operatorNote ? { operatorNote: scenario.operatorNote } : {}), ...(scenario.targetUrl ? { targetUrl: scenario.targetUrl } : {}), ...(scenario.targetTitle ? { targetTitle: scenario.targetTitle } : {}), ...(scenario.sourceEvidenceRef ? { sourceEvidenceRef: scenario.sourceEvidenceRef } : {}), ...(scenario.sourceTargetRef ? { sourceTargetRef: scenario.sourceTargetRef } : {}), ...(scenario.promptInputRef ? { promptInputRef: scenario.promptInputRef } : {}), ...(scenario.commandInputRef ? { commandInputRef: scenario.commandInputRef } : {}) };",
    "const dispatch = await runtime.commanderConsole.execute({ childCapabilityId: 'issue-human-command', operatorRef: 'debug-loop:scenario-runner', input: { commandType: 'start-mission', requestedPlatformId: binding.requestedPlatformId, selectedMapId: binding.selectedMapId, humanGoal: scenario.humanGoal ?? null, operatorNote: scenario.operatorNote ?? null, initialPayload } });",
    "const readDashboard = async () => {",
    "  const result = await runtime.commanderConsole.execute({ childCapabilityId: 'show-mission-dashboard', operatorRef: 'debug-loop:scenario-runner', input: {} });",
    "  if (result.status !== 'success' || result.output === null) {",
    "    return { mission: { status: 'failed', failureReason: result.failureReason ?? result.reviewRequiredReason ?? 'Failed to read mission dashboard.', reviewRequiredReason: result.reviewRequiredReason ?? null }, evidencePackets: [], reviewQueue: [] };",
    "  }",
    "  return result.output;",
    "};",
    "let dashboard = await readDashboard();",
    "let mission = dashboard.mission;",
    "const deadline = Date.now() + scenario.maxRuntimeMs;",
    "while (Date.now() < deadline && (mission.status === 'idle' || mission.status === 'pending' || mission.status === 'running')) { await wait(500); dashboard = await readDashboard(); mission = dashboard.mission; }",
    "const runtimeEvents = await runtime.listRuntimeDebugEvents(400);",
    "const evidenceCreated = Array.isArray(dashboard.evidencePackets) && dashboard.evidencePackets.length > 0;",
    "const reviewBlockingSignal = scenario.reviewRequiredBlockingSignal ?? 'MISSION_REVIEW_REQUIRED';",
    "const blockingSignals = mission.status === 'review_required' || (Array.isArray(dashboard.reviewQueue) && dashboard.reviewQueue.length > 0) ? [reviewBlockingSignal] : [];",
    "const passed = mission.status === 'completed' && evidenceCreated;",
    "emit({ status: passed ? 'PASS' : blockingSignals.length > 0 ? 'BLOCKED' : 'FAIL', scenarioId: scenario.scenarioId, successSignals: passed ? ['missionStatus=completed', 'forensicsEvidencePacketCreated=true'] : [], blockingSignals, missionStatus: mission.status, forensicsEvidencePacketCreated: evidenceCreated, runtimeEvents, rootCause: dispatch.failureReason ?? dispatch.reviewRequiredReason ?? mission.failureReason ?? mission.reviewRequiredReason ?? null });",
  ].join("\n");
}

function buildScenarioSnippet(scenario) {
  if (scenario.scenarioKind === 'local-workbench') {
    return buildLocalWorkbenchSnippet(scenario);
  }
  if (scenario.scenarioKind === 'platform-auth-check') {
    return buildPlatformAuthSnippet(scenario);
  }
  if (scenario.scenarioKind === 'mission-runtime') {
    return buildMissionRuntimeSnippet(scenario);
  }

  return [buildSnippetPreamble(scenario), "emit({ status: 'FAIL', scenarioId: scenario.scenarioId, successSignals: [], blockingSignals: [], runtimeEvents: [], rootCause: `Scenario kind ${scenario.scenarioKind} is not implemented.` });"].join("\n");
}

function extractScenarioResult(stdout, stderr) {
  const markerLine = stdout.split(/\r?\n/).reverse().find((line) => line.startsWith(RESULT_MARKER));
  if (!markerLine) {
    return { status: 'FAIL', successSignals: [], blockingSignals: [], runtimeEvents: [], rootCause: stderr || 'Scenario result marker missing.' };
  }

  return JSON.parse(markerLine.slice(RESULT_MARKER.length));
}

export async function publishScenarioTask(input) {
  const snippet = buildScenarioSnippet(input.scenario);
  const commandResult = await runCommand(process.execPath, ["--import", "tsx", "--input-type=module", "-e", snippet], {
    cwd: getRepoRoot(),
    timeoutMs: (input.scenario.maxRuntimeMs ?? 120000) + 30000,
  });

  return {
    commandResult,
    scenarioResult: extractScenarioResult(commandResult.stdout, commandResult.stderr),
  };
}