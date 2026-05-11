export const FORENSICS_SRC_DIR =
  "/Users/nexgen/Documents/GrassEye -AI-AGENT/src/capabilities/forensics-persistence";

export const FORENSICS_AUDIT_DIR =
  "/Users/nexgen/Documents/GrassEye -AI-AGENT/scripts/audit/domains/forensics-persistence-capability";

export const MAX_SRC_FILES = 60;
export const MAX_AUDIT_FILES = 30;

export const ALLOWED_CHILDREN = [
  "append-record",
  "append-artifact",
  "read-record-ref",
];

export const FORBIDDEN_CHILDREN = [
  "finalize-mission",
  "write-product-record",
  "write-candidate-record",
  "update-runtime-snapshot",
];

export const FORBIDDEN_FIELDS = [
  "mapRef",
  "bindingRef",
  "templateRef",
  "routeRef",
  "branchToken",
  "productPresenceAiResultRef",
];

export const FORBIDDEN_IMPORTS = [
  "capabilities/ai/",
  "capabilities/browser/",
  "capabilities/mouse-click/",
  "capabilities/mouse-scroll/",
  "capabilities/orchestration/",
  "features/platform-action/",
];
