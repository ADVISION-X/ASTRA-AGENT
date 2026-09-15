import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import {
  inspectMissingTokens, sourceFor, type FindingFactory,
} from "./gpt-inspection-support.js";

const ROOT = "src/capabilities/gpt";
const CHILD_ID = "rename_settled_gpt_conversation";
const CHILD_PATH = `${ROOT}/children/${CHILD_ID}`;
const CHILD_TYPES_PATH = `${ROOT}/child-types.ts`;
const PRODUCT_API_PATH = `${ROOT}/product-api.ts`;
const PRODUCTION_CHILD_TOOLS_PATH = `${ROOT}/production-child-tools.ts`;
const PRODUCTION_BROWSER_LIFECYCLE_PATH = `${ROOT}/production-browser-lifecycle.ts`;
const HANDLER_PATH = `${CHILD_PATH}/handler.ts`;
const TITLE_PATH = `${CHILD_PATH}/title.ts`;
const occurrences = (text: string, token: string): number => text.split(token).length - 1;

export const inspectSettledConversationRenameBoundary = (
  context: InspectorContext,
  findings: InspectorFinding[],
  finding: FindingFactory,
): void => {
  const childTypes = sourceFor(context, CHILD_TYPES_PATH)?.getFullText() ?? "";
  const productApi = sourceFor(context, PRODUCT_API_PATH)?.getFullText() ?? "";
  const productionToolsSource = sourceFor(context, PRODUCTION_CHILD_TOOLS_PATH);
  const productionTools = productionToolsSource?.getFullText() ?? "";
  const lifecycle = sourceFor(context, PRODUCTION_BROWSER_LIFECYCLE_PATH)?.getFullText() ?? "";
  const handler = sourceFor(context, HANDLER_PATH)?.getFullText() ?? "";
  const title = sourceFor(context, TITLE_PATH)?.getFullText() ?? "";
  inspectMissingTokens({ source: `${childTypes}\n${productApi}`, required: [
    "ProductGptChildCapabilityId", "Exclude<", `\"${CHILD_ID}\"`,
    "execute<K extends ProductGptChildCapabilityId>",
  ], checkId: "gpt/settled-rename-private-child", filePath: PRODUCT_API_PATH,
  findings, finding, message: (required) => `The settled rename Child is not excluded from Product GPT tools; missing ${required}.` });
  inspectMissingTokens({ source: productionTools, required: [
    "runSettledConversationCleanup", "takeSettledConversationCleanup(nextSessionKey)",
    "RENAME_CLEANUP_MINIMUM_BUDGET_MS", `child: \"${CHILD_ID}\"`, "RuntimeFailureImpact.CLEANUP",
    "await browsers.settle(error)",
  ], checkId: "gpt/settled-rename-one-cleanup-hook", filePath: PRODUCTION_CHILD_TOOLS_PATH,
  findings, finding, message: (required) => `The one settled rename cleanup hook is missing ${required}.` });
  const settleExecution = productionToolsSource?.getClass("ProductionGptChildTools")
    ?.getMethod("settleExecution")?.getText() ?? "";
  if (occurrences(productionTools, `child: \"${CHILD_ID}\"`) !== 1
    || !settleExecution.includes(
      "await this.runSettledConversationCleanup(input, browsers);\n    await browsers.settle(error);",
    )) findings.push(finding("gpt/settled-rename-one-cleanup-hook", PRODUCTION_CHILD_TOOLS_PATH,
    "The internal rename Child must have one call site before the original lifecycle park."));
  if (occurrences(productionTools, "await this.runSettledConversationCleanup(") !== 3) findings.push(finding(
    "gpt/settled-rename-all-park-exits", PRODUCTION_CHILD_TOOLS_PATH,
    "The one cleanup function must cover Product execution transition, confirmed readback transition, and final settle."));
  inspectMissingTokens({ source: lifecycle, required: [
    "confirmedProviderEffect", "settledResultPayloadHash", "takeSettledConversationCleanup",
    "canonicalConversationUrl", "terminalAt",
  ], checkId: "gpt/settled-rename-settled-only", filePath: PRODUCTION_BROWSER_LIFECYCLE_PATH,
  findings, finding, message: (required) => `The settled-only rename gate is missing ${required}.` });
  inspectMissingTokens({ source: `${handler}\n${title}`, required: [
    'kind: "renameExactGptConversation"', "settledGptConversationTitle",
    'timeZone: "Asia/Dubai"', "PROJECT_TITLES", 'normalize("NFC")',
  ], checkId: "gpt/settled-rename-deterministic-title", filePath: HANDLER_PATH,
  findings, finding, message: (required) => `The deterministic settled title contract is missing ${required}.` });
  if (occurrences(handler, 'kind: "renameExactGptConversation"') !== 1) findings.push(finding(
    "gpt/settled-rename-one-browser-intent", HANDLER_PATH,
    "The rename Child must issue exactly one typed Browser intent."));
  const leaked = context.project.getSourceFiles().filter((source) =>
    source.getFilePath().split("\\").join("/").includes("/src/plugins/"))
    .find((source) => source.getFullText().includes(CHILD_ID));
  if (leaked) findings.push(finding("gpt/settled-rename-private-child", leaked.getFilePath(),
    "Product Plugin code must not call or name the internal settled rename Child."));
};
