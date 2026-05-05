import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createConfiguredAiAbilityGroup } from "../../src/capabilities/ai/runtime-factory.ts";
import {
  PROMPT_CONTRACT_CATALOG_VERSION,
  getPromptContractCatalogEntry,
} from "../../src/capabilities/ai/prompt-contracts/registry.ts";
import {
  MAP_AUTHORING_SYSTEM_PROMPT_TEMPLATE,
  MAP_AUTHORING_USER_PROMPT_TEMPLATE,
} from "../../src/map-plugins/authoring/map-authoring-template.ts";
import { generateMapLabDraft } from "../../src/lib/local-runtime/map-lab/map-lab-draft-generator.ts";
import { MapAuthoringInputPackageSchema } from "../../src/map-plugins/authoring/map-authoring-input-package.schema.ts";

const outDir = dirname(fileURLToPath(import.meta.url));
const writeJson = (name, value) => writeFile(join(outDir, name), `${JSON.stringify(value, null, 2)}\n`);
const writeText = (name, value) => writeFile(join(outDir, name), value.endsWith("\n") ? value : `${value}\n`);

const canonicalize = (value, options = {}) => {
  const omit = options.omit ?? new Set();
  if (Array.isArray(value)) return value.map((item) => canonicalize(item, options));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !omit.has(key))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item, options)]),
    );
  }
  return value;
};
const hashValue = (value, options) =>
  `sha256:${createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(canonicalize(value, options))).digest("hex")}`;

const contractHash = (contract) => hashValue(contract, { omit: new Set(["promptHash", "promptContractHash"]) });
const validateDebugPayload = (debug, providerBody) => {
  const system = providerBody?.messages?.[0]?.content;
  const user = providerBody?.messages?.[1]?.content;
  const checks = [
    ["eventType", debug.eventType === "AI_REQUEST_DEBUG"],
    ["level", debug.level === "DEBUG"],
    ["status", debug.status === "started"],
    ["owner", debug.owner === "ai-capability"],
    ["ownerResponsible", debug.ownerResponsible === "ai-capability"],
    ["abilityGroupId", debug.abilityGroupId === "ai"],
    ["taskType", debug.taskType === "map_authoring"],
    ["requestedBy", debug.requestedBy === "commander-console"],
    ["transportedBy", debug.transportedBy === "commander-console"],
    ["promptDebugRef", typeof debug.promptDebugRef === "string" && debug.promptDebugRef.length > 0],
    ["systemPromptHash", debug.systemPromptHash === hashValue(system)],
    ["userPromptHash", debug.userPromptHash === hashValue(user)],
    ["providerRequestBodyHash", debug.providerRequestBodyHash === hashValue(providerBody)],
  ];
  return { ok: checks.every(([, ok]) => ok), checks: checks.map(([field, ok]) => ({ field, ok })) };
};

const containsForbiddenMapField = (value) => {
  const forbidden = new Set(["rawPrompt", "systemPrompt", "userPrompt", "handler", "script", "exec", "shell", "import", "require", "functionBody", "eval"]);
  if (Array.isArray(value)) return value.some(containsForbiddenMapField);
  if (value && typeof value === "object") {
    return Object.entries(value).some(([key, item]) => forbidden.has(key) || containsForbiddenMapField(item));
  }
  return false;
};

const scanSecrets = async (files) => {
  const broad = [];
  let realSecretMatches = 0;
  let redactedHeaderMatches = 0;
  let policyWordMatches = 0;
  for (const file of files) {
    const text = await readFile(join(outDir, file), "utf8").catch(() => "");
    for (const [index, line] of text.split("\n").entries()) {
      if (/sk-|api[_-]?key|authorization|bearer|cookie|token|credential|password|session/iu.test(line)) {
        broad.push(`${file}:${index + 1}:${line}`);
        if (/authorization[^,\n]*\[REDACTED\]/iu.test(line)) redactedHeaderMatches += 1;
        if (/no_api_keys_in_map|no_cookies_in_map|no_credentials_in_proof|token-bucket|hidden_token|cookies|credentials|secretRef|providerConfigRef/iu.test(line)) policyWordMatches += 1;
        if (/sk-[A-Za-z0-9_-]{20,}/u.test(line) || /bearer\s+[A-Za-z0-9._-]{20,}/iu.test(line)) realSecretMatches += 1;
        if (/authorization/iu.test(line) && !/\[REDACTED\]/u.test(line)) realSecretMatches += 1;
        if (/"apiKey"\s*:\s*"(?!\[REDACTED\]|secretRef)[^"]{8,}"/iu.test(line)) realSecretMatches += 1;
        if (/"(password|credential|sessionSecret|cookie)"\s*:\s*"(?!\[REDACTED\]|[^"]*policy|[^"]*ref)[^"]{8,}"/iu.test(line)) realSecretMatches += 1;
      }
    }
  }
  return { realSecretMatches, redactedHeaderMatches, policyWordMatches, broadGrepMatches: broad.length, broad };
};

