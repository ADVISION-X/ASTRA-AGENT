import { readFile, writeFile, rename } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const configured = process.env.GRASSEYE_PROVIDER_REPOSITORIES?.trim();
const providers: Record<string, unknown> = configured ? JSON.parse(configured) : {};
const repository = providers["ADVISION-X/xuanxue-web"];
const provider = typeof repository === "string" && repository.trim() ? resolve(repository) : resolve(root, "../xuanxue-web");
const destination = resolve(root, "src/lib/local-runtime/production/website-agent-route-policies.v1.json");
const bytes = await readFile(resolve(provider, "packages/ai-contracts/src/agent-task/website-agent-route-policies.v1.json"));
const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
const projection: unknown = JSON.parse(source);
function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("WEBSITE_AGENT_ROUTE_POLICY_PROVIDER_INVALID");
  return input as Record<string, unknown>;
}
function exact(input: Record<string, unknown>, keys: readonly string[]): void {
  const expected = new Set(keys);
  if (Object.keys(input).length !== expected.size || Object.keys(input).some((key) => !expected.has(key))) {
    throw new Error("WEBSITE_AGENT_ROUTE_POLICY_PROVIDER_INVALID");
  }
}
const artifact = object(projection);
exact(artifact, ["schema_version", "contract_id", "contract_version", "parameter_types", "routes"]);
if (artifact.schema_version !== "website-agent-route-policies.v1" || artifact.contract_id !== "ai-acceptance.website-agent-task-result"
  || artifact.contract_version !== 22 || !Array.isArray(artifact.routes) || artifact.routes.length !== 43) {
  throw new Error("WEBSITE_AGENT_ROUTE_POLICY_PROVIDER_INVALID");
}
const parameters = object(artifact.parameter_types);
const identities = new Set<string>();
const used = new Set<string>();
let contracts = 0;
for (const raw of artifact.routes) {
  const route = object(raw);
  exact(route, ["product_id", "action_id", "required_parameter_keys", "material_roles", "result_schema_version", "relation_kind",
    ...(Object.hasOwn(route, "result_contract") ? ["result_contract"] : [])]);
  for (const key of ["product_id", "action_id", "result_schema_version"]) {
    if (typeof route[key] !== "string" || !(route[key] as string).trim()) throw new Error("WEBSITE_AGENT_ROUTE_POLICY_PROVIDER_INVALID");
  }
  if (!Array.isArray(route.required_parameter_keys) || !Array.isArray(route.material_roles) || !route.material_roles.length
    || !["primary", "followup", "provider_continuation", "review"].includes(String(route.relation_kind))) {
    throw new Error("WEBSITE_AGENT_ROUTE_POLICY_PROVIDER_INVALID");
  }
  const identity = `${String(route.product_id)}\0${String(route.action_id)}`;
  if (identities.has(identity)) throw new Error("WEBSITE_AGENT_ROUTE_POLICY_PROVIDER_DUPLICATE");
  identities.add(identity);
  if (Object.hasOwn(route, "result_contract")) { object(route.result_contract); contracts += 1; }
  const keys = route.required_parameter_keys;
  if (new Set(keys).size !== keys.length) throw new Error("WEBSITE_AGENT_ROUTE_POLICY_PARAMETER_SCHEMA_MISSING");
  for (const key of keys) {
    if (typeof key !== "string" || !Object.hasOwn(parameters, key)) throw new Error("WEBSITE_AGENT_ROUTE_POLICY_PARAMETER_SCHEMA_MISSING");
    if (key === "reusable_base_reservation_ref" || key === "reusable_base_reservation_hash") {
      throw new Error("WEBSITE_AGENT_ROUTE_POLICY_PROVIDER_DENOMINATOR_INVALID");
    }
    used.add(key);
  }
  for (const rawMaterial of route.material_roles) {
    const material = object(rawMaterial);
    exact(material, ["role", "trust_class", "may_issue_instruction", "media_types", "storage_class", "owner_scope_policy",
      ...(Object.hasOwn(material, "repeatable") ? ["repeatable"] : [])]);
    if ((Object.hasOwn(material, "repeatable") && material.repeatable !== true)
      || typeof material.role !== "string" || !material.role.trim() || typeof material.may_issue_instruction !== "boolean"
      || !Array.isArray(material.media_types) || !material.media_types.length
      || !material.media_types.every((type) => typeof type === "string" && type.trim())
      || !["instruction", "locked_fact", "nonbinding_prior_interpretation", "user_provided_data", "classical_source_data", "transport_evidence"].includes(String(material.trust_class))
      || material.may_issue_instruction !== (material.trust_class === "instruction")
      || !["shared_static", "private_owner_scoped"].includes(String(material.storage_class))
      || material.owner_scope_policy !== (material.storage_class === "private_owner_scoped" ? "required" : "forbidden")) {
      throw new Error("WEBSITE_AGENT_ROUTE_POLICY_MATERIAL_SCHEMA_INVALID");
    }
  }
}
if (identities.size !== 43 || Object.keys(parameters).length !== 43 || contracts !== 43 || used.size !== 43
  || Object.keys(parameters).some((key) => !used.has(key))) throw new Error("WEBSITE_AGENT_ROUTE_POLICY_PROVIDER_DENOMINATOR_INVALID");
// The consumer receives the provider's exact bytes, including order and result contracts.
const pending = `${destination}.tmp-${process.pid}`;
await writeFile(pending, bytes, { mode: 0o644 });
await rename(pending, destination);
process.stdout.write("WEBSITE_AGENT_ROUTE_POLICY_PROJECTION_SYNCED 43/43/43\n");
