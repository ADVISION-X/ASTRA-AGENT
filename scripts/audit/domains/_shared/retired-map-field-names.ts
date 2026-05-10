const joinFieldName = (...segments: string[]) => segments.join("");

export const RETIRED_PACKAGE_ID_FIELD = joinFieldName("map", "Package", "Id");
export const RETIRED_PACKAGE_VERSION_FIELD = joinFieldName("map", "Package", "Version");
export const RETIRED_SELECTION_ID_FIELD = joinFieldName("selected", "Map", "Id");
export const RETIRED_SELECTION_VERSION_FIELD = joinFieldName("selected", "Map", "Version");
export const RETIRED_ACTIVATION_REF_FIELD = joinFieldName("activation", "Snapshot", "Ref");