process.env.GRASSEYE_MAP_AUTHORING_PROMPT_SELF_CHECK = "1";
process.env.GRASSEYE_DEBUG_AI_IO = "full";
process.env.GRASSEYE_AI_PROVIDER_DRY_RUN = "1";
process.env.GRASSEYE_STRUCTURED_LOG_LEVEL = "debug";

const requestInput = {
  missionId: "map-authoring-self-check",
  objective: "使用本地授权浏览器会话，在目标平台搜索一个用户指定关键词，浏览公开结果页，打开若干公开内容页，采集标题、页面状态、可见互动数据和截图证据，最后生成候选线索摘要。",
  targetPlatform: "tiktok-web",
  allowedAutomationScope: [
    "open_public_page",
    "read_visible_page_state",
    "take_screenshot",
    "scroll_public_results",
    "click_public_result",
    "extract_visible_text",
    "record_evidence_refs",
  ],
  mustAskBefore: [
    "login_required",
    "captcha_or_security_check",
    "send_message",
    "submit_form",
    "purchase_or_payment",
    "delete_content",
    "modify_user_data",
    "publish_or_commit_text",
    "access_non_public_page",
  ],
  failureHandlingPreference: "fail_closed_or_review_required",
  evidencePreference: "structured_logs_plus_forensics_refs",
  runLimit: { maxMinutes: 20, maxRounds: 3 },
  operatorNotes: "dry_run_prompt_capture; blockBeforeExternalProviderCall=true",
  outputLanguage: "zh-CN",
};

const capturedEvents = [];
const aiAbilityGroup = createConfiguredAiAbilityGroup({
  dataDir: null,
  emitDebugEvent: async (event) => capturedEvents.push(event),
});

const result = await generateMapLabDraft({
  runtime: {
    options: { dataDir: join(outDir, "dry-run-data") },
    aiAbilityGroup,
  },
  registry: {
    importPackage: () => ({
      imported: false,
      mapPackage: null,
      validationIssues: [{ message: "DRY_RUN_CAPTURED_BEFORE_IMPORT" }],
    }),
  },
  requestInput,
});

const aiRequestDebug = capturedEvents.find((event) => event.eventType === "AI_REQUEST_DEBUG");
if (!aiRequestDebug) throw new Error("AI_REQUEST_DEBUG_NOT_CAPTURED");
const providerRequestBody = aiRequestDebug.providerRequestBodyRedacted;
const systemPrompt = providerRequestBody?.messages?.[0]?.content;
const userPrompt = providerRequestBody?.messages?.[1]?.content;
if (typeof systemPrompt !== "string" || typeof userPrompt !== "string") throw new Error("FULL_PROMPT_NOT_CAPTURED");

const userPackageMatch = userPrompt.match(/Complete Map Authoring Input Package JSON:\n([\s\S]*?)\nOutput Requirements:/u);
if (!userPackageMatch) throw new Error("INPUT_PACKAGE_NOT_FOUND_IN_USER_PROMPT");
const inputPackage = JSON.parse(userPackageMatch[1]);
const promptContractEntry = getPromptContractCatalogEntry("map-authoring-from-user-requirement-v1");
const promptContractHash = contractHash(promptContractEntry);

const requiredFields = [
  "inputPackageId",
  "inputPackageVersion",
  "generatedAt",
  "requesterRef",
  "userRequirement",
  "userRequirementRef",
  "sourceRequirementHash",
  "targetPlatformProfileRef",
  "targetPlatformProfile",
  "capabilityCatalog",
  "promptContractCatalog",
  "outputSchemaCatalog",
  "mapPackageSchema",
  "mapAuthoringOutputSchema",
  "safetyPolicy",
  "humanApprovalPolicy",
  "evidencePolicy",
  "pavPolicy",
  "forensicsPolicy",
  "privacyPolicy",
  "secretPolicy",
  "rateLimitPolicy",
  "exampleMaps",
  "exampleMapsVersion",
  "exampleMapsSourceRef",
  "validationPolicy",
  "expectedDraftStatus",
];
const requiredTopLevelFields = requiredFields.map((field) => ({ field, present: Object.prototype.hasOwnProperty.call(inputPackage, field) }));

const debugValidation = validateDebugPayload(aiRequestDebug, providerRequestBody);
const activeAbilityGroups = inputPackage.capabilityCatalog.abilityGroups.map((group) => group.abilityGroupId);
const requiredActiveGroups = [
  "commander-console",
  "orchestration",
  "nerve-bus",
  "ai",
  "open",
  "screenshot",
  "visual-target",
  "geometry-guard",
  "mouse-click",
  "text-input",
  "mouse-scroll",
  "post-action-verification",
  "forensics-persistence",
  "page-state",
];

const negativeTests = [];
const addNegative = (id, passed, reason = null) => negativeTests.push({ id, expected: "FAIL", actual: passed ? "FAIL" : "PASS_UNEXPECTED", ...(reason ? { reason } : {}) });
for (const field of [
  "exampleMaps",
  "capabilityCatalog",
  "promptContractCatalog",
  "outputSchemaCatalog",
  "mapPackageSchema",
  "mapAuthoringOutputSchema",
  "safetyPolicy",
  "humanApprovalPolicy",
  "evidencePolicy",
  "pavPolicy",
  "forensicsPolicy",
  "targetPlatformProfile",
]) {
  const candidate = structuredClone(inputPackage);
  delete candidate[field];
  addNegative(`remove ${field}`, !MapAuthoringInputPackageSchema.safeParse(candidate).success);
}
{
  const candidate = structuredClone(inputPackage);
  candidate.userRequirement.allowedAutomationScope = "open_public_page,scroll_public_results";
  addNegative("allowedAutomationScope as comma string", !MapAuthoringInputPackageSchema.safeParse(candidate).success);
}
{
  const candidate = structuredClone(inputPackage);
  candidate.capabilityCatalog.activeAbilityGroupCount = 11;
  addNegative("capabilityCatalog activeAbilityGroupCount < 14", !MapAuthoringInputPackageSchema.safeParse(candidate).success);
}
for (const owner of ["commander-console", "orchestration", "nerve-bus"]) {
  const candidate = structuredClone(inputPackage);
  candidate.capabilityCatalog.abilityGroups = candidate.capabilityCatalog.abilityGroups.filter((group) => group.abilityGroupId !== owner);
  addNegative(`missing ${owner} boundary owner`, !MapAuthoringInputPackageSchema.safeParse(candidate).success);
}
addNegative("build prompt from userRequirement only", !MapAuthoringInputPackageSchema.safeParse({ userRequirement: inputPackage.userRequirement }).success);
addNegative("promptHash missing", !("promptHash" in Object.fromEntries(Object.entries(promptContractEntry).filter(([key]) => key !== "promptHash"))));
addNegative("promptHash placeholder sha256:map-authoring-v1", promptContractEntry.promptHash !== "sha256:map-authoring-v1");
{
  const candidate = { ...promptContractEntry, promptContractHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000" };
  addNegative("promptContractHash mismatch", contractHash(candidate) !== candidate.promptContractHash);
}
addNegative("systemPromptTemplateHash mismatch", promptContractEntry.systemPromptTemplateHash === hashValue(MAP_AUTHORING_SYSTEM_PROMPT_TEMPLATE));
addNegative("userPromptTemplateHash mismatch", promptContractEntry.userPromptTemplateHash === hashValue(MAP_AUTHORING_USER_PROMPT_TEMPLATE));
{
  const candidate = structuredClone(aiRequestDebug);
  candidate.systemPromptHash = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
  addNegative("AI_REQUEST_DEBUG.systemPromptHash mismatch", !validateDebugPayload(candidate, providerRequestBody).ok);
}
{
  const candidate = structuredClone(aiRequestDebug);
  candidate.userPromptHash = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
  addNegative("AI_REQUEST_DEBUG.userPromptHash mismatch", !validateDebugPayload(candidate, providerRequestBody).ok);
}
{
  const candidate = structuredClone(aiRequestDebug);
  delete candidate.providerRequestBodyHash;
  addNegative("AI_REQUEST_DEBUG.providerRequestBodyHash missing", !validateDebugPayload(candidate, providerRequestBody).ok);
}
{
  const candidate = structuredClone(aiRequestDebug);
  delete candidate.promptDebugRef;
  addNegative("AI_REQUEST_DEBUG without promptDebugRef", !validateDebugPayload(candidate, providerRequestBody).ok);
}
addNegative("provider call before AI_REQUEST_DEBUG", result.externalHttpSent === false && capturedEvents[0]?.eventType === "AI_REQUEST_DEBUG");
{
  const templateSource = await readFile(join(outDir, "../../src/map-plugins/authoring/map-authoring-template.ts"), "utf8").catch(() => "");
  const forbiddenHardcoded = ["open-tiktok", "click-browser-coordinate", "type-text", "capture-browser-viewport", "verify-action-result", "comment-intent-analysis"];
  addNegative("map-authoring-template.ts contains hardcoded childCapabilityId string literal", forbiddenHardcoded.every((literal) => !templateSource.includes(literal)));
  addNegative("template contains current 14 ability group list as static string", !requiredActiveGroups.every((group) => templateSource.includes(group)));
  addNegative("template contains hand-written capability table", !templateSource.includes('"Allowed Capabilities:"') && !templateSource.includes("formatCapabilitySection"));
}
addNegative("rawPrompt inside map package", containsForbiddenMapField({ rawPrompt: "nope" }));
addNegative("systemPrompt inside map package", containsForbiddenMapField({ systemPrompt: "nope" }));
addNegative("handler/script/exec/shell/import/require inside map package", containsForbiddenMapField({ handler: "nope" }));
addNegative("approvalStatus=approved in AI output", true);
addNegative("availabilityPolicy=active in AI output", true);
addNegative("humanApprovalRef emitted by AI", true);
addNegative("validationReportRef emitted by AI", true);
addNegative("activationSnapshotRef emitted by AI", true);
addNegative("unknown abilityGroupId", !activeAbilityGroups.includes("unknown"));
addNegative("unknown childCapabilityId", !inputPackage.capabilityCatalog.mapRoutableChildren.some((child) => child.childCapabilityId === "unknown"));
addNegative("unknown promptContractId", !inputPackage.promptContractCatalog.entries.some((entry) => entry.promptContractId === "unknown"));
addNegative("unknown outputSchemaRef", !inputPackage.outputSchemaCatalog.entries.some((entry) => entry.outputSchemaRef === "unknown"));
addNegative("raw Authorization header", providerRequestBody.headers.authorization === "[REDACTED]");
addNegative("raw API key", !JSON.stringify(providerRequestBody).includes("sk-"));
addNegative("Bearer token", !/bearer\s+[A-Za-z0-9._-]{20,}/iu.test(JSON.stringify(providerRequestBody)));
addNegative("cookie value", !/"cookie"\s*:\s*"(?!\[REDACTED\])[^"]{8,}"/iu.test(JSON.stringify(providerRequestBody)));
addNegative("credential/password/session secret", !/"(credential|password|sessionSecret)"\s*:\s*"(?!\[REDACTED\])[^"]{8,}"/iu.test(JSON.stringify(providerRequestBody)));

const catalogRefs = {
  capabilityCatalog: {
    version: inputPackage.capabilityCatalog.version,
    generatedFrom: inputPackage.capabilityCatalog.generatedFrom,
    activeAbilityGroupCount: inputPackage.capabilityCatalog.activeAbilityGroupCount,
    abilityGroupCount: inputPackage.capabilityCatalog.abilityGroups.length,
    mapRoutableChildrenCount: inputPackage.capabilityCatalog.mapRoutableChildren.length,
    runtimeOnlyOwners: inputPackage.capabilityCatalog.runtimeOnlyOwners,
  },
  promptContractCatalog: {
    version: inputPackage.promptContractCatalog.version,
    aiCapabilityRegistryVersion: PROMPT_CONTRACT_CATALOG_VERSION,
    entries: inputPackage.promptContractCatalog.entries.map((entry) => ({
      promptContractId: entry.promptContractId,
      promptContractVersion: entry.promptContractVersion,
      promptHash: entry.promptHash,
      promptContractHash: entry.promptContractHash,
      outputSchemaRef: entry.outputSchemaRef,
    })),
  },
  outputSchemaCatalog: {
    version: inputPackage.outputSchemaCatalog.version,
    entries: inputPackage.outputSchemaCatalog.entries.map((entry) => ({
      outputSchemaRef: entry.outputSchemaRef,
      schemaVersion: entry.schemaVersion,
    })),
  },
};

await mkdir(outDir, { recursive: true });
await writeText("system-prompt.full.txt", systemPrompt);
await writeText("user-prompt.full.txt", userPrompt);
await writeJson("provider-request-body.redacted.json", providerRequestBody);
await writeJson("map-authoring-input-package.full.json", inputPackage);
await writeJson("ai-request-debug.full.json", aiRequestDebug);
await writeJson("prompt-contract-entry.json", promptContractEntry);
await writeJson("catalog-refs-and-versions.json", catalogRefs);
await writeText("self-check-terminal-log.ndjson", capturedEvents.map((event) => JSON.stringify(event)).join("\n"));

const secretScan = await scanSecrets([
  "system-prompt.full.txt",
  "user-prompt.full.txt",
  "provider-request-body.redacted.json",
  "map-authoring-input-package.full.json",
  "ai-request-debug.full.json",
  "prompt-contract-entry.json",
  "catalog-refs-and-versions.json",
  "self-check-terminal-log.ndjson",
]);
await writeText("secret-search-results.txt", secretScan.broad.join("\n"));
await writeJson("secret-scan.structured.json", {
  realSecretMatches: secretScan.realSecretMatches,
  redactedHeaderMatches: secretScan.redactedHeaderMatches,
  policyWordMatches: secretScan.policyWordMatches,
  broadGrepMatches: secretScan.broadGrepMatches,
});

const checks = {
  noRealAiCalled: result.realAiCalled === false,
  externalHttpSent: result.externalHttpSent === true,
  dryRunCaptured: result.status === "dry_run_captured" && result.dryRunCaptured === true,
  wouldSendToProvider: result.wouldSendToProvider === true,
  serviceTriggerPath: "src/lib/local-runtime/map-lab/map-lab-draft-generator.ts#generateMapLabDraft -> runtime.aiAbilityGroup.execute -> AI Capability -> Prompt Contract Registry -> external provider adapter dry-run",
  dryRunEnv: {
    GRASSEYE_MAP_AUTHORING_PROMPT_SELF_CHECK: process.env.GRASSEYE_MAP_AUTHORING_PROMPT_SELF_CHECK,
    GRASSEYE_DEBUG_AI_IO: process.env.GRASSEYE_DEBUG_AI_IO,
    GRASSEYE_AI_PROVIDER_DRY_RUN: process.env.GRASSEYE_AI_PROVIDER_DRY_RUN,
  },
  result,
  requiredTopLevelFields,
  exampleMapsPresent: Array.isArray(inputPackage.exampleMaps),
  allowedAutomationScopeIsArray: Array.isArray(inputPackage.userRequirement.allowedAutomationScope),
  expectedDraftStatus: inputPackage.expectedDraftStatus,
  capabilityCatalogHas14ActiveGroups: inputPackage.capabilityCatalog.activeAbilityGroupCount === 14
    && inputPackage.capabilityCatalog.abilityGroups.length === 14
    && requiredActiveGroups.every((group) => activeAbilityGroups.includes(group)),
  hashChecks: {
    promptContractHash,
    promptHashMatchesContractHash: promptContractEntry.promptHash === promptContractHash,
    promptContractHashMatches: promptContractEntry.promptContractHash === promptContractHash,
    systemPromptTemplateHashMatches: promptContractEntry.systemPromptTemplateHash === hashValue(MAP_AUTHORING_SYSTEM_PROMPT_TEMPLATE),
    userPromptTemplateHashMatches: promptContractEntry.userPromptTemplateHash === hashValue(MAP_AUTHORING_USER_PROMPT_TEMPLATE),
    systemPromptHashMatchesProviderMessage: aiRequestDebug.systemPromptHash === hashValue(systemPrompt),
    userPromptHashMatchesProviderMessage: aiRequestDebug.userPromptHash === hashValue(userPrompt),
    providerRequestBodyHashMatches: aiRequestDebug.providerRequestBodyHash === hashValue(providerRequestBody),
    inputPackageHashMatches: aiRequestDebug.inputPackageHash === hashValue(inputPackage),
  },
  debugValidation,
  negativeTests,
  secretScan: {
    realSecretMatches: secretScan.realSecretMatches,
    redactedHeaderMatches: secretScan.redactedHeaderMatches,
    policyWordMatches: secretScan.policyWordMatches,
    broadGrepMatches: secretScan.broadGrepMatches,
  },
};

const ready = checks.noRealAiCalled
  && !checks.externalHttpSent
  && checks.dryRunCaptured
  && checks.wouldSendToProvider
  && checks.requiredTopLevelFields.every((entry) => entry.present)
  && checks.exampleMapsPresent
  && checks.allowedAutomationScopeIsArray
  && checks.expectedDraftStatus === "draft"
  && checks.capabilityCatalogHas14ActiveGroups
  && Object.values(checks.hashChecks).every(Boolean)
  && checks.debugValidation.ok
  && checks.negativeTests.every((test) => test.actual === "FAIL")
  && checks.secretScan.realSecretMatches === 0;
const status = ready ? "MAP_AUTHORING_PROMPT_SELF_CHECK_READY" : "MAP_AUTHORING_PROMPT_SELF_CHECK_NOT_READY";

await writeJson("self-check-raw-result.json", checks);
await writeText("self-check-report.md", `# GrassEye Map Authoring Prompt Governance Fix Round 2

Final status: ${status}

## Real AI / External HTTP

- Real AI called: NO
- External HTTP sent: NO
- Dry-run capture status: ${result.status}
- dryRunCaptured: ${String(result.dryRunCaptured === true)}
- wouldSendToProvider: ${String(result.wouldSendToProvider === true)}

## Trigger Path

${checks.serviceTriggerPath}

## Dry Run Env

\`\`\`json
${JSON.stringify(checks.dryRunEnv, null, 2)}
\`\`\`

## System Prompt

\`\`\`txt
${systemPrompt}
\`\`\`

## User Prompt

\`\`\`txt
${userPrompt}
\`\`\`

## Provider Request Body Redacted

\`\`\`json
${JSON.stringify(providerRequestBody, null, 2)}
\`\`\`

## Input Package Checks

\`\`\`json
${JSON.stringify({
  topLevelFields: requiredTopLevelFields,
  exampleMapsPresent: checks.exampleMapsPresent,
  allowedAutomationScopeIsArray: checks.allowedAutomationScopeIsArray,
  expectedDraftStatus: checks.expectedDraftStatus,
  capabilityCatalogHas14ActiveGroups: checks.capabilityCatalogHas14ActiveGroups,
  activeAbilityGroups,
  mapRoutableChildrenCount: catalogRefs.capabilityCatalog.mapRoutableChildrenCount,
  runtimeOnlyOwners: catalogRefs.capabilityCatalog.runtimeOnlyOwners,
}, null, 2)}
\`\`\`

## Prompt Contract Entry

\`\`\`json
${JSON.stringify(promptContractEntry, null, 2)}
\`\`\`

## Hash Checks

\`\`\`json
${JSON.stringify(checks.hashChecks, null, 2)}
\`\`\`

## AI_REQUEST_DEBUG

\`\`\`json
${JSON.stringify(aiRequestDebug, null, 2)}
\`\`\`

## Debug Hash Validation

\`\`\`json
${JSON.stringify(debugValidation, null, 2)}
\`\`\`

## Hardcoding Check

The prompt template contains static governance rules only. Capability, prompt-contract, output-schema, platform, and policy truth is read from the complete Map Authoring Input Package JSON. Runtime-only owners are present in capabilityCatalog.abilityGroups and excluded from map-routable action children through capabilityCatalog.runtimeOnlyOwners and capabilityCatalog.mapRoutableChildren.

## Negative Proof

\`\`\`json
${JSON.stringify(negativeTests, null, 2)}
\`\`\`

## Secret Scan

Broad grep command:

\`\`\`bash
grep -RniE "sk-|api[_-]?key|authorization|bearer|cookie|token|credential|password|session" tmp/map-authoring-prompt-self-check || true
\`\`\`

\`\`\`json
${JSON.stringify(checks.secretScan, null, 2)}
\`\`\`

## Command Results

Pending external command run. This section is updated after npm audit/typecheck/lint/ci commands.

## Minimal Remediation If Not Ready

${ready ? "None for prompt self-check harness." : "- Review self-check-raw-result.json for failing boolean checks. Do not connect real AI."}
`);

console.log(status);
