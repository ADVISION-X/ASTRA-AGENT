import { existsSync, readFileSync } from "node:fs";

import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { astIdentifierName } from "../../shared/ast-node-identity.js";
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
  "src/lib/browser/exact-target/browser-evaluation-contract.ts",
  "src/lib/browser/exact-target/browser-native-transport-server.ts",
  "src/lib/browser/chrome-extension/service-worker.ts",
  "src/lib/browser/chrome-extension/service-worker-interaction-commands.ts",
  "src/lib/browser/chrome-extension/service-worker-keyboard.ts",
  "src/lib/browser/chrome-extension/atomic-dom-command.ts",
  "src/lib/browser/chrome-extension/service-worker-command-execution.ts",
  "src/lib/browser/chrome-extension/protocol.ts",
  "src/lib/browser/native-messaging-host/install.mjs"
] as const;

const add = (findings: InspectorFinding[], lawId: string, clauseId: string, filePath: string, message: string): void => {
  findings.push(createFinding({ checkId: "local-browser-session/owner-assertion-set", lawId, clauseId, filePath, message }));
};

const source = (context: InspectorContext, filePath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(filePath));

const stringLiterals = (sources: readonly (SourceFile | undefined)[]): Set<string> =>
  new Set(sources.flatMap((file) => file?.getDescendantsOfKind(SyntaxKind.StringLiteral)
    .map((node) => node.getLiteralText()) ?? []));

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
  const installer = source(context, "src/lib/browser/native-messaging-host/install.mjs");
  const ids = new Set([protocol, worker, transport, installer].flatMap((file) => file?.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()) ?? []));
  for (const required of ["GRASSEYE_BROWSER_PROTOCOL_VERSION", "GRASSEYE_NATIVE_HOST_NAME", "chrome", "debugger", "nonce", "commandId", "mutationClass"]) {
    if (!ids.has(required)) add(findings, lawId, clauseId, "src/lib/browser/chrome-extension/protocol.ts", `private transport AST is missing ${required}`);
  }
  for (const required of ["installedHostPath", "sourceHostPath", "execPath", "renderInstalledHost"]) {
    if (!ids.has(required)) add(findings, lawId, clauseId, "src/lib/browser/native-messaging-host/install.mjs", `Native host installer AST is missing ${required}`);
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

const inspectPluginOnlyFileActions = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const lawId = "APEX-LOCAL-BROWSER-003-V1";
  const clauseId = "apex-local-browser-003-requirement";
  const commandRuntime = source(context, "src/lib/browser/exact-target/browser-command-runtime.ts");
  const protocol = source(context, "src/lib/browser/chrome-extension/protocol.ts");
  const values = new Set([commandRuntime, protocol].flatMap((file) => [
    ...(file?.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()) ?? []),
    ...(file?.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()) ?? []),
  ]));
  for (const forbidden of ["PhysicalFocusLease", "focusLease", "focus_target", "native_file_picker", "os_pointer_action", "os_keyboard_action", "pasteFileFromSystemClipboard", "selectFilesInNativePicker"]) {
    if (values.has(forbidden)) add(findings, lawId, clauseId, "src/lib/browser/exact-target/browser-command-runtime.ts", `plugin-only Browser contract retains forbidden ${forbidden}`);
  }
  for (const retiredPath of ["src/lib/browser/exact-target/physical-focus-lease.ts", "src/lib/browser/current-chrome-native-multi-file-picker.ts"]) {
    if (existsSync(resolveFromRepo(retiredPath))) add(findings, lawId, clauseId, retiredPath, "retired physical-focus file action path must be absent");
  }
  inspectPhysicalActionOwnership(context, findings, lawId, clauseId);
};

const inspectRoundedClickCoordinates = (
  worker: SourceFile | undefined,
  findings: InspectorFinding[],
  lawId: string,
  clauseId: string,
  workerPath: string,
): void => {
  const roundedClickCoordinates = new Set(worker?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => {
      const expression = call.getExpression();
      return Node.isPropertyAccessExpression(expression) && expression.getName() === "round"
        && Node.isIdentifier(expression.getExpression()) && astIdentifierName(expression.getExpression()) === "Math";
    })
    .flatMap((call) => {
      const argument = call.getArguments()[0];
      if (!argument || !Node.isPropertyAccessExpression(argument)
        || !Node.isIdentifier(argument.getExpression()) || astIdentifierName(argument.getExpression()) !== "command") return [];
      return [argument.getName()];
    }) ?? []);
  for (const coordinate of ["x", "y"]) {
    if (!roundedClickCoordinates.has(coordinate)) {
      add(findings, lawId, clauseId, workerPath, `node-bound click must normalize command.${coordinate} to the integer CDP contract`);
    }
  }
};

