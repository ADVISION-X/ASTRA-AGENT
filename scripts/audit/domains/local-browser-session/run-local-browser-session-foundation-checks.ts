import { readTextFile } from "../../core/filesystem.js";
import { pathFromRepoRoot } from "../../core/paths.js";
import { createFinding, createPhase } from "../../core/result.js";
import type { Finding, InspectorPhase } from "../../core/schema.js";
import { getAuditProject, getSourceFileOrThrow } from "../../core/ts-morph.js";

import { localBrowserSessionInspectionConstants as config } from "./inspection-constants.js";
import { localBrowserSessionInspectionUtils as utils } from "./inspection-utils.js";

const { BLUEPRINT_PATH, LAW_ID, LAW_PATH, REQUIRED_RUNTIME_FIELDS, RUNTIME_PATH, TYPES_PATH } = config;
const { debug, getTypeAliasPropertyNames, getZodEnumValues, getZodObjectPropertyNames, includesAll } = utils;

const CONFIG_REQUIRED_FIELDS = [
  "browserMode",
  "platform",
  "chromeExecutablePath",
  "profileRef",
  "userDataDir",
  "profileDirectory",
  "profileProvisioning",
  "profileVerificationStatus",
  "profileVerificationReason",
  "headlessAllowed",
  "createdAt",
  "updatedAt",
] as const;

const STATE_REQUIRED_FIELDS = [
  "browserMode",
  "browserProfileRef",
  "profileStatus",
  "profileDirectory",
  "profileProvisioning",
  "profileVerificationStatus",
  "profileVerificationReason",
  "loginState",
  "currentUrl",
  "lastLoginCheckAt",
  "reviewRequiredReason",
] as const;

const BANNED_SCHEMA_FIELDS = ["cookie", "cookies", "session", "sessions", "token", "tokens", "storageState"] as const;

const pushMissingFields = (input: {
  findings: Finding[];
  file: string;
  fields: Set<string>;
  requiredFields: readonly string[];
  schemaName: string;
}): void => {
  for (const requiredField of input.requiredFields) {
    if (!input.fields.has(requiredField)) {
      input.findings.push(createFinding({ lawId: LAW_ID, file: input.file, line: 1, severity: "error", message: `${input.schemaName} is missing ${requiredField}.` }));
    }
  }
};

const pushBannedFields = (findings: Finding[], configFields: Set<string>, stateFields: Set<string>): void => {
  for (const bannedField of BANNED_SCHEMA_FIELDS) {
    if (configFields.has(bannedField) || stateFields.has(bannedField)) {
      findings.push(createFinding({ lawId: LAW_ID, file: TYPES_PATH, line: 1, severity: "fatal", message: `Local browser session schemas must not expose raw ${bannedField} fields.` }));
    }
  }
};

const inspectLawAndBlueprint = async (): Promise<{ findings: Finding[]; lawPassed: boolean; blueprintPassed: boolean }> => {
  const [law, blueprint] = await Promise.all([
    readTextFile(pathFromRepoRoot(LAW_PATH)),
    readTextFile(pathFromRepoRoot(BLUEPRINT_PATH)),
  ]);
  const findings: Finding[] = [];
  const lawPassed = includesAll(law, ["persistent local user profile", "must not store raw cookies", "must not contain raw cookies or tokens", "Headless mode must be disabled by default"]);
  const blueprintPassed = includesAll(blueprint, [
    "real_chrome_persistent",
    ".grasseye-local/browser-profiles/<platform>/",
    "GrassEye 不读取 cookies",
    "当前本地浏览器 handoff 是固定页面打开的简单主路径",
    "open <url>",
    "HANDOFF_FIXED_URL_TO_CURRENT_LOCAL_BROWSER",
    "handoff_fixed_url_to_current_local_browser",
    "profile.last_used",
    "browserProfileDirectory",
    "launch 启动本地服务与打开 workbench 页面，不得依赖",
    "任务必须立刻进入 `review_required`",
    "打开浏览器必须有单一来源代码文件",
    "open -a <Chrome.app> <url>",
    "先复制一个受控 profile 再打开 URL",
  ]);
  if (!lawPassed) {
    findings.push(createFinding({ lawId: LAW_ID, file: LAW_PATH, line: 1, severity: "error", message: "Local browser session law is missing a persistent-profile or cookie-boundary requirement." }));
  }
  if (!blueprintPassed) {
    findings.push(createFinding({ lawId: LAW_ID, file: BLUEPRINT_PATH, line: 1, severity: "error", message: "Local browser session blueprint is missing the current-Chrome or anti-regression guidance for the removed downgrade path." }));
  }
  return { findings, lawPassed, blueprintPassed };
};

