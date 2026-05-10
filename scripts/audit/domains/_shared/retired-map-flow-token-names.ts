const joinFieldName = (...segments: string[]) => segments.join("");

export const RETIRED_ROUTE_PLAN_ID_FIELD = joinFieldName("route", "Plan", "Id");
export const RETIRED_TASK_TEMPLATE_ID_FIELD = joinFieldName("task", "Template", "Id");
export const RETIRED_ACTIVATION_ID_FIELD = joinFieldName("activation", "Id");
export const RETIRED_ROUTE_LABEL_FIELD = joinFieldName("route", "Label");
export const RETIRED_MAP_PACKAGE_TOKEN = joinFieldName("map", "Package");
export const RETIRED_OPERATIONAL_MAP_TOKEN = joinFieldName("operational", "Map");
export const RETIRED_ROUTE_PLAN_BOUND_MAP_TOKEN = joinFieldName("route", "Plan", "Bound", "Map");
export const RETIRED_GENERIC_DIAGNOSTIC_MAP_TOKEN = joinFieldName("generic", "Diagnostic", "Map");