const inspectWorkerCommandSurface = (
  worker: SourceFile | undefined,
  interaction: SourceFile | undefined,
  keyboard: SourceFile | undefined,
  findings: InspectorFinding[],
  lawId: string,
  clauseId: string,
  workerPath: string,
): void => {
  const workerEvaluate = worker?.getVariableDeclaration("evaluate")?.getInitializer();
  const workerHasPrivateEvaluator = Boolean(workerEvaluate?.getDescendantsOfKind(SyntaxKind.NewExpression).some((node) =>
    Node.isIdentifier(node.getExpression()) && astIdentifierName(node.getExpression()) === "Function")
    || workerEvaluate?.getDescendantsOfKind(SyntaxKind.CallExpression).some((node) =>
      Node.isIdentifier(node.getExpression()) && astIdentifierName(node.getExpression()) === "eval"));
  if (workerHasPrivateEvaluator) {
    add(findings, lawId, clauseId, workerPath, "MV3 evaluate must execute the normalized expression without a private evaluator or second wrapper");
  }
  const requiredCommands = stringLiterals([worker, interaction, keyboard]);
  for (const command of ["evaluate_target", "click_target", "click_dom_target", "fill_dom_target", "scroll_target", "text_target", "set_file_input_files"]) {
    if (!requiredCommands.has(command)) add(findings, lawId, clauseId, workerPath, `exact-target command surface is missing ${command}`);
  }
  for (const cdpMethod of ["DOM.getNodeForLocation", "DOM.resolveNode", "DOM.requestNode", "Runtime.callFunctionOn"]) {
    if (!requiredCommands.has(cdpMethod)) add(findings, lawId, clauseId, workerPath, `dedicated exact-target mutation is missing ${cdpMethod}`);
  }
};

const inspectTrustedAtomicFillLifecycle = (
  worker: SourceFile | undefined,
  atomicDom: SourceFile | undefined,
  findings: InspectorFinding[],
  lawId: string,
  clauseId: string,
  workerPath: string,
): void => {
  const atomicPath = "src/lib/browser/chrome-extension/atomic-dom-command.ts";
  const atomicCalls = new Set(atomicDom?.getVariableDeclaration("runAtomicDomFillKeyboardCommand")
    ?.getInitializer()?.getDescendantsOfKind(SyntaxKind.CallExpression).flatMap((call) => {
      const expression = call.getExpression();
      if (Node.isIdentifier(expression)) return [astIdentifierName(expression) ?? ""];
      return Node.isPropertyAccessExpression(expression) ? [expression.getName()] : [];
    }) ?? []);
  for (const required of ["atomicDomFillPreparationExpression", "pressBackspace", "typeCharacter", "atomicDomFillVerificationExpression"]) {
    if (!atomicCalls.has(required)) add(findings, lawId, clauseId, atomicPath, `trusted atomic fill lifecycle is missing ${required}`);
  }
  const forbiddenCalls = new Set(atomicDom?.getDescendantsOfKind(SyntaxKind.CallExpression).flatMap((call) => {
    const expression = call.getExpression();
    return Node.isPropertyAccessExpression(expression) ? [expression.getName()] : [];
  }) ?? []);
  for (const forbidden of ["dispatchEvent", "call"]) {
    if (forbiddenCalls.has(forbidden)) add(findings, lawId, clauseId, atomicPath, `atomic DOM fill retains synthetic mutation via ${forbidden}`);
  }
  const runAtomic = worker?.getVariableDeclaration("runAtomicDomPageCommand")?.getInitializer();
  const workerCalls = new Set(runAtomic?.getDescendantsOfKind(SyntaxKind.CallExpression).flatMap((call) => {
    const expression = call.getExpression();
    return Node.isIdentifier(expression) ? [astIdentifierName(expression) ?? ""] : [];
  }) ?? []);
  if (!workerCalls.has("runAtomicDomFillKeyboardCommand")) {
    add(findings, lawId, clauseId, workerPath, "fill_dom_target must invoke the one trusted atomic keyboard owner");
  }
};

