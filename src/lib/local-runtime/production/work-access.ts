import { executionFailure } from "../../execution-failure.js";
import type { SharedExecutionContext, ProductMaterial } from "../../../mediator/product-plugin-contract.js";
import { productionCloudFetch } from "./cloud-transport.js";
import { parseJsonEnvelope, type ClaimedProductionTask } from "./transport-protocol.js";
import type { ProductionWorkerSession } from "./worker-session.js";

function parseWorkAccessResponse(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw executionFailure("failed", "WORK_ACCESS_RESPONSE_INVALID");
  const value = raw as Record<string, unknown>;
  if (typeof value.expires_at !== "string" || !Number.isFinite(Date.parse(value.expires_at))
    || Date.parse(value.expires_at) <= Date.now() || typeof value.sha256 !== "string"
    || !/^sha256:[a-f0-9]{64}$/u.test(value.sha256) || !Number.isSafeInteger(value.bytes) || Number(value.bytes) < 1) {
    throw executionFailure("failed", "WORK_ACCESS_RESPONSE_INVALID");
  }
  return value;
}
function assertWorkAccessObject(value: Readonly<Record<string, unknown>>, material: ProductMaterial,
  materialId: string, assetId: string | undefined): void {
  const get = material.role === "research_input" ? value.url : value.get_url;
  if (typeof get !== "string" || new URL(get).protocol !== "https:"
    || assetId !== undefined && value.asset_id !== assetId
    || material.role === "research_input" && (value.material_id !== materialId
      || value.sha256 !== material.sha256 || value.bytes !== material.bytes)) {
    throw executionFailure("failed", "WORK_ACCESS_OBJECT_MISMATCH");
  }
}
export function createWorkAccessPort(session: ProductionWorkerSession, job: ClaimedProductionTask,
  signal: AbortSignal): NonNullable<SharedExecutionContext["workAccess"]> {
  return async (materialId, assetId) => {
    signal.throwIfAborted();
    const material = job.material_refs.find(item => item.material_id === materialId);
    if (!material || !["research_input", "project_context", "research_context", "delivery_plan"].includes(material.role)) {
      throw executionFailure("failed", "WORK_ACCESS_MATERIAL_UNAUTHORIZED");
    }
    const pathname = `/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/materials/${encodeURIComponent(materialId)}/work-access`;
    const url = new URL(pathname, session.device.server_base_url);
    if (assetId !== undefined) url.searchParams.set("asset_id", assetId);
    const headers = await session.authorizationHeaders({ "x-ai-execution-fence-hash": job.grant.execution_fence.fence_hash });
    const response = await productionCloudFetch(url.href, { headers,
      signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]) });
    const raw = parseJsonEnvelope(await response.json() as unknown, response.status);
    signal.throwIfAborted();
    const value = parseWorkAccessResponse(raw);
    assertWorkAccessObject(value, material, materialId, assetId);
    return Object.freeze(value);
  };
}
