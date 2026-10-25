import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Node, Project, SyntaxKind } from "ts-morph";
import { astExecutableTree } from "../../shared/ast-node-identity.js";
import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { sourceFor } from "./gpt-inspection-support.js";

const LAW_ID = "LAW-GPT-002-V33", ROOT = "src/capabilities/gpt";
const compact = (source: string): string => source.replace(/\s+/gu, "");
// The executable module binds the nine immutable response functions, their
// real parameter/import references, the two gates and the original 20-minute
// clock. AST tokens preserve control ancestry and literal contents; comments
// and formatting are trivia; kind and semantic child count retain the tree. This is static evidence, never a runtime gate/hash.
const frozenTextResponseSource = [
  "import { executionFailure, executionFailureMetadata, failureCode } from \"../../../../lib/execution-failure.js\";",
  "import { gptExecutionFailure } from \"../../execution-fault.js\";",
  "import { gptCanonicalHash, type GptProviderObservationWaitReason } from \"../../contract.js\";",
  "import type { ExactReadbackNegativeObservation, ProviderStoppedEmptyProof } from \"../../../../lib/execution-failure.js\";",
  "",
  "import { declaredFacts, numberInput, requireBrowser, requireExactInputKeys, stringInput, success, type GptChildHandler } from \"../../web/child-handler.js\";",
  "import {",
  "  projectExactAssistantTurn,",
  "  readExactAssistantTurn,",
  "} from \"../../web/gpt-dom-observation.js\";",
  "import { canonicalGptConversationUrl } from \"../../web/contracts/target-document.contract.js\";",
  "",
  "export const GPT_STOPPED_EMPTY_CONFIRMATION_MS = 20 * 60 * 1_000;",
  "",
  "type StoppedEmptyWindow = Readonly<{",
  "  sinceMonotonicMs: number;",
  "  firstObservedAt: string;",
  "  observationCount: number;",
  "  identityHash: `sha256:${string}`;",
  "}>;",
  "",
  "type ExactAssistantObservation = Awaited<ReturnType<typeof readExactAssistantTurn>>;",
  "",
  "const throwStoppedEmptyFailure = (",
  "  assistant: ExactAssistantObservation,",
  "  window: StoppedEmptyWindow,",
  "  observedAt: number,",
  "): never => {",
  "  const facts = projectExactAssistantTurn(assistant);",
  "  const evidenceRef = facts.factResultIds[0];",
  "  if (!evidenceRef || !facts.observationRevisionHash) {",
  "    throw executionFailure(\"failed\", \"GPT_STOPPED_EMPTY_EVIDENCE_INVALID\");",
  "  }",
  "  const stoppedEmptyProof: ProviderStoppedEmptyProof = Object.freeze({",
  "    firstObservedAt: window.firstObservedAt,",
  "    terminalObservedAt: assistant.observedAt,",
  "    continuousMonotonicMs: Math.floor(observedAt - window.sinceMonotonicMs),",
  "    observationCount: window.observationCount,",
  "    identityHash: window.identityHash,",
  "    terminalObservationRevisionHash: facts.observationRevisionHash,",
  "  });",
  "  throw gptExecutionFailure(\"GPT_RESPONSE_STOPPED_EMPTY\", {",
  "    mutationOutcome: \"no\", evidence: { evidenceRef, evidenceHash: facts.observationRevisionHash },",
  "    proofFacts: Object.freeze({ ...facts, decision: \"FAIL_CLOSED\", mutationOutcome: \"no\",",
  "      browserFact: null, nativeFailureCode: \"GPT_RESPONSE_STOPPED_EMPTY\", stoppedEmptyProof }),",
  "  });",
  "};",
  "",
  "export const advanceStoppedEmptyWindow = (",
  "  current: StoppedEmptyWindow | null,",
  "  observation: Readonly<{",
  "    generatingRaw: number;",
  "    semanticText: string;",
  "    observedAt: string;",
  "    identityHash: `sha256:${string}`;",
  "  }>,",
  "  observedAt: number,",
  "): Readonly<{ window: null; confirmed: false }> | Readonly<{ window: StoppedEmptyWindow; confirmed: boolean }> => {",
  "  if (observation.generatingRaw > 0 || observation.semanticText.trim().length > 0) {",
  "    return Object.freeze({ window: null, confirmed: false });",
  "  }",
  "  const window = current === null || current.identityHash !== observation.identityHash",
  "    ? Object.freeze({",
  "        sinceMonotonicMs: observedAt,",
  "        firstObservedAt: observation.observedAt,",
  "        observationCount: 1,",
  "        identityHash: observation.identityHash,",
  "      })",
  "    : Object.freeze({ ...current, observationCount: current.observationCount + 1 });",
  "  return Object.freeze({",
  "    window,",
  "    confirmed: observedAt - window.sinceMonotonicMs >= GPT_STOPPED_EMPTY_CONFIRMATION_MS,",
  "  });",
  "};",
  "",
  "/** Advances the stopped-empty window for an observed, not yet settled assistant turn. */",
  "const advanceObservedAssistant = (",
  "  assistant: ExactAssistantObservation,",
  "  current: StoppedEmptyWindow | null,",
  "): StoppedEmptyWindow | null => {",
  "  const observedAt = performance.now();",
  "  const stoppedEmpty = advanceStoppedEmptyWindow(current, {",
  "    generatingRaw: assistant.generatingRaw,",
  "    semanticText: assistant.semanticText,",
  "    observedAt: assistant.observedAt,",
  "    identityHash: gptCanonicalHash({",
  "      canonicalConversationUrl: assistant.currentUrl,",
  "      userTurnId: assistant.precedingUserTurnId,",
  "      assistantTurnId: assistant.assistantTurnId,",
  "      targetRefHash: assistant.targetRefHash,",
  "      documentRefHash: assistant.documentRefHash,",
  "    }),",
  "  }, observedAt);",
  "  if (stoppedEmpty.confirmed) throwStoppedEmptyFailure(assistant, stoppedEmpty.window, observedAt);",
  "  return stoppedEmpty.window;",
  "};",
  "",
  "const settledTextResponse = (assistant: ExactAssistantObservation) => success({",
  "  value: { assistantTurnId: assistant.assistantTurnId, rawDomHtml: assistant.rawDomHtml,",
  "    rawDomHash: assistant.rawDomHash, semanticText: assistant.semanticText,",
  "    semanticTextHash: assistant.semanticTextHash },",
  "  ...declaredFacts({ ...projectExactAssistantTurn(assistant), decision: \"DONE\", mutationOutcome: \"no\",",
  "    browserFact: null, nativeFailureCode: null }),",
  "});",
  "",
  "const checkpointInput = (intent: Parameters<GptChildHandler<\"checkpoint_gpt_text_response\">>[0]) => {",
  "  requireExactInputKeys(intent, [\"canonicalConversationUrl\", \"probeBudgetMs\", \"turnMarker\", \"userTurnId\"]);",
  "  const conversationUrl = canonicalGptConversationUrl(stringInput(intent, \"canonicalConversationUrl\"));",
  "  const turnMarker = stringInput(intent, \"turnMarker\");",
  "  const userTurnId = stringInput(intent, \"userTurnId\");",
  "  const probeBudgetMs = numberInput(intent, \"probeBudgetMs\");",
  "  if (!Number.isSafeInteger(probeBudgetMs) || probeBudgetMs < 1 || probeBudgetMs > 3_600_000) throw executionFailure(\"failed\", \"GPT_RESPONSE_PROBE_BUDGET_INVALID\");",
  "  return { conversationUrl, userTurnId, turnMarker, probeBudgetMs };",
  "};",
  "",
  "const recordNegativeObservation = (",
  "  current: ExactReadbackNegativeObservation | null,",
  "  error: unknown,",
  "): ExactReadbackNegativeObservation | null => {",
  "  const negative = executionFailureMetadata(error)?.exactReadbackNegativeObservation;",
  "  if (!negative || negative.generatingRaw !== 0) return null;",
  "  const same = current !== null",
  "    && current.canonicalConversationUrl === negative.canonicalConversationUrl",
  "    && current.userTurnId === negative.userTurnId",
  "    && current.targetRefHash === negative.targetRefHash",
  "    && current.documentRefHash === negative.documentRefHash",
  "    && current.pendingCause === negative.pendingCause;",
  "  return Object.freeze({ ...negative,",
  "    firstObservedAt: same ? current.firstObservedAt : negative.observedAt,",
  "    observationCount: same ? current.observationCount + 1 : 1,",
  "  });",
  "};",
  "",
  "const confirmedNegativeWindow = (",
  "  observation: ExactReadbackNegativeObservation | null,",
  "): observation is ExactReadbackNegativeObservation => observation !== null",
  "  && observation.observationCount >= 2",
  "  && Date.parse(observation.observedAt) > Date.parse(observation.firstObservedAt);",
  "",
  "const requireObservationGate = (context: Parameters<GptChildHandler<\"checkpoint_gpt_text_response\">>[1]) => {",
  "  const gate = context.waitForProviderObservation;",
  "  if (!gate) throw executionFailure(\"failed\", \"GPT_PROVIDER_OBSERVATION_GATE_REQUIRED\");",
  "  return gate;",
  "};",
  "",
  "export const checkpointGptTextResponseHandler: GptChildHandler<\"checkpoint_gpt_text_response\"> =",
  "  async (intent, context) => {",
  "    const { conversationUrl, userTurnId, turnMarker, probeBudgetMs } = checkpointInput(intent);",
  "    const browser = requireBrowser(context);",
  "    const deadline = Date.now() + probeBudgetMs;",
  "    let stoppedEmptyWindow: StoppedEmptyWindow | null = null;",
  "    let exactResponseObserved = false;",
  "    let nextWaitReason: GptProviderObservationWaitReason = \"initial-observation\";",
  "    const negativeWindow: { current: ExactReadbackNegativeObservation | null } = { current: null };",
  "    while (Date.now() < deadline || exactResponseObserved) {",
  "      const waitForProviderObservation = requireObservationGate(context);",
  "      const observationDeadline = exactResponseObserved",
  "        ? Date.now() + GPT_STOPPED_EMPTY_CONFIRMATION_MS : deadline;",
  "      if (await waitForProviderObservation(observationDeadline, nextWaitReason) === \"deadline\") {",
  "        if (exactResponseObserved) continue;",
  "        break;",
  "      }",
  "      let assistant: ExactAssistantObservation | null = null;",
  "      try {",
  "        assistant = await readExactAssistantTurn(browser, userTurnId, turnMarker, conversationUrl);",
  "      } catch (error) {",
  "        const code = failureCode(error);",
  "        if (code === \"BROWSER_EXACT_USER_TURN_UNAVAILABLE\") {",
  "          nextWaitReason = \"exact-user-turn-unavailable\";",
  "        } else if (code === \"BROWSER_ADJACENT_ASSISTANT_TURN_MISSING\") {",
  "          nextWaitReason = \"adjacent-assistant-missing\";",
  "        } else {",
  "          throw error;",
  "        }",
  "        negativeWindow.current = recordNegativeObservation(negativeWindow.current, error);",
  "      }",
  "      exactResponseObserved = assistant !== null;",
  "      if (assistant && assistant.generatingRaw === 0 && assistant.semanticText.trim().length > 0) {",
  "        return settledTextResponse(assistant);",
  "      }",
  "      if (!assistant) {",
  "        stoppedEmptyWindow = null;",
  "        continue;",
  "      }",
  "      negativeWindow.current = null;",
  "      nextWaitReason = assistant.generatingRaw > 0",
  "        ? \"stop-present\" : \"stopped-empty-confirming\";",
  "      stoppedEmptyWindow = advanceObservedAssistant(assistant, stoppedEmptyWindow);",
  "    }",
  "    const lastNegative = negativeWindow.current;",
  "    if (confirmedNegativeWindow(lastNegative)) {",
  "      throw executionFailure(\"failed\", \"GPT_EXACT_READBACK_UNAVAILABLE\", {",
  "        metadata: { exactReadbackNegativeObservation: lastNegative },",
  "      });",
  "    }",
  "    throw executionFailure(\"failed\", \"GPT_RESPONSE_TIMEOUT\");",
  "  };",
].join("\n");
const responseExecutionTokens = (file: import("ts-morph").SourceFile): readonly string[] =>
  file.getStatements().filter(statement => !Node.isTypeAliasDeclaration(statement)).map(astExecutableTree);
