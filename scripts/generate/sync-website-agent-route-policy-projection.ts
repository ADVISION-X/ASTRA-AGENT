import { readFile, writeFile, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dependency = JSON.parse(await readFile(resolve(root,
  "docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json"), "utf8")) as {
  contract: { contractId: string; version: number; providerRepo: string };
};
const mapping: unknown = JSON.parse(process.env.GRASSEYE_PROVIDER_REPOSITORIES ?? "{}");
if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) throw new Error("PROVIDER_REPOSITORY_MAPPING_INVALID");
const configured = Reflect.get(mapping, dependency.contract.providerRepo);
if (typeof configured !== "string" || !configured.trim()) throw new Error("PROVIDER_REPOSITORY_UNBOUND");
const bytes = await readFile(resolve(configured,
  "packages/ai-contracts/src/agent-task/website-agent-route-policies.v1.json"));
const raw: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("ROUTE_PROVIDER_INVALID");
const source = raw as Record<string, unknown>;
if (source.schema_version !== "website-agent-route-policies.v1"
  || source.contract_id !== dependency.contract.contractId || source.contract_version !== dependency.contract.version
  || !source.parameter_types || typeof source.parameter_types !== "object" || Array.isArray(source.parameter_types)
  || !Array.isArray(source.routes) || source.routes.length === 0) throw new Error("ROUTE_PROVIDER_IDENTITY_INVALID");
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("ROUTE_PROVIDER_INVALID");
  return value as Record<string, unknown>;
}
function strings(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every(item => typeof item === "string" && item.length > 0)
    || new Set(value).size !== value.length) throw new Error("ROUTE_PROVIDER_INVALID");
  return value as string[];
}
function validateMaterial(value: unknown): string {
  const material = object(value);
  if (typeof material.role !== "string" || !material.role || typeof material.trust_class !== "string"
    || typeof material.may_issue_instruction !== "boolean" || typeof material.storage_class !== "string"
    || typeof material.owner_scope_policy !== "string" || strings(material.media_types).length === 0) {
    throw new Error("ROUTE_PROVIDER_MATERIAL_INVALID");
  }
  if (material.min_count !== undefined && (!Number.isSafeInteger(material.min_count) || Number(material.min_count) < 0)) {
    throw new Error("ROUTE_PROVIDER_MATERIAL_INVALID");
  }
  return material.role;
}
function validateRoutes(routes: unknown[], parameters: Record<string, unknown>): Set<string> {
  const keys = new Set<string>(), used = new Set<string>();
  for (const value of routes) {
    const route = object(value);
    if (typeof route.product_id !== "string" || !route.product_id || typeof route.action_id !== "string"
      || !route.action_id || typeof route.result_schema_version !== "string"
      || !["primary", "provider_continuation"].includes(String(route.relation_kind))
      || (route.normal_provider_turns !== undefined && (!Number.isSafeInteger(route.normal_provider_turns) || Number(route.normal_provider_turns) < 1))
      || (route.stopped_empty_retry_allowed !== undefined && typeof route.stopped_empty_retry_allowed !== "boolean")) {
      throw new Error("ROUTE_PROVIDER_INVALID");
    }
    const key = `${route.product_id}\0${route.action_id}`;
    if (keys.has(key) || !Array.isArray(route.material_roles)) throw new Error("ROUTE_PROVIDER_INVALID");
    const roles = route.material_roles.map(validateMaterial);
    if (new Set(roles).size !== roles.length) throw new Error("ROUTE_PROVIDER_MATERIAL_INVALID");
    for (const parameter of strings(route.required_parameter_keys)) {
      if (!Object.hasOwn(parameters, parameter)) throw new Error("ROUTE_PROVIDER_PARAMETER_UNBOUND");
      used.add(parameter);
    }
    const result = object(route.result_contract);
    const fields = object(result.field_types);
    const outputVersion = result.output_schema_version ?? object(fields.schema_version).const;
    if (outputVersion !== route.result_schema_version) throw new Error("ROUTE_PROVIDER_RESULT_INVALID");
    keys.add(key);
  }
  if (used.size !== Object.keys(parameters).length) throw new Error("ROUTE_PROVIDER_PARAMETER_UNUSED");
  return keys;
}
const keys = validateRoutes(source.routes, object(source.parameter_types));
const target = resolve(root, "src/lib/local-runtime/production/website-agent-route-policies.v1.json");
const pending = `${target}.tmp-${process.pid}`;
await writeFile(pending, bytes, { mode: 0o644 });
await rename(pending, target);
process.stdout.write(`WEBSITE_AGENT_ROUTE_POLICY_PROJECTION_SYNCED ${keys.size}\n`);
