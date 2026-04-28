export type ForensicsPersistencePolicy = {
  mode: "append" | "replace-by-round" | "replace-by-session";
  allowPartialRefs: boolean;
};