const inspectAtomicDomCommandSurface = (
  worker: SourceFile | undefined,
  atomicDom: SourceFile | undefined,
  findings: InspectorFinding[],
  lawId: string,
  clauseId: string,
  workerPath: string,
): void => {
  const atomicLiterals = [
    ...(atomicDom?.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()) ?? []),
    ...(atomicDom?.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((node) => node.getLiteralText()) ?? []),
    ...(atomicDom?.getDescendantsOfKind(SyntaxKind.TemplateHead).map((node) => node.getLiteralText()) ?? []),
    ...(atomicDom?.getDescendantsOfKind(SyntaxKind.TemplateMiddle).map((node) => node.getLiteralText()) ?? []),
    ...(atomicDom?.getDescendantsOfKind(SyntaxKind.TemplateTail).map((node) => node.getLiteralText()) ?? []),
  ];
  for (const atomicSignal of [
    "TARGET_IDENTITY_CHANGED:atomic DOM identity no longer matches",
    "TARGET_VALUE_MISMATCH:atomic DOM fill did not retain exact approved text",
    "TARGET_COMPONENT_REJECTED:atomic DOM fill was not accepted by the component",
  ]) {
    if (!atomicLiterals.some((literal) => literal.includes(atomicSignal))) add(findings, lawId, clauseId, "src/lib/browser/chrome-extension/atomic-dom-command.ts", `atomic DOM command is missing ${atomicSignal}`);
  }
  inspectTrustedAtomicFillLifecycle(worker, atomicDom, findings, lawId, clauseId, workerPath);
  if (!worker?.getImportDeclaration((declaration) => declaration.getModuleSpecifierValue() === "./atomic-dom-command.js")) {
    add(findings, lawId, clauseId, workerPath, "MV3 worker must import the one atomic DOM command builder");
  }
};

const inspectWorkerTargetGuards = (
  worker: SourceFile | undefined,
  interaction: SourceFile | undefined,
  keyboard: SourceFile | undefined,
  findings: InspectorFinding[],
  lawId: string,
  clauseId: string,
  workerPath: string,
): void => {
  const requiredCommands = stringLiterals([worker, interaction, keyboard]);
  const userAgentShadowOptions = worker?.getDescendantsOfKind(SyntaxKind.PropertyAssignment)
    .filter((property) => property.getName() === "includeUserAgentShadowDOM") ?? [];
  if (userAgentShadowOptions.length !== 1 || userAgentShadowOptions[0]?.getInitializer()?.getKind() !== SyntaxKind.FalseKeyword) {
    add(findings, lawId, clauseId, workerPath, "node-bound click must exclude browser-owned UA shadow DOM while retaining author shadow targeting");
  }
  const governedInteractiveClick = "function(){ const owner=this.closest(\"button,a[href],input[type='button'],input[type='submit'],input[type='text'],[role='button'],kat-button\"); if(!owner)return {ok:false}; owner.focus(); owner.click(); return {ok:true}; }";
  if (!requiredCommands.has(governedInteractiveClick)
    || !requiredCommands.has("TARGET_NOT_FOUND:click point did not resolve to an interactive DOM owner")) {
    add(findings, lawId, clauseId, workerPath, "node-bound click must resolve one interactive DOM owner and fail closed when none exists");
  }
  const governedFileReceiver = "function(){ if(!(this instanceof HTMLInputElement)||this.type!=='file'||this.disabled)return null; let ancestor=this.parentElement; while(ancestor){ if(ancestor.shadowRoot){ const receivers=Array.from(ancestor.shadowRoot.querySelectorAll(\"input[type='file']\")).filter((input)=>!input.disabled); return receivers.length===1?receivers[0]:null; } ancestor=ancestor.parentElement; } return this; }";
  if (!requiredCommands.has(governedFileReceiver)) {
    add(findings, lawId, clauseId, workerPath, "file-input command must resolve one real author-shadow receiver before dispatch");
  }
};

