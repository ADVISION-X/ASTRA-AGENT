import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const providerRepository = (): string => {
  const configured = process.env.GRASSEYE_PROVIDER_REPOSITORIES?.trim();
  if (configured) {
    const value = (JSON.parse(configured) as Record<string, unknown>)["ADVISION-X/xuanxue-web"];
    if (typeof value === "string" && value.trim()) return resolve(value);
  }
  return resolve(ROOT, "../xuanxue-web");
};

const providerPath = resolve(
  providerRepository(), "packages/ai-contracts/src/agent-task/website-agent-route-policies.v1.json",
);
const destination = resolve(ROOT, "src/lib/local-runtime/production/website-agent-route-policies.v1.json");
const source = await readFile(providerPath, "utf8");
const artifact = JSON.parse(source) as Readonly<Record<string, unknown>>;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
if (artifact.schema_version !== "website-agent-route-policies.v1"
  || artifact.contract_id !== "ai-acceptance.website-agent-task-result"
  || artifact.contract_version !== 1
  || !isRecord(artifact.parameter_types)
  || !Array.isArray(artifact.routes) || artifact.routes.length !== 39) {
  throw new Error("WEBSITE_AGENT_ROUTE_POLICY_PROVIDER_INVALID");
}
const identities = new Set<string>();
const usedParameters = new Set<string>();
const resultContractRoutes = new Set([
  "public_knowledge_article_pipeline\0produce_article",
  "bazi_chart_interpretation\0produce",
  "bazi_chart_interpretation\0accuracy_challenge",
  "bazi_chart_interpretation\0quality_reflection",
  "bazi_ai_full_analysis\0produce",
  "bazi_ai_full_analysis\0accuracy_challenge",
  "bazi_ai_full_analysis\0quality_reflection",
  "bazi_report_followup\0followup",
  "bazi_report_followup\0accuracy_challenge",
  "bazi_report_followup\0quality_reflection",
]);
for (const route of artifact.routes) {
  const routeKeys = ["product_id", "action_id", "required_parameter_keys",
    "material_roles", "result_schema_version", "relation_kind",
    ...(isRecord(route) && route.result_contract !== undefined ? ["result_contract"] : [])];
  if (!isRecord(route) || !exactKeys(route, routeKeys)
    || typeof route.product_id !== "string" || typeof route.action_id !== "string"
    || typeof route.result_schema_version !== "string" || !route.result_schema_version
    || !Array.isArray(route.required_parameter_keys) || !Array.isArray(route.material_roles)
    || route.material_roles.length < 1) throw new Error("WEBSITE_AGENT_ROUTE_POLICY_PROVIDER_INVALID");
  const identity = `${route.product_id}\0${route.action_id}`;
  if (resultContractRoutes.has(identity) !== isRecord(route.result_contract)) {
    throw new Error("WEBSITE_AGENT_ROUTE_POLICY_RESULT_CONTRACT_INVALID");
  }
  if (identities.has(identity)) throw new Error("WEBSITE_AGENT_ROUTE_POLICY_PROVIDER_DUPLICATE");
  identities.add(identity);
  for (const key of route.required_parameter_keys) {
    if (typeof key !== "string" || !(key in artifact.parameter_types)) {
      throw new Error("WEBSITE_AGENT_ROUTE_POLICY_PARAMETER_SCHEMA_MISSING");
    }
    usedParameters.add(key);
  }
  for (const material of route.material_roles) {
    if (!isRecord(material) || !exactKeys(material, ["role", "trust_class", "may_issue_instruction",
      "media_types", "storage_class", "owner_scope_policy"])) {
      throw new Error("WEBSITE_AGENT_ROUTE_POLICY_MATERIAL_SCHEMA_INVALID");
    }
  }
}
if (identities.size !== 39
  || JSON.stringify([...usedParameters].sort()) !== JSON.stringify(Object.keys(artifact.parameter_types).sort())) {
  throw new Error("WEBSITE_AGENT_ROUTE_POLICY_PROVIDER_DENOMINATOR_INVALID");
}
const temporary = `${destination}.tmp-${process.pid}`;
await writeFile(temporary, source, { mode: 0o644 });
await rename(temporary, destination);
process.stdout.write("WEBSITE_AGENT_ROUTE_POLICY_PROJECTION_SYNCED 39/39\n");
