import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { sourceFor, type FindingFactory } from "./gpt-inspection-support.js";

const ROOT = "src/capabilities/gpt";
const CHILDREN = `${ROOT}/children`;
const CONTRACT = `${ROOT}/contract.ts`;
const REGISTRY = `${ROOT}/handler-registry.ts`;
// The law freezes each Child, rather than merely the total number of profiles.
const CHILDREN_CONTRACT = {
  open_exact_gpt_retry_menu: [1, 1, "TARGET_LOCAL_MUTATION"],
  retry_exact_gpt_response_once: [1, 1, "PROVIDER_EFFECT_ONCE"],
  acknowledge_known_gpt_rate_limit: [2, 1, "TARGET_LOCAL_MUTATION"],
  attach_approved_gpt_files_once: [3, 1, "TARGET_LOCAL_MUTATION"],
  checkpoint_gpt_generated_image: [6, 3, "DOM_OBSERVATION"],
  checkpoint_gpt_text_response: [7, 3, "DOM_OBSERVATION"],
  get_submitted_gpt_conversation_url: [1, 1, "DOM_OBSERVATION"],
  close_gpt_execution_profile: [4, 2, "TARGET_LOCAL_MUTATION"],
  open_gpt_attachment_control: [3, 1, "TARGET_LOCAL_MUTATION"],
  open_gpt_execution_profile: [3, 2, "TARGET_LOCAL_MUTATION"],
  open_gpt_model_selector_v3: [4, 2, "TARGET_LOCAL_MUTATION"],
  prepare_clean_gpt_chat: [5, 1, "TARGET_LOCAL_MUTATION"],
  prepare_clean_gpt_work: [1, 1, "TARGET_LOCAL_MUTATION"],
  reconcile_gpt_attachment_set: [3, 1, "DOM_OBSERVATION"],
  select_gpt_model_from_start_v3: [5, 2, "TARGET_LOCAL_MUTATION"],
  select_gpt_reasoning_from_start_v3: [5, 3, "TARGET_LOCAL_MUTATION"],
  submit_exact_gpt_turn_once: [7, 2, "PROVIDER_EFFECT_ONCE"],
  write_exact_gpt_prompt: [4, 1, "TARGET_LOCAL_MUTATION"],
} as const;
const expectedIds = Object.keys(CHILDREN_CONTRACT).sort();
const objectInitializer = (source: SourceFile | undefined, name: string) => {
  const value = source?.getVariableDeclaration(name)?.getInitializer();
  return Node.isObjectLiteralExpression(value) ? value : value?.getFirstDescendantByKind(SyntaxKind.ObjectLiteralExpression);
};
const names = (members: readonly Node[]): string[] => members.flatMap(member =>
  Node.isPropertyAssignment(member) || Node.isPropertySignature(member) || Node.isShorthandPropertyAssignment(member)
    ? [member.getName().replace(/^['"]|['"]$/gu, "")] : []).sort();
const initializerText = (object: import("ts-morph").ObjectLiteralExpression | undefined, name: string): string => {
  const property = object?.getProperty(name);
  return Node.isPropertyAssignment(property) ? property.getInitializer()?.getText() ?? "" : "";
};
const check = (ok: boolean, id: string, path: string, message: string,
  findings: InspectorFinding[], finding: FindingFactory): void => {
  if (!ok) findings.push(finding(id, path, message));
};
const text = (context: InspectorContext, path: string): string => sourceFor(context, path)?.getFullText() ?? "";
const child = (id: string, file = "handler.ts"): string => `${CHILDREN}/${id}/${file}`;

const inspectPrivateFile = (context: InspectorContext, id: string, file: string, findings: InspectorFinding[], finding: FindingFactory): void => {
  const directory = resolve(context.sealedRoot, CHILDREN);
  const path = child(id, file), source = sourceFor(context, path);
  if (!source) { check(false, "gpt/child-source-present", path, "Child source is absent from the sealed candidate.", findings, finding); return; }
  for (const imported of source.getImportDeclarations()) {
    const target = imported.getModuleSpecifierSourceFile()?.getFilePath();
    check(!target?.includes(`/${CHILDREN}/`) || target.startsWith(`${directory}/${id}/`),
      "gpt/child-private-exact-intent", path, "A Child cannot import another Child's private responsibility.", findings, finding);
  }
  check(!/GptAnyChildCapabilityIntent|GptChildHandlerMap\[keyof|includeSend|includeTurns|includeAttachments/u.test(source.getFullText()),
    "gpt/child-private-exact-intent", path, "Private support cannot aggregate sibling semantics.", findings, finding);
  if (file === "handler.ts") return;
  const consumers = context.project.getSourceFiles().filter(candidate => candidate !== source
    && candidate.getFilePath().startsWith(`${directory}/${id}/`)).flatMap(candidate => candidate.getImportDeclarations()
    .filter(imported => imported.getModuleSpecifierSourceFile() === source));
  check(consumers.length > 0, "gpt/child-private-support-consumer", path, "Private support requires a real same-Child consumer.", findings, finding);
  for (const [name] of source.getExportedDeclarations()) check(consumers.some(imported =>
    imported.getNamespaceImport() || imported.getNamedImports().some(named => named.getName() === name)),
  "gpt/child-private-export-consumer", path, `Private export ${name} has no same-Child consumer.`, findings, finding);
  for (const declaration of source.getVariableDeclarations()) {
    const node = declaration.getNameNode();
    if (!declaration.getVariableStatement()?.isExported() && Node.isIdentifier(node)) check(node.findReferencesAsNodes().length > 0,
      "gpt/child-private-dead-declaration", path, `Private declaration ${node.getText()} has no consumer.`, findings, finding);
  }
};

const inspectPrivateSlices = (context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory): void => {
  const directory = resolve(context.sealedRoot, CHILDREN);
  const directories = existsSync(directory) ? readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isDirectory()).map(entry => entry.name).sort() : [];
  check(JSON.stringify(directories) === JSON.stringify(expectedIds), "gpt/one-directory-per-child", CHILDREN,
    "The physical Child denominator must equal the fourteen frozen contracts.", findings, finding);
  const handlerIds: string[] = [];
  for (const id of directories) {
    const files = readdirSync(resolve(directory, id)).filter(name => name !== ".DS_Store");
    check(files.includes("handler.ts") && files.every(file => file.endsWith(".ts") && file !== "index.ts"
      && !/(?:^|[-_.])(common|shared|utils?|service|manager|facade|bridge|adapter)(?:[-_.]|$)/u.test(file)),
    "gpt/one-private-slice-per-child", `${CHILDREN}/${id}`, "A Child has one handler and explicitly named private TypeScript support.", findings, finding);
    const handler = sourceFor(context, child(id));
    for (const declaration of handler?.getVariableDeclarations() ?? []) {
      if (!declaration.isExported()) continue;
      const match = declaration.getTypeNode()?.getText().match(/^GptChildHandler<\s*["']([^"']+)["']\s*>$/u);
      if (match) handlerIds.push(match[1]!);
    }
    for (const file of files.filter(file => file.endsWith(".ts"))) inspectPrivateFile(context, id, file, findings, finding);
  }
  check(JSON.stringify(handlerIds.sort()) === JSON.stringify(expectedIds), "gpt/one-handler-per-child", CHILDREN,
    "Every exported typed handler, including foreign or duplicate handlers, participates in the denominator.", findings, finding);
  const registry = sourceFor(context, REGISTRY);
  check(JSON.stringify(names(objectInitializer(registry, "gptChildHandlers")?.getProperties() ?? [])) === JSON.stringify(expectedIds),
    "gpt/one-ability-group-mapping-per-child", REGISTRY, "The one registry maps every Child exactly once.", findings, finding);
  const imports = registry?.getImportDeclarations().filter(entry => entry.getModuleSpecifierValue().startsWith("./children/")) ?? [];
  const importedIds = imports.map(entry => entry.getModuleSpecifierValue().match(/^\.\/children\/([^/]+)\/handler\.js$/u)?.[1] ?? "").sort();
  check(JSON.stringify(importedIds) === JSON.stringify(expectedIds), "gpt/ability-group-direct-child-imports", REGISTRY,
    "The registry imports the actual fourteen handlers directly.", findings, finding);
  const groupImports = sourceFor(context, `${ROOT}/ability-group.ts`)?.getImportDeclarations().map(entry => entry.getModuleSpecifierValue()) ?? [];
  check(groupImports.includes("./handler-registry.js") && !groupImports.some(value => value.startsWith("./children/")),
    "gpt/ability-group-direct-child-imports", `${ROOT}/ability-group.ts`, "Ability-group consumes the sole handler registry.", findings, finding);
};

const inspectShapes = (context: InspectorContext, source: SourceFile, findings: InspectorFinding[], finding: FindingFactory): void => {
  const fields = ["actionQualification", "boundedWait", "childCapabilityId", "contractVersion", "decisions", "evidenceBoundary",
    "evidenceSchema", "failureClassification", "inputSchema", "mutationBudget", "negativePostcondition", "oneObservationOrMutation",
    "owner", "positivePostcondition", "precondition", "profile", "replayPolicy", "requiredTargetKind", "semanticIntent"].sort();
  check(JSON.stringify(names(source.getInterface("ChildCapabilityContract")?.getMembers() ?? [])) === JSON.stringify(fields),
    "gpt/child-contract-exact-shape", CONTRACT, "The public nineteen-field Child contract is frozen.", findings, finding);
  const proof = source.getInterface("GptChildCapabilityProof");
  for (const field of ["schemaVersion", "childCapabilityId", "childContractVersion", "childStatus", "childReasonCode", "exactCallIdentityHash",
    "internalDecisionCode", "executionId", "jobId", "attemptId", "productStepId", "callId", "inputHash", "actionOrdinal", "resultRevision",
    "authorityRefHashes", "factResultIds", "candidateCardinality", "observationRevisionHash", "committedMutation", "postconditionResult",
    "browserFact", "nativeFailureCode", "stoppedEmptyProof", "startedAt", "endedAt", "evidenceRef", "evidenceHash"]) check(!!proof?.getProperty(field),
  "gpt/proof-field-required", CONTRACT, `Proof requires ${field}.`, findings, finding);
  check(!proof?.getProperty("candidateCount") && !proof?.getProperty("observedSemantics"), "gpt/proof-retired-field", CONTRACT,
    "Retired surrogate facts cannot return to the proof.", findings, finding);
  for (const name of ["GptChildInputMap", "GptChildOutputMap"]) check(JSON.stringify(names(sourceFor(context, `${ROOT}/child-types.ts`)
    ?.getInterface(name)?.getProperties() ?? [])) === JSON.stringify(expectedIds), "gpt/exact-child-type-map", `${ROOT}/child-types.ts`,
  `${name} must map the same fourteen identities.`, findings, finding);
};

const inspectModelEntry = (context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory): void => {
  const openPath = child("open_gpt_model_selector_v3"), open = sourceFor(context, openPath);
  const openCalls = open?.getDescendantsOfKind(SyntaxKind.CallExpression).filter(call => call.getExpression().getText() === "browser.executeDomIntent") ?? [];
  const action = openCalls[0]?.getArguments()[0];
  check(openCalls.length === 1 && Node.isObjectLiteralExpression(action)
    && initializerText(action, "kind") === '"click"' && initializerText(action, "selector") === "GPT_MODEL_SELECTOR_OPENABLE_ENTRY"
    && initializerText(action, "expectedMatches") === "1" && initializerText(action, "postClickMinimumDelayMs") === "2_500"
    && initializerText(action, "postClickMatch").includes("selector: GPT_MODEL_SELECTOR_OPTION, expectedMatches: 1")
    && initializerText(action, "postClickMatch").includes('profile.startModelDisplayName === "最新" ? GPT_LATEST_MODEL_LABELS : profile.startModelDisplayName'),
  "gpt/model-entry-direct-postcondition", openPath, "The model entry confirms the exact Product option after the governed delay.", findings, finding);
};
const inspectModelSelection = (context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory): void => {
  const modelPath = child("select_gpt_model_from_start_v3"), model = sourceFor(context, modelPath);
  const modelBody = model?.getVariableDeclaration("selectGptModelFromStartV3Handler")?.getInitializer()?.getText() ?? "";
  const modelCalls = model?.getDescendantsOfKind(SyntaxKind.CallExpression).filter(call => call.getExpression().getText() === "browser.executeDomIntent") ?? [];
  const argument = modelCalls[0]?.getArguments()[0];
  const post = Node.isObjectLiteralExpression(argument) ? argument.getProperty("postClickObservation") : undefined;
  const postText = Node.isPropertyAssignment(post) ? post.getInitializer()?.getText() ?? "" : "";
  check(modelCalls.length === 1 && Node.isObjectLiteralExpression(argument) && initializerText(argument, "kind") === '"click"'
    && initializerText(argument, "expectedMatches") === "1"
    && [/name: profile\.startModelDisplayName, count: 1, ariaDisabled: false, disabled: false, inert: false/u, /Object\.entries\(expected\)\.some/u, /observed\.selectedRawCount !== 1/u, /if \(!selectedReadbackValid\(record\.clickedCandidateAttributeReadback\)\) throw/u, /decodeCoherentObservationPacket\(record\.postconditionObservation, \[query\]\)/u, /if \(packet\.rows\[0\]!\.eligibleCount !== 0\) throw/u, /physicalInputCount !== 1/u, /browserOutcome !== "CONFIRMED"/u, /mutationOutcome !== "confirmed"/u, /decision: "ACT"/u].every(pattern => pattern.test(modelBody))


    && /clickedCandidateAttribute:\s*\{ name: "aria-checked", equals: "true" \}/u.test(postText)
    && /expectedEligibleCount: 0/u.test(postText)





    && !/decision: "DONE"/u.test(modelBody), "gpt/model-selection-v3-handler", modelPath,
  "Model selection requires one qualified click and the same packet's checked-state and closed-menu readback, even when already selected.", findings, finding);
  const selected = model?.getVariableDeclaration("selectedReadbackValid")?.getInitializer()?.getText() ?? "";
  check(/Object\.keys\(row\)\.sort\(\)\.join\("\|"\) === "name\|value\|verified"/u.test(selected)
    && /name: "aria-checked", value: "true", verified: true/u.test(selected), "gpt/model-selection-v3-visible-contract", modelPath,
  "Selected-state readback is the exact verified attribute contract.", findings, finding);
};
const inspectReasoningAction = (context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory): void => {
  const reasoningPath = child("select_gpt_reasoning_from_start_v3"), reasoning = text(context, reasoningPath);
  const observation = text(context, child("select_gpt_reasoning_from_start_v3", "observation.ts"));
  check([/Math\.min\(profile\.requestedReasoningValue, observedScale\.max!\)/u, /delta === 0\s*\? \{ kind: "click"/u, /requiredClickPointSelector: GPT_PROFILE_REASONING_THUMB_SELECTOR/u, /kind: "keypress", selector: GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR/u, /repeat: Math\.abs\(delta\)/u, /physicalInputCount !== 1/u, /browserOutcome !== "CONFIRMED"/u, /mutationOutcome !== "confirmed"/u, /readbackScale\.min !== observedScale\.min/u, /readbackScale\.max !== observedScale\.max/u, /readbackScale\.currentBefore !== resolvedValue/u, /decision: "ACT"/u].every(pattern => pattern.test(reasoning))









     && !/decision: "DONE"/u.test(reasoning)
    && observation.includes('value.reasoningMinimum === "0"') && observation.includes('/^(?:0|[1-5])$/u.test(max)')
    && observation.includes('/^(?:0|[1-5])$/u.test(now)') && observation.includes("Number(now) <= Number(max)"),
  "gpt/reasoning-requirement-resolution", reasoningPath, "Reasoning requires an approved bounded scale, one action and fresh exact resolved-value readback.", findings, finding);
  const selectors = text(context, child("select_gpt_reasoning_from_start_v3", "selectors.ts"));
  check(["GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR", "GPT_PROFILE_REASONING_CLICK_SELECTOR", "GPT_PROFILE_REASONING_THUMB_SELECTOR",
    "[role='menuitem'][data-reasoning-slider='true']", "[data-model-picker-power-slider] [role='slider']"].every(token => selectors.includes(token)),
  "gpt/reasoning-approved-scale-contract", child("select_gpt_reasoning_from_start_v3", "selectors.ts"), "Reasoning uses the frozen enabled-control and thumb selectors.", findings, finding);
};
const inspectProfileSchema = (context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory): void => {
  const schema = text(context, `${ROOT}/schema.ts`);
  check(['z.literal("gpt-execution-profile.v3")', 'startModelDisplayName: z.enum(["最新", "GPT-5.6 Sol"])',
    "requestedReasoningValue: z.number().int().min(0).max(5)"].every(token => schema.includes(token))
    && !/gpt-execution-profile\.v[12]|selectionPolicy|accountCapabilityRef|modelFamily|pro_extended/u.test(schema),
  "gpt/profile-v3-start-target", `${ROOT}/schema.ts`, "Execution profile uses only the frozen V3 closed model and numeric requirement.", findings, finding);
};

const inspectCoherentContracts = (context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory): void => {
  const path = `${ROOT}/web/gpt-dom-observation.ts`, source = sourceFor(context, path);
  const coherent = source?.getTypeAlias("GptCoherentObservation")?.getTypeNode()?.getText() ?? "";
  const assistant = source?.getTypeAlias("GptExactAssistantTurnObservation")?.getTypeNode()?.getText() ?? "";
  check(["exactCallIdentityHash", "targetRefHash", "documentRefHash", "currentUrl", "observationRevisionHash"].every(field => coherent.includes(`${field}:`))
    && !/claimOrigin|rawDomHtml|semanticText/u.test(coherent)
    && ["rawDomHtml", "rawDomHash", "semanticText", "semanticTextHash"].every(field => assistant.includes(`${field}:`)),
  "gpt/coherent-page-fact-contract", path, "Coherent DOM facts and exact assistant raw content retain their distinct frozen contracts.", findings, finding);
};
const inspectExactAssistantChannel = (context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory): void => {
  const path = `${ROOT}/web/gpt-dom-observation.ts`, source = sourceFor(context, path);
  const readAssistant = source?.getVariableDeclaration("readExactAssistantTurn")?.getInitializer();
  const request = readAssistant?.getDescendantsOfKind(SyntaxKind.CallExpression).find(call => call.getExpression().getText() === "browser.executeDomIntent")?.getArguments()[0];
  const validContent = source?.getVariableDeclaration("exactAssistantContentValid")?.getInitializer()?.getText() ?? "";
  check(Node.isObjectLiteralExpression(request) && names(request.getProperties()).join("|") === "canonicalConversationUrl|kind|turnMarker"
    && initializerText(request, "kind") === '"readExactAssistantTurn"'
    && ["turnMarker", "canonicalConversationUrl"].every(name => {
      const property = request.getProperty(name);
      return Node.isShorthandPropertyAssignment(property) || Node.isPropertyAssignment(property) && property.getInitializer()?.getText() === name;
    })
    && readAssistant?.getDescendantsOfKind(SyntaxKind.ReturnStatement).some(statement => {
      const expression = statement.getExpression(), argument = Node.isCallExpression(expression) ? expression.getArguments()[0] : undefined;
      if (!Node.isObjectLiteralExpression(argument)) return false;
      return ["rawDomHtml", "rawDomHash", "semanticText", "semanticTextHash", "targetRefHash", "documentRefHash",
        "observationRevisionHash", "assistantTurnId", "precedingUserTurnId", "currentUrl", "observedAt", "generatingRaw", "exactCallIdentityHash"]
        .every(name => initializerText(argument, name).split(" as ")[0] === `value.${name}`);
    }) === true
    && readAssistant?.getText().includes("!exactAssistantIdentityValid(value) || value.currentUrl !== canonicalConversationUrl") === true
    && readAssistant.getText().includes("!exactAssistantContentValid(value)")
    && ["hashText(value.rawDomHtml) === value.rawDomHash", "hashText(value.semanticText) === value.semanticTextHash",
      "nonNegativeInteger(value.generatingRaw)", "validObservedAt(value.observedAt)"].every(token => validContent.includes(token)),
  "gpt/exact-assistant-channel", path, "The assistant reader uses its dedicated marker-bound channel and validates raw and semantic hashes.", findings, finding);
};
export const inspectGptCoherentPageProofs = (context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory): void => {
  inspectCoherentContracts(context, findings, finding);
  inspectExactAssistantChannel(context, findings, finding);
  const path = `${ROOT}/web/gpt-dom-observation.ts`, source = sourceFor(context, path);
  const group = text(context, `${ROOT}/ability-group.ts`);
  check(group.includes('child !== "checkpoint_gpt_generated_image" && observation.observationRevisionHash === null')
    && group.includes("GPT_OBSERVATION_REVISION_REQUIRED"), "gpt/success-revision-required", `${ROOT}/ability-group.ts`,
  "Successful DOM proofs require a revision; authenticated image byte evidence keeps its distinct contract.", findings, finding);
  const decoder = source?.getVariableDeclaration("decodeCoherentObservationPacket")?.getInitializer()?.getText() ?? "";
  check(/packet\.schemaVersion !== "grasseye\.browser\.dom-observation\.v2"/u.test(decoder)
    && /packet\.currentUrl\.length === 0/u.test(decoder) && /packet\.queries\.length !== queries\.length/u.test(decoder)
    && decoder.includes("packet.observationRevisionHash].every") && decoder.includes("/^sha256:[a-f0-9]{64}$/u.test")
    && /throw executionFailure\("failed", "GPT_DOM_COHERENT_PACKET_INVALID"\)/u.test(decoder),
  "gpt/coherent-page-decoder", path, "Coherent packets require exact schema, hashes, URL, revision and query cardinality.", findings, finding);
  const confirm = source?.getVariableDeclaration("readConfirmedCoherentObservation")?.getInitializer()?.getText() ?? "";
  check(/for \(const stage of \[0, 1, 2\] as const\)/u.test(confirm)
    && confirm.indexOf("await awaitConfirmationStage(browser, stage, signal)") < confirm.indexOf("await readConfirmationStage(browser, queries, stage)")
    && /browser\.target\.targetRef !== targetRef \|\| browser\.document\.documentRef !== documentRef/u.test(confirm)
    && /baseline !== null && !sameObservationIdentity\(baseline, observation\)/u.test(confirm)
    && /GPT_DOM_CONFIRMATION_IDENTITY_CHANGED/u.test(confirm), "gpt/transient-dom-confirmation-owner", path,
  "Transient observations use three Browser-owned stages under unchanged exact Target, Document and observation identity.", findings, finding);
  const pageGate = text(context, "src/lib/browser/chrome-extension/chatgpt-page-access-gate.ts");
  check(pageGate.includes("TRANSIENT_DOM_CONFIRMATION_DELAYS_MS") && pageGate.includes("1_500") && pageGate.includes("3_000"),
    "gpt/transient-dom-confirmation-owner", path, "The Browser owns both confirmation delays.", findings, finding);
  for (const current of context.project.getSourceFiles().filter(file => file.getFilePath().startsWith(`${resolve(context.sealedRoot, CHILDREN)}/`))) {
    const legacy = current.getDescendantsOfKind(SyntaxKind.CallExpression).some(call =>
      /(?:^|\.)(?:findCount|readExactAttribute|readExactCanonicalPromptText|readExactObservedResponse|readExactSemanticText|readExactText)$/u.test(call.getExpression().getText()));
    check(!legacy, "gpt/no-legacy-page-proof", current.getFilePath(), "Current Child slices cannot assemble page proof through retired scalar reads.", findings, finding);
  }
};

export const inspectGptContractDenominator = (context: InspectorContext, findings: InspectorFinding[], finding: FindingFactory): void => {
  const source = sourceFor(context, CONTRACT), contracts = objectInitializer(source, "GPT_CHILD_CONTRACTS");
  check(!!source && !!contracts, "gpt/contract-present", CONTRACT, "The unique public GPT contract must exist.", findings, finding);
  if (!source || !contracts) return;
  check(JSON.stringify(names(contracts.getProperties())) === JSON.stringify(expectedIds), "gpt/exact-child-denominator", CONTRACT,
    "The public denominator is the fourteen frozen Child identities.", findings, finding);
  check(source.getVariableDeclaration("GPT_CHILD_CAPABILITY_CONTRACTS")?.getInitializer()?.getText() === "Object.freeze(GPT_CHILD_CONTRACTS)",
    "gpt/denominator-derived-once", CONTRACT, "The public projection derives only from GPT_CHILD_CONTRACTS.", findings, finding);
  const decisions: Record<string, readonly string[]> = {
    acknowledge_known_gpt_rate_limit: ["ACT", "FAIL_CLOSED"], attach_approved_gpt_files_once: ["DONE", "ACT", "FAIL_CLOSED"],
    get_submitted_gpt_conversation_url: ["DONE", "WAIT", "FAIL_CLOSED"],
    checkpoint_gpt_generated_image: ["DONE", "FAIL_CLOSED"], checkpoint_gpt_text_response: ["DONE", "FAIL_CLOSED"],
    close_gpt_execution_profile: ["DONE", "ACT", "FAIL_CLOSED"], open_gpt_attachment_control: ["DONE", "ACT", "WAIT", "FAIL_CLOSED"],
    open_gpt_execution_profile: ["DONE", "ACT", "WAIT", "FAIL_CLOSED"], open_gpt_model_selector_v3: ["DONE", "ACT", "FAIL_CLOSED"],
    prepare_clean_gpt_chat: ["DONE", "ACT", "WAIT", "FAIL_CLOSED"], reconcile_gpt_attachment_set: ["DONE", "WAIT", "FAIL_CLOSED"],
    select_gpt_model_from_start_v3: ["ACT", "FAIL_CLOSED"], select_gpt_reasoning_from_start_v3: ["ACT", "FAIL_CLOSED"],
    submit_exact_gpt_turn_once: ["ACT", "FAIL_CLOSED"], write_exact_gpt_prompt: ["DONE", "ACT", "WAIT", "FAIL_CLOSED"],
  };
  for (const [id, [version, inputVersion, profile]] of Object.entries(CHILDREN_CONTRACT)) {
    const property = contracts.getProperty(id), value = Node.isPropertyAssignment(property)
      ? property.getInitializerIfKind(SyntaxKind.ObjectLiteralExpression) : undefined;
    const observation = profile === "DOM_OBSERVATION";
    const exactOne = ["acknowledge_known_gpt_rate_limit", "select_gpt_model_from_start_v3",
      "select_gpt_reasoning_from_start_v3", "submit_exact_gpt_turn_once"].includes(id);
    const budget = observation ? "zero" : exactOne ? "exactly-one-browser-input" : "zero-or-one-browser-input";
    const replay = observation ? "observation-only" : profile === "PROVIDER_EFFECT_ONCE" ? "provider-effect-once" : "target-local-per-generation";
    check(initializerText(value, "mutationBudget") === JSON.stringify(budget)
      && initializerText(value, "replayPolicy") === JSON.stringify(replay)
      && initializerText(value, "oneObservationOrMutation") === JSON.stringify(observation ? "bounded-observation" : "at-most-one-mutation")
      && initializerText(value, "decisions").replace(/\s/gu, "") === JSON.stringify(decisions[id]),
    "gpt/child-action-budget-frozen", CONTRACT, `${id} action budget, decisions and replay policy are frozen.`, findings, finding);
    check(initializerText(value, "contractVersion") === String(version)
      && initializerText(value, "inputSchema").endsWith(`.input.v${inputVersion}"`)
      && initializerText(value, "profile") === JSON.stringify(profile), "gpt/profile-v2-contract-cutover", CONTRACT,
    `${id} must retain contract/input/profile ${version}/${inputVersion}/${profile}.`, findings, finding);
  }
  inspectPrivateSlices(context, findings, finding);
  inspectShapes(context, source, findings, finding);
  inspectModelEntry(context, findings, finding);
  inspectModelSelection(context, findings, finding);
  inspectReasoningAction(context, findings, finding);
  inspectProfileSchema(context, findings, finding);
};