const inspectWorkerRetiredPaths = (
  worker: SourceFile | undefined,
  interaction: SourceFile | undefined,
  keyboard: SourceFile | undefined,
  findings: InspectorFinding[],
  lawId: string,
  clauseId: string,
  workerPath: string,
): void => {
  const requiredCommands = stringLiterals([worker, interaction, keyboard]);
  for (const retired of [
    "function(){ return {ok:this instanceof HTMLInputElement&&this.type==='file'&&this.files?.length===1&&Boolean(this.files[0]?.name)}; }",
    "BROWSER_COMMAND_FAILED:real file receiver did not retain the approved file",
    "Input.insertText",
  ]) {
    if (requiredCommands.has(retired)) add(findings, lawId, clauseId, workerPath, `retired component commit shortcut remains: ${retired}`);
  }
  for (const keyboardEvent of ["rawKeyDown", "char", "keyUp"]) {
    if (!requiredCommands.has(keyboardEvent)) {
      add(findings, lawId, clauseId, workerPath, `text_target must dispatch ordered ${keyboardEvent} keyboard events`);
    }
  }
  inspectRoundedClickCoordinates(worker, findings, lawId, clauseId, workerPath);
};

type WorkerEvaluationInput = {
  atomicDom: SourceFile | undefined;
  clauseId: string;
  findings: InspectorFinding[];
  interaction: SourceFile | undefined;
  keyboard: SourceFile | undefined;
  lawId: string;
  worker: SourceFile | undefined;
  workerPath: string;
};

const inspectWorkerEvaluationContract = (input: WorkerEvaluationInput): void => {
  inspectWorkerCommandSurface(input.worker, input.interaction, input.keyboard, input.findings, input.lawId, input.clauseId, input.workerPath);
  inspectAtomicDomCommandSurface(input.worker, input.atomicDom, input.findings, input.lawId, input.clauseId, input.workerPath);
  inspectWorkerTargetGuards(input.worker, input.interaction, input.keyboard, input.findings, input.lawId, input.clauseId, input.workerPath);
  inspectWorkerRetiredPaths(input.worker, input.interaction, input.keyboard, input.findings, input.lawId, input.clauseId, input.workerPath);
};

const inspectEvaluationContract = (context: InspectorContext, findings: InspectorFinding[]): void => {
  const lawId = "APEX-LOCAL-BROWSER-004-V1";
  const clauseId = "apex-local-browser-004-requirement";
  const runtimePath = "src/lib/browser/exact-target/browser-command-runtime.ts";
  const contractPath = "src/lib/browser/exact-target/browser-evaluation-contract.ts";
  const workerPath = "src/lib/browser/chrome-extension/service-worker.ts";
  const interactionPath = "src/lib/browser/chrome-extension/service-worker-interaction-commands.ts";
  const keyboardPath = "src/lib/browser/chrome-extension/service-worker-keyboard.ts";
  const atomicDomPath = "src/lib/browser/chrome-extension/atomic-dom-command.ts";
  const runtime = source(context, runtimePath);
  const contract = source(context, contractPath);
  const worker = source(context, workerPath);
  const interaction = source(context, interactionPath);
  const keyboard = source(context, keyboardPath);
  const atomicDom = source(context, atomicDomPath);
  const evaluateMethod = runtime?.getClass("ExactBrowserTargetSession")?.getMethod("evaluate");
  const normalizerCalls = evaluateMethod?.getDescendantsOfKind(SyntaxKind.CallExpression).filter((call) =>
    Node.isIdentifier(call.getExpression()) && astIdentifierName(call.getExpression()) === "toBrowserEvaluationExpression") ?? [];
  if (normalizerCalls.length !== 1) add(findings, lawId, clauseId, runtimePath, "ExactBrowserTargetSession.evaluate must call the unique evaluation normalizer exactly once");
  const evaluateLiterals = new Set(evaluateMethod?.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()) ?? []);
  if (!evaluateLiterals.has("observation")) add(findings, lawId, clauseId, runtimePath, "evaluate_target must remain an observation command");
  if (!contract?.getVariableDeclaration("toBrowserEvaluationExpression")) add(findings, lawId, clauseId, contractPath, "the unique function-body evaluation normalizer is missing");
  inspectWorkerEvaluationContract({
    atomicDom, clauseId, findings, interaction, keyboard, lawId, worker, workerPath,
  });
};

const inspectDomainEvaluation = async (
  context: InspectorContext,
): Promise<Omit<InspectorOutput, "executedChecks">> => {
  const findings: InspectorFinding[] = [];
  inspectOwnerAst(context, findings);
  inspectTransport(context, findings);
  inspectPluginOnlyFileActions(context, findings);
  inspectEvaluationContract(context, findings);
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
