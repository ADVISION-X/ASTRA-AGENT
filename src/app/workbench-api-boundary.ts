import type { IncomingHttpHeaders } from "node:http";

export type WorkbenchApiRouteRule = {
  method: "GET" | "POST";
  pathPattern: "exact";
  path: string;
  localUiAllowed: true;
  externalApiAllowed: false;
  requiresApiKey: false;
  jobOwner?: "xuanxue-ai-production";
  purpose: string;
};

export type WorkbenchApiBoundaryDecision =
  | { kind: "not_api_request" }
  | { kind: "allowed"; corsHeaders: Record<string, string>; routeRule: WorkbenchApiRouteRule; originCategory: "local-ui" }
  | { kind: "blocked"; statusCode: 403 | 404 | 405; error: string; reason: string; corsHeaders: Record<string, string> };

export const WORKBENCH_API_ROUTE_RULES: WorkbenchApiRouteRule[] = [
  { method: "GET", pathPattern: "exact", path: "/api/health", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, purpose: "workbench_health" },
  { method: "GET", pathPattern: "exact", path: "/api/mode", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, purpose: "workbench_mode" },
  { method: "GET", pathPattern: "exact", path: "/api/browser-authority/pairing", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, purpose: "local_browser_authority_pairing" },
  { method: "GET", pathPattern: "exact", path: "/api/xuanxue-ai-production/status", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "xuanxue-ai-production", purpose: "local_xuanxue_ai_production_status" },
  { method: "POST", pathPattern: "exact", path: "/api/xuanxue-ai-production/pause", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "xuanxue-ai-production", purpose: "local_xuanxue_ai_production_pause" },
  { method: "POST", pathPattern: "exact", path: "/api/xuanxue-ai-production/cancel", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "xuanxue-ai-production", purpose: "local_xuanxue_ai_production_cancel" },
  { method: "POST", pathPattern: "exact", path: "/api/xuanxue-ai-production/takeover", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "xuanxue-ai-production", purpose: "local_xuanxue_ai_production_takeover" },
  { method: "POST", pathPattern: "exact", path: "/api/xuanxue-ai-production/resume", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "xuanxue-ai-production", purpose: "local_xuanxue_ai_production_resume" },
];

const corsHeaders = (origin?: string): Record<string, string> => ({
  ...(origin ? { "access-control-allow-origin": origin } : {}),
  "access-control-allow-headers": "content-type,x-grasseye-agent-key,x-grasseye-source-system,x-grasseye-request-id",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  vary: "Origin",
});

const isLocalOrigin = (origin: string | undefined, baseUrl: string): boolean => {
  if (!origin) return true;
  const base = new URL(baseUrl);
  const port = base.port ? `:${base.port}` : "";
  return origin === base.origin || origin === `http://127.0.0.1${port}` || origin === `http://localhost${port}`;
};

export const handleWorkbenchApiBoundary = (input: {
  method?: string | undefined;
  path: string;
  origin?: string | undefined;
  headers: IncomingHttpHeaders;
  baseUrl: string;
}): WorkbenchApiBoundaryDecision => {
  if (!input.path.startsWith("/api/")) return { kind: "not_api_request" };
  const headers = corsHeaders(input.origin);
  if (!isLocalOrigin(input.origin, input.baseUrl)) return { kind: "blocked", statusCode: 403, error: "origin_not_allowed", reason: "origin_not_allowed", corsHeaders: headers };
  const routeRule = WORKBENCH_API_ROUTE_RULES.find((rule) => rule.method === input.method && rule.path === input.path);
  if (routeRule) return { kind: "allowed", corsHeaders: headers, routeRule, originCategory: "local-ui" };
  const hasPath = WORKBENCH_API_ROUTE_RULES.some((rule) => rule.path === input.path);
  return { kind: "blocked", statusCode: hasPath ? 405 : 404, error: hasPath ? "method_not_allowed" : "route_not_found", reason: hasPath ? "method_not_allowed" : "route_not_found", corsHeaders: headers };
};
