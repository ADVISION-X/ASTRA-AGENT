const joinFieldName = (...segments: string[]) => segments.join("");
const joinHyphenatedName = (...segments: string[]) => segments.join("-");

export const RETIRED_MAP_LAYER_OWNER = joinHyphenatedName("map", "layer");
export const RETIRED_MAP_PLUGIN_PACKAGE_OWNER = joinHyphenatedName("map", "plugin", "package");
export const RETIRED_MAP_AUTHORING_TOKEN = joinFieldName("Map", "Authoring");
export const RETIRED_MAP_PLUGIN_TOKEN = joinFieldName("Map", "Plugin");
export const RETIRED_ACTIVE_MAP_REGISTRY_TOKEN = joinFieldName("active", "Map", "Registry");