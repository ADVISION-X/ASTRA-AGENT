import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Node, Project, SyntaxKind } from "ts-morph";
import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { sourceFor } from "./gpt-inspection-support.js";

const LAW_ID = "LAW-GPT-002-V35", ROOT = "src/capabilities/gpt";
const compact = (source: string): string => source.replace(/\s+/gu, "");
const responseSyntax = (node: Node): string => {
  const visit = (current: Node): unknown => {
    const children = current.forEachChildAsArray();
    const literal = Node.isStringLiteral(current) ? current.getLiteralValue() : children.length ? null : current.getText();
    const declaration = Node.isVariableDeclarationList(current) ? current.getDeclarationKind() : null;
    return [current.getKind(), literal, declaration, children.map(visit)];
  };
  return JSON.stringify(visit(node));
};
const expressionMatches = (node: Node | undefined, expected: string): boolean => {
  if (!node) return false;
  const project = new Project({ useInMemoryFileSystem: true });
  const reference = project.createSourceFile("predicate.ts", `const predicate = ${expected};`).getVariableDeclarationOrThrow("predicate").getInitializerOrThrow();
  return responseSyntax(node) === responseSyntax(reference);
};
const statementMatches = (node: Node | undefined, expected: string): boolean => {
  if (!node) return false;
  const project = new Project({ useInMemoryFileSystem: true });
  const statements = project.createSourceFile("statement.ts", expected).getStatements();
  return statements.length === 1 && responseSyntax(node) === responseSyntax(statements[0]!);
};
const arrowFor = (source: import("ts-morph").SourceFile, name: string) => {
  const node = source.getVariableDeclaration(name)?.getInitializer();
  return Node.isArrowFunction(node) ? node : undefined;
};
const blockStatements = (node: Node | undefined) => Node.isBlock(node) ? node.getStatements() : [];
const argumentsFor = (node: Node | undefined, callee: string): Node[] =>
  Node.isCallExpression(node) && node.getExpression().getText() === callee ? node.getArguments() : [];
const propertyValue = (node: Node | undefined, key: string): Node | undefined => {
  const property = Node.isObjectLiteralExpression(node) ? node.getProperty(key) : undefined;
  return Node.isPropertyAssignment(property) ? property.getInitializer()
    : Node.isShorthandPropertyAssignment(property) ? property.getNameNode() : undefined;
};
const objectMatches = (node: Node | undefined, fields: Readonly<Record<string, string>>): boolean => {
  if (!Node.isObjectLiteralExpression(node) || node.getProperties().length !== Object.keys(fields).length) return false;
  return Object.entries(fields).every(([name, expected]) => name === "..."
    ? node.getProperties().filter(Node.isSpreadAssignment).length === 1
      && expressionMatches(node.getProperties().find(Node.isSpreadAssignment)?.getExpression(), expected)
    : expressionMatches(propertyValue(node, name), expected));
};
const settledResponseIsDirect = (source: import("ts-morph").SourceFile): boolean => {
  const settled = arrowFor(source, "settledTextResponse"), args = argumentsFor(settled?.getBody(), "success");
  const result = args[0], value = propertyValue(result, "value");
  const spread = Node.isObjectLiteralExpression(result) ? result.getProperties().find(Node.isSpreadAssignment)?.getExpression() : undefined;
  const facts = argumentsFor(spread, "declaredFacts")[0];
  return args.length === 1 && settled?.getParameters().map(p => p.getName()).join() === "assistant"
    && Node.isObjectLiteralExpression(result) && result.getProperties().length === 2
    && objectMatches(value, Object.fromEntries(["assistantTurnId", "rawDomHtml", "rawDomHash", "semanticText", "semanticTextHash"].map(key => [key, `assistant.${key}`])))
    && objectMatches(facts, { "...": "projectExactAssistantTurn(assistant)", decision: '"DONE"', mutationOutcome: '"no"', browserFact: "null", nativeFailureCode: "null" });
};
const inputAndObservationAreBound = (source: import("ts-morph").SourceFile): boolean => {
  const input = blockStatements(arrowFor(source, "checkpointInput")?.getBody());
  const gate = blockStatements(arrowFor(source, "requireObservationGate")?.getBody());
  return input.length === 7 && gate.length === 3
    && statementMatches(input[0], 'requireExactInputKeys(intent, ["canonicalConversationUrl", "probeBudgetMs", "turnMarker", "userTurnId"]);')
    && statementMatches(input[1], 'const conversationUrl = canonicalGptConversationUrl(stringInput(intent, "canonicalConversationUrl"));')
    && statementMatches(input[2], 'const turnMarker = stringInput(intent, "turnMarker");')
    && statementMatches(input[3], 'const userTurnId = stringInput(intent, "userTurnId");')
    && statementMatches(input[4], 'const probeBudgetMs = numberInput(intent, "probeBudgetMs");')
    && statementMatches(input[5], 'if (!Number.isSafeInteger(probeBudgetMs) || probeBudgetMs < 1 || probeBudgetMs > 3_600_000) throw executionFailure("failed", "GPT_RESPONSE_PROBE_BUDGET_INVALID");')
    && statementMatches(input[6], "return { conversationUrl, userTurnId, turnMarker, probeBudgetMs };")
    && statementMatches(gate[0], "const gate = context.waitForProviderObservation;")
    && statementMatches(gate[1], 'if (!gate) throw executionFailure("failed", "GPT_PROVIDER_OBSERVATION_GATE_REQUIRED");')
    && statementMatches(gate[2], "return gate;");
};
const emptySignalIsBound = (source: import("ts-morph").SourceFile): boolean => {
  const empty = blockStatements(arrowFor(source, "emptyEndedObservation")?.getBody());
  const throwing = Node.isThrowStatement(empty[1]) ? empty[1].getExpression() : undefined;
  const args = argumentsFor(throwing, "gptExecutionFailure"), options = args[1];
  return empty.length === 2 && statementMatches(empty[0], "const facts = projectExactAssistantTurn(assistant);")
    && expressionMatches(args[0], '"GPT_TEXT_RESPONSE_EMPTY_ENDED"') && Node.isObjectLiteralExpression(options) && options.getProperties().length === 2
    && expressionMatches(propertyValue(options, "mutationOutcome"), '"no"')
    && objectMatches(propertyValue(options, "proofFacts"), { "...": "facts", decision: '"FAIL_CLOSED"', mutationOutcome: '"no"', browserFact: "null", nativeFailureCode: "null", emptyEndedAt: "assistant.observedAt" });
};
const negativeReadbackIsBound = (source: import("ts-morph").SourceFile): boolean => {
  const negative = arrowFor(source, "emptyReadbackFailure"), failureArgs = argumentsFor(negative?.getBody(), "executionFailure");
  const observation = propertyValue(propertyValue(failureArgs[2], "metadata"), "exactReadbackNegativeObservation");
  const record = blockStatements(arrowFor(source, "recordNegativeObservation")?.getBody());
  const confirmed = arrowFor(source, "confirmedNegativeWindow");
  return expressionMatches(failureArgs[0], '"failed"') && expressionMatches(failureArgs[1], '"GPT_TEXT_RESPONSE_EMPTY_ENDED"')
    && objectMatches(observation, { pendingCause: '"response-stopped-empty"', canonicalConversationUrl: "assistant.currentUrl", userTurnId: "userTurnId", targetRefHash: "assistant.targetRefHash", documentRefHash: "assistant.documentRefHash", observationRevisionHash: "projectExactAssistantTurn(assistant).observationRevisionHash!", observedAt: "assistant.observedAt", generatingRaw: "0", firstObservedAt: "assistant.observedAt", observationCount: "1" })
    && record.length === 4 && statementMatches(record[0], "const negative = executionFailureMetadata(error)?.exactReadbackNegativeObservation;")
    && statementMatches(record[1], "if (!negative || negative.generatingRaw !== 0) return null;")
    && statementMatches(record[2], "const same = current !== null && current.canonicalConversationUrl === negative.canonicalConversationUrl && current.userTurnId === negative.userTurnId && current.targetRefHash === negative.targetRefHash && current.documentRefHash === negative.documentRefHash && current.pendingCause === negative.pendingCause;")
    && statementMatches(record[3], "return Object.freeze({ ...negative, firstObservedAt: same ? current.firstObservedAt : negative.observedAt, observationCount: same ? current.observationCount + 1 : 1 });")
    && expressionMatches(confirmed?.getBody(), "observation !== null && observation.observationCount >= 2 && Date.parse(observation.observedAt) > Date.parse(observation.firstObservedAt)");
};
const exactResponseReadIsBound = (body: readonly Node[]): boolean => {
  const reader = body[3];
  const readerBody = Node.isTryStatement(reader) ? reader.getTryBlock().getStatements() : [];
  return statementMatches(body[0], "const waitForProviderObservation = requireObservationGate(context);")
    && statementMatches(body[1], 'if (await waitForProviderObservation(exactResponseObserved ? null : deadline, nextWaitReason) === "deadline") { if (exactResponseObserved) continue; break; }')
    && statementMatches(body[2], "let assistant: ExactAssistantObservation | null = null;")
    && readerBody.length === 1 && statementMatches(readerBody[0], "assistant = await readExactAssistantTurn(browser, userTurnId, turnMarker, conversationUrl);")
    && Node.isTryStatement(reader) && reader.getFinallyBlock() === undefined
    && statementMatches(reader.getCatchClause()?.getBlock(), '{ const code = failureCode(error); if (code === "BROWSER_EXACT_USER_TURN_UNAVAILABLE") { nextWaitReason = "exact-user-turn-unavailable"; } else if (code === "BROWSER_ADJACENT_ASSISTANT_TURN_MISSING") { nextWaitReason = "adjacent-assistant-missing"; } else { throw error; } negativeWindow.current = recordNegativeObservation(negativeWindow.current, error); }')
    && statementMatches(body[4], "exactResponseObserved = assistant !== null;");
};
const responseDecisionsAreBound = (body: readonly Node[]): boolean => {
  const done = body[5], doneBlock = Node.isIfStatement(done) ? blockStatements(done.getThenStatement()) : [];
  return Node.isIfStatement(done) && expressionMatches(done.getExpression(), "assistant && assistant.generatingRaw === 0 && assistant.semanticText.trim().length > 0")
    && doneBlock.length === 1 && statementMatches(doneBlock[0], "return settledTextResponse(assistant);") && done.getElseStatement() === undefined
    && statementMatches(body[6], "if (!assistant) continue;")
    && statementMatches(body[7], 'if (assistant.generatingRaw > 0) { negativeWindow.current = null; nextWaitReason = "stop-present"; continue; }')
    && statementMatches(body[8], "if (context.stoppedEmptyRetryAuthorized === true) emptyEndedObservation(assistant);")
    && statementMatches(body[9], "exactResponseObserved = false;")
    && statementMatches(body[10], "negativeWindow.current = recordNegativeObservation(negativeWindow.current, emptyReadbackFailure(assistant, userTurnId));")
    && statementMatches(body[11], 'nextWaitReason = "response-stopped-empty";');
};
const loopKeepsTwoGates = (loop: import("ts-morph").WhileStatement): boolean => {
  const body = blockStatements(loop.getStatement());
  return body.length === 12 && expressionMatches(loop.getExpression(), "Date.now() < deadline || exactResponseObserved")
    && exactResponseReadIsBound(body) && responseDecisionsAreBound(body);
};
const handlerKeepsOriginalBudget = (source: import("ts-morph").SourceFile): boolean => {
  const handler = arrowFor(source, "checkpointGptTextResponseHandler"), body = blockStatements(handler?.getBody()), loop = body[6];
  return handler?.isAsync() === true && body.length === 10 && Node.isWhileStatement(loop)
    && statementMatches(body[0], "const { conversationUrl, userTurnId, turnMarker, probeBudgetMs } = checkpointInput(intent);")
    && statementMatches(body[1], "const browser = requireBrowser(context);")
    && statementMatches(body[2], "const deadline = Date.now() + probeBudgetMs;")
    && statementMatches(body[3], "let exactResponseObserved = false;")
    && statementMatches(body[4], 'let nextWaitReason: GptProviderObservationWaitReason = "initial-observation";')
    && statementMatches(body[5], "const negativeWindow: { current: ExactReadbackNegativeObservation | null } = { current: null };")
    && loopKeepsTwoGates(loop) && statementMatches(body[7], "const lastNegative = negativeWindow.current;")
    && statementMatches(body[8], 'if (confirmedNegativeWindow(lastNegative)) { throw executionFailure("failed", "GPT_EXACT_READBACK_UNAVAILABLE", { metadata: { exactReadbackNegativeObservation: lastNegative } }); }')
    && statementMatches(body[9], 'throw executionFailure("failed", "GPT_RESPONSE_TIMEOUT");');
};
const responseBindingsAreOriginal = (source: import("ts-morph").SourceFile): boolean => {
  const bindings: Record<string, string> = {
    executionFailure: "../../../../lib/execution-failure.js", executionFailureMetadata: "../../../../lib/execution-failure.js", failureCode: "../../../../lib/execution-failure.js",
    gptExecutionFailure: "../../execution-fault.js", projectExactAssistantTurn: "../../web/gpt-dom-observation.js", readExactAssistantTurn: "../../web/gpt-dom-observation.js",
    canonicalGptConversationUrl: "../../web/contracts/target-document.contract.js", declaredFacts: "../../web/child-handler.js", numberInput: "../../web/child-handler.js",
    requireBrowser: "../../web/child-handler.js", requireExactInputKeys: "../../web/child-handler.js", stringInput: "../../web/child-handler.js", success: "../../web/child-handler.js",
  };
  return Object.entries(bindings).every(([name, module]) => {
    const found = source.getImportDeclarations().flatMap(declaration => declaration.getNamedImports()
      .filter(binding => binding.getName() === name).map(binding => ({ declaration, binding })));
    return found.length === 1 && found[0]?.declaration.getModuleSpecifierValue() === module
      && found[0].binding.getAliasNode() === undefined;
  });
};
export const textResponseTwoGateSettlementIsFrozen = (source: string): boolean => {
  const project = new Project({ useInMemoryFileSystem: true }), actual = project.createSourceFile("checkpoint.ts", source);
  const functions = ["emptyEndedObservation", "emptyReadbackFailure", "settledTextResponse", "checkpointInput", "recordNegativeObservation", "confirmedNegativeWindow", "requireObservationGate", "checkpointGptTextResponseHandler"];
  return actual.getVariableDeclarations().length === functions.length && functions.every(name => arrowFor(actual, name) !== undefined)
    && actual.getStatements().every(node => Node.isImportDeclaration(node) || Node.isTypeAliasDeclaration(node) || Node.isVariableStatement(node))
    && actual.getVariableStatements().every(node => node.getDeclarationKind() === "const")
    && actual.getVariableDeclaration("checkpointGptTextResponseHandler")?.isExported() === true
    && responseBindingsAreOriginal(actual) && settledResponseIsDirect(actual) && inputAndObservationAreBound(actual)
    && emptySignalIsBound(actual) && negativeReadbackIsBound(actual) && handlerKeepsOriginalBudget(actual);
};
export const providerWaitReasonProjectionIsFrozen = (contract: string, lifecycle: string, textHandler: string, imageHandler: string): boolean => {
  const reasons = ["initial-observation", "exact-user-turn-unavailable", "adjacent-assistant-missing", "stop-present", "response-stopped-empty", "generated-image-source-pending"];
  const codes = ["GPT_PROVIDER_WAIT_INITIAL_OBSERVATION", "GPT_PROVIDER_WAIT_EXACT_USER_TURN_UNAVAILABLE", "GPT_PROVIDER_WAIT_ADJACENT_ASSISTANT_MISSING", "GPT_PROVIDER_WAIT_STOP_PRESENT", "GPT_PROVIDER_WAIT_RESPONSE_STOPPED_EMPTY"];
  return contract.includes("reason: GptProviderObservationWaitReason") && reasons.every(reason => contract.includes(JSON.stringify(reason)))
    && reasons.slice(0, 5).every((reason, index) => lifecycle.includes(`${JSON.stringify(reason)}: ${JSON.stringify(codes[index])}`))
    && lifecycle.includes('reason === "generated-image-source-pending"') && lifecycle.includes('"GPT_PROVIDER_WAIT_ACTIVE"') && lifecycle.includes("reason in textCodes")
    && textResponseTwoGateSettlementIsFrozen(textHandler) && imageHandler.includes('deadline, "generated-image-source-pending"');
};
const atomicExecutionIsFrozen = (context: InspectorContext): boolean => {
  const atomic = sourceFor(context, `${ROOT}/production-atomic-call.ts`);
  const identity = atomic?.getVariableDeclaration("productionGptAtomicIdentity")?.getInitializer()?.getText() ?? "";
  const execution = atomic?.getVariableDeclaration("executeProductionGptAtomicCall")?.getInitializer(), body = execution?.getText() ?? "";
  const absent = execution?.getDescendantsOfKind(SyntaxKind.IfStatement).find(statement => statement.getExpression().getText() === "!priorOutcome");
  const run = absent?.getThenStatement().getDescendantsOfKind(SyntaxKind.CallExpression).find(call => call.getExpression().getText() === "browser.runAtomicStep");
  const calls = execution?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? [];
  const reads = calls.filter(call => call.getExpression().getText() === "browser.readAtomicStepOutcome");
  const runs = calls.filter(call => call.getExpression().getText() === "browser.runAtomicStep");
  return identity.includes("gptCanonicalHash([resultRevision, intent.inputHash])")
    && ["resultRevision", "productStepId", "callId", "childCapabilityId", "inputHash", "actionOrdinal", "replayPolicy"].every(field => identity.includes(field))
    && ["const identity = input.browserAtomicIdentity ?? productionGptAtomicIdentity(input.intent, input.resultRevision)",
      "executionContext(input, browser, identity)",
      "readPriorAtomicOutcome({ gpt: input.gpt, intent: input.intent, context, browser, priorOutcome })"].every(token => body.includes(token))
    && reads.length === 1 && reads[0]?.getArguments()[0]?.getText() === "identity"
    && runs.length === 1 && run?.getArguments()[0]?.getText() === "identity"
    && run?.getArguments()[1]?.getText().includes("input.gpt.execute(input.intent, context)") === true;
};
const atomicProjectionIsFrozen = (context: InspectorContext): boolean => {
  const projection = sourceFor(context, `${ROOT}/web/child-handler.ts`)?.getVariableDeclaration("projectBrowserFact")?.getInitializer();
  const expected = projection?.getDescendantsOfKind(SyntaxKind.VariableDeclaration).find(node => node.getName() === "expected")?.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression);
  const keys = expected?.getProperties().flatMap(property => Node.isPropertyAssignment(property) ? [property.getName()] : []).sort() ?? [];
  const reject = projection?.getDescendantsOfKind(SyntaxKind.IfStatement).find(statement =>
    compact(statement.getExpression().getText()) === "!HASH.test(identity.inputHash)||Object.entries(expected).some(([key,value])=>identity[keyaskeyoftypeofidentity]!==value)");
  const consumers = context.project.getSourceFiles().filter(source => source.getFilePath().includes("/src/capabilities/gpt/children/"))
    .flatMap(source => source.getDescendantsOfKind(SyntaxKind.CallExpression).filter(call => call.getExpression().getText() === "projectBrowserFact"));
  const body = projection?.getText() ?? "";
  return JSON.stringify(keys) === JSON.stringify(["actionOrdinal", "callId", "childCapabilityId", "inputHash", "productStepId", "replayPolicy", "resultRevision"])
    && reject?.getThenStatement().getText().includes('throw gptExecutionFailure("GPT_BROWSER_TERMINAL_FACT_REQUIRED")') === true
    && new Set(consumers.map(call => call.getSourceFile().getFilePath())).size === 11
    && consumers.every(call => compact(call.getText()) === "projectBrowserFact(intent,context)")
    && ["readAtomicStepOutcome(identity)", "const identity = context.browserAtomicIdentity",
      'contract.replayPolicy === "provider-effect-once" ? identity.inputHash : intent.inputHash'].every(token => body.includes(token));
};
const atomicReadbackIsFrozen = (context: InspectorContext): boolean => {
  const group = sourceFor(context, `${ROOT}/ability-group.ts`)?.getFullText() ?? "";
  const readback = sourceFor(context, `${ROOT}/production-atomic-readback.ts`)?.getFullText() ?? "";
  return group.includes("projectBrowserFact(") && !group.includes("readAtomicStepOutcome(")
    && ["readbackProviderInputDelta: 0", "...context.browserAtomicIdentity", "priorOutcome.physicalInputCount !== 1"].every(token => readback.includes(token))
    && !readback.includes("runAtomicStep(");
};
const frozenBlueprints = (read: (path: string) => string): boolean => {
  const gpt = read("docs/blueprints/gpt/GPT-CAPABILITY-GROUP-V2-BLUEPRINT.md");
  const browser = read("docs/blueprints/local-browser-session/LOCAL-BROWSER-AUTO-PAIRING-AND-EXACT-CHATGPT-CLAIM-V2-BLUEPRINT.md");
  return ["FROZEN-GPT-SUBMIT-TWO-PRECONDITIONS-001", "FROZEN-GPT-ATTACHMENT-PROVIDER-DUPLICATE-SUFFIX-001", "FROZEN-GPT-RESPONSE-NO-PROMPT-REHASH-001",
    "FROZEN-GPT-TEXT-RESPONSE-TWO-GATES-001", "FROZEN-GPT-ATOMIC-IDENTITY-ROUNDTRIP-001", "FROZEN-EXACT-TARGET-POLL-RESULT-REVISION-001",
    "GPT_RESPONSE_STOPPED_EMPTY", "不保留20分钟空等", "原execution单调预算/abort", "账号级至少 1.5 秒起始节拍", "detection→ack 唯一紧急对外动作"].every(token => gpt.includes(token))
    && ["FROZEN-GPT-ATTACHMENT-PROVIDER-DUPLICATE-SUFFIX-001", "FROZEN-GPT-TEXT-RESPONSE-TWO-GATES-001", "chatgptPageAccessNotBefore", "detection→dispatch可豁免1.5秒"].every(token => browser.includes(token))
    && [gpt, browser].every(value => value.includes("(<8位十进制日期>-<6位十进制时间>)"));
};
const productsReadBeforePreparation = (context: InspectorContext): boolean => {
  let preparations = 0;
  for (const path of context.targetPaths.filter(path => path.startsWith("src/plugins/") && /(?:^|\/)\w*(?:-|\w)*flow\.ts$/u.test(path))) {
    const source = sourceFor(context, path);
    if (!source) return false;
    const enclosingFunction = (node: Node) => node.getAncestors().find(ancestor =>
      Node.isFunctionDeclaration(ancestor) || Node.isArrowFunction(ancestor) || Node.isFunctionExpression(ancestor));
    for (const literal of source.getDescendantsOfKind(SyntaxKind.StringLiteral)
      .filter(node => ["prepare_clean_gpt_chat", "prepare_clean_gpt_work"].includes(node.getLiteralValue()))) {
      preparations++;
      const owner = enclosingFunction(literal), branch = literal.getFirstAncestorByKind(SyntaxKind.IfStatement);
      const reads = owner?.getDescendantsOfKind(SyntaxKind.CallExpression).filter(call =>
        call.getExpression().getText().endsWith(".readConfirmedSubmit") && enclosingFunction(call) === owner) ?? [];
      const read = reads[0], binding = read?.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
      if (reads.length !== 1 || !binding || !branch || !read || read.getEnd() >= branch.getStart()
        || !expressionMatches(branch.getExpression(), `!${binding.getName()}`)) return false;
    }
  }
  return preparations > 0;
};
export const inspectFrozenAttemptBoundary = (context: InspectorContext, findings: InspectorFinding[], evidenceMode: "static.ast" | "static.contract"): void => {
  const read = (path: string): string => { const absolute = resolve(context.sealedRoot, path);
    return sourceFor(context, path)?.getFullText() ?? (existsSync(absolute) ? readFileSync(absolute, "utf8") : ""); };
  const contract = read(`${ROOT}/contract.ts`), lifecycle = read(`${ROOT}/production-browser-lifecycle.ts`);
  const checkpoint = read(`${ROOT}/children/checkpoint_gpt_text_response/handler.ts`), image = read(`${ROOT}/children/checkpoint_gpt_generated_image/handler.ts`);
  const valid = atomicExecutionIsFrozen(context) && atomicProjectionIsFrozen(context) && atomicReadbackIsFrozen(context)
    && frozenBlueprints(read)
    && providerWaitReasonProjectionIsFrozen(contract, lifecycle, checkpoint, image)
    && contract.includes("browserAtomicIdentity?: BrowserAtomicStepIdentity") && read(`${ROOT}/product-api.ts`).includes("readConfirmedSubmit(")
    && productsReadBeforePreparation(context)
    && read("src/lib/browser/exact-target/browser-mutation-evidence.ts").includes('providerEffectIdentityHash: input.effectScope === "provider_effect"')
    && read("src/lib/browser/exact-target/browser-mutation-store.ts").includes("row.attempt_id !== input.attemptId")
    && !/BROWSER_RECONCILIATION_IDENTITY_MISMATCH|"provider-probe"|startProviderProbeCooldown/u.test(lifecycle);
  if (!valid) findings.push(createFinding({ evidenceMode, lawId: LAW_ID, clauseId: `${LAW_ID.toLowerCase()}-requirement`, checkId: "gpt/frozen-job-attempt-provider-effect",
    filePath: `${ROOT}/contract.ts`, message: "The frozen original atomic identity, two submit preconditions, readback-first order, attachment normalization or two response gates are incomplete." }));
};
