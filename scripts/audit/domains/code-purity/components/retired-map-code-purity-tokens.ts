const joinFieldName = (...segments: string[]) => segments.join("");
const joinHyphenatedName = (...segments: string[]) => segments.join("-");

const RETIRED_PACKAGE_ID_FIELD = joinFieldName("map", "Package", "Id");
const RETIRED_SELECTION_ID_FIELD = joinFieldName("selected", "Map", "Id");
const RETIRED_ACTIVATION_REF_FIELD = joinFieldName("activation", "Snapshot", "Ref");
const RETIRED_ROUTE_PLAN_ID_FIELD = joinFieldName("route", "Plan", "Id");
const RETIRED_TASK_TEMPLATE_ID_FIELD = joinFieldName("task", "Template", "Id");
const RETIRED_ACTIVATION_ID_FIELD = joinFieldName("activation", "Id");
const RETIRED_ROUTE_LABEL_FIELD = joinFieldName("route", "Label");
const RETIRED_MAP_LAYER_OWNER = joinHyphenatedName("map", "layer");
const RETIRED_MAP_PLUGIN_PACKAGE_OWNER = joinHyphenatedName("map", "plugin", "package");
const RETIRED_MAP_PACKAGE_TOKEN = joinFieldName("map", "Package");
const RETIRED_OPERATIONAL_MAP_TOKEN = joinFieldName("operational", "Map");
const RETIRED_ROUTE_PLAN_BOUND_MAP_TOKEN = joinFieldName("route", "Plan", "Bound", "Map");
const RETIRED_GENERIC_DIAGNOSTIC_MAP_TOKEN = joinFieldName("generic", "Diagnostic", "Map");
const RETIRED_MAP_AUTHORING_TOKEN = joinFieldName("Map", "Authoring");
const RETIRED_MAP_PLUGIN_TOKEN = joinFieldName("Map", "Plugin");
const RETIRED_ACTIVE_MAP_REGISTRY_TOKEN = joinFieldName("active", "Map", "Registry");
const RETIRED_MAP_PLUGIN_PACKAGE_AUDIT_DOMAIN = ["scripts", "audit", "domains", RETIRED_MAP_PLUGIN_PACKAGE_OWNER].join("/");
const RETIRED_MAP_PLUGIN_PACKAGE_MODULE_FILE = `${["module", RETIRED_MAP_PLUGIN_PACKAGE_OWNER].join("-")}.instructions.md`;

export const retiredMapCodePurityTokens = {
  RETIRED_ACTIVATION_ID_FIELD,
  RETIRED_ACTIVATION_REF_FIELD,
  RETIRED_ACTIVE_MAP_REGISTRY_TOKEN,
  RETIRED_GENERIC_DIAGNOSTIC_MAP_TOKEN,
  RETIRED_MAP_AUTHORING_TOKEN,
  RETIRED_MAP_LAYER_OWNER,
  RETIRED_MAP_PACKAGE_TOKEN,
  RETIRED_MAP_PLUGIN_PACKAGE_AUDIT_DOMAIN,
  RETIRED_MAP_PLUGIN_PACKAGE_MODULE_FILE,
  RETIRED_MAP_PLUGIN_PACKAGE_OWNER,
  RETIRED_MAP_PLUGIN_TOKEN,
  RETIRED_OPERATIONAL_MAP_TOKEN,
  RETIRED_PACKAGE_ID_FIELD,
  RETIRED_ROUTE_LABEL_FIELD,
  RETIRED_ROUTE_PLAN_BOUND_MAP_TOKEN,
  RETIRED_ROUTE_PLAN_ID_FIELD,
  RETIRED_SELECTION_ID_FIELD,
  RETIRED_TASK_TEMPLATE_ID_FIELD,
} as const;