export const textResponseTwoGateSettlementIsFrozen = (source: string): boolean => {
  const project = new Project({ useInMemoryFileSystem: true });
  const actual = project.createSourceFile("checkpoint.ts", source);
  const expected = project.createSourceFile("frozen-checkpoint.ts", frozenTextResponseSource);
  return JSON.stringify(responseExecutionTokens(actual)) === JSON.stringify(responseExecutionTokens(expected));
};
export const providerWaitReasonProjectionIsFrozen = (contract: string, lifecycle: string, textHandler: string, imageHandler: string): boolean => {
  const reasons = ["initial-observation", "exact-user-turn-unavailable", "adjacent-assistant-missing", "stop-present", "stopped-empty-confirming", "generated-image-source-pending"];
  const codes = ["GPT_PROVIDER_WAIT_INITIAL_OBSERVATION", "GPT_PROVIDER_WAIT_EXACT_USER_TURN_UNAVAILABLE", "GPT_PROVIDER_WAIT_ADJACENT_ASSISTANT_MISSING", "GPT_PROVIDER_WAIT_STOP_PRESENT", "GPT_PROVIDER_WAIT_STOPPED_EMPTY_CONFIRMING"];
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
    "GPT_RESPONSE_STOPPED_EMPTY", "连续消失且回答连续为空满20分钟", "账号级至少 1.5 秒起始节拍", "detection→ack 唯一紧急对外动作"].every(token => gpt.includes(token))
    && ["FROZEN-GPT-ATTACHMENT-PROVIDER-DUPLICATE-SUFFIX-001", "FROZEN-GPT-TEXT-RESPONSE-TWO-GATES-001", "chatgptPageAccessNotBefore", "detection→dispatch可豁免1.5秒"].every(token => browser.includes(token))
    && [gpt, browser].every(value => value.includes("(<8位十进制日期>-<6位十进制时间>)"));
};
export const inspectFrozenAttemptBoundary = (context: InspectorContext, findings: InspectorFinding[], evidenceMode: "static.ast" | "static.contract"): void => {
  const read = (path: string): string => { const absolute = resolve(context.sealedRoot, path);
    return sourceFor(context, path)?.getFullText() ?? (existsSync(absolute) ? readFileSync(absolute, "utf8") : ""); };
  const contract = read(`${ROOT}/contract.ts`), lifecycle = read(`${ROOT}/production-browser-lifecycle.ts`);
  const checkpoint = read(`${ROOT}/children/checkpoint_gpt_text_response/handler.ts`), image = read(`${ROOT}/children/checkpoint_gpt_generated_image/handler.ts`);
  const seo = read("src/plugins/public-knowledge-article-pipeline/seo-submit-readback.ts");
  const valid = atomicExecutionIsFrozen(context) && atomicProjectionIsFrozen(context) && atomicReadbackIsFrozen(context)
    && frozenBlueprints(read)
    && providerWaitReasonProjectionIsFrozen(contract, lifecycle, checkpoint, image)
    && contract.includes("browserAtomicIdentity?: BrowserAtomicStepIdentity") && read(`${ROOT}/product-api.ts`).includes("readConfirmedSubmit(")
    && read("src/plugins/public-knowledge-article-pipeline/seo-gpt-calls.ts").includes("context.gpt.readConfirmedSubmit")
    && /await input\.read\(\)[\s\S]*await input\.prepare\(\)[\s\S]*await input\.execute\(\)/u.test(seo)
    && read("src/lib/browser/exact-target/browser-mutation-evidence.ts").includes('providerEffectIdentityHash: input.effectScope === "provider_effect"')
    && read("src/lib/browser/exact-target/browser-mutation-store.ts").includes("row.attempt_id !== input.attemptId")
    && !/BROWSER_RECONCILIATION_IDENTITY_MISMATCH|"provider-probe"|startProviderProbeCooldown/u.test(lifecycle);
  if (!valid) findings.push(createFinding({ evidenceMode, lawId: LAW_ID, clauseId: `${LAW_ID.toLowerCase()}-requirement`, checkId: "gpt/frozen-job-attempt-provider-effect",
    filePath: `${ROOT}/contract.ts`, message: "The frozen original atomic identity, two submit preconditions, readback-first order, attachment normalization or two response gates are incomplete." }));
};