const inspectTypeContract = (): Finding[] => {
  const findings: Finding[] = [];
  const project = getAuditProject();
  const typesSource = getSourceFileOrThrow(project, TYPES_PATH);
  const runtimeSource = getSourceFileOrThrow(project, RUNTIME_PATH);
  const browserModes = getZodEnumValues(typesSource, "BrowserModeSchema");
  const configFields = getZodObjectPropertyNames(typesSource, "LocalBrowserSessionConfigSchema");
  const stateFields = getZodObjectPropertyNames(typesSource, "LocalBrowserSessionStateSchema");
  const runtimeFields = getTypeAliasPropertyNames(runtimeSource, "BrowseRuntimeSnapshot");

  if (!browserModes.has("real_chrome_persistent")) {
    findings.push(createFinding({ lawId: LAW_ID, file: TYPES_PATH, line: 1, severity: "fatal", message: "BrowserMode must include real_chrome_persistent." }));
  }
  pushMissingFields({ findings, file: TYPES_PATH, fields: configFields, requiredFields: CONFIG_REQUIRED_FIELDS, schemaName: "LocalBrowserSessionConfigSchema" });
  pushMissingFields({ findings, file: TYPES_PATH, fields: stateFields, requiredFields: STATE_REQUIRED_FIELDS, schemaName: "LocalBrowserSessionStateSchema" });
  pushMissingFields({ findings, file: RUNTIME_PATH, fields: runtimeFields, requiredFields: REQUIRED_RUNTIME_FIELDS, schemaName: "BrowseRuntimeSnapshot" });
  pushBannedFields(findings, configFields, stateFields);
  return findings;
};

export async function runLocalBrowserSessionFoundationChecks(): Promise<{ findings: Finding[]; phases: InspectorPhase[] }> {
  debug("loaded local-browser-session law, blueprint, and type sources");
  const lawAndBlueprint = await inspectLawAndBlueprint();
  const typeFindings = inspectTypeContract();
  const findings = [...lawAndBlueprint.findings, ...typeFindings];

  const typeContractPassed = !findings.some((finding) => finding.file === TYPES_PATH || finding.file === RUNTIME_PATH);

  return {
    findings,
    phases: [
      createPhase("local-browser-session-law", lawAndBlueprint.lawPassed ? "PASS" : "CODE VIOLATION", lawAndBlueprint.lawPassed, lawAndBlueprint.lawPassed ? "Local browser session law defines persistent-profile and cookie privacy boundaries." : "Local browser session law is missing required boundaries."),
      createPhase("local-browser-session-blueprint", lawAndBlueprint.blueprintPassed ? "PASS" : "CODE VIOLATION", lawAndBlueprint.blueprintPassed, lawAndBlueprint.blueprintPassed ? "Blueprint defines current-Chrome handoff, persistent-profile proof, and anti-regression boundaries for the removed downgrade path." : "Blueprint is missing required startup or anti-regression guidance."),
      createPhase("local-browser-session-type-contract", typeContractPassed ? "PASS" : "CODE VIOLATION", typeContractPassed, typeContractPassed ? "Browser and runtime types expose governed profile metadata without raw cookie fields." : "Browser or runtime type contracts are incomplete or expose forbidden fields."),
    ],
  };
}
