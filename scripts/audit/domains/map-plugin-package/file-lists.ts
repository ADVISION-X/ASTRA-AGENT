import { MAP_PLUGIN_PATHS } from "./constants.js";

const { AUDIT_ROOT, BUILTINS_ROOT, INSPECTOR_PATH, ROOT } = MAP_PLUGIN_PATHS;

export const BUILTIN_PACKAGE_FILES = [
  `${BUILTINS_ROOT}/facebook-seeding-video-discovery.meta.map-package.json`,
  `${BUILTINS_ROOT}/iphone-mirroring-facebook-seeding-video-discovery.meta.map-package.json`,
  `${BUILTINS_ROOT}/iphone-mirroring-tiktok-seeding-video-discovery.meta.map-package.json`,
  `${BUILTINS_ROOT}/macos-local-program-open-smoke.meta.map-package.json`,
  `${BUILTINS_ROOT}/tiktok-seeding-video-discovery.meta.map-package.json`,
] as const;

export const REQUIRED_SOURCE_FILES = [
  `${ROOT}/builtins/index.ts`,
  `${ROOT}/import/map-package-importer.ts`,
  `${ROOT}/import/map-package-activation.ts`,
  `${ROOT}/import/map-package-rollback.ts`,
  `${ROOT}/registry/active-map-registry.ts`,
  `${ROOT}/registry/map-plugin-registry.ts`,
  `${ROOT}/registry/quarantined-map-registry.ts`,
  `${ROOT}/registry/map-version-store.ts`,
  `${ROOT}/schema/map-plugin-package.schema.ts`,
  `${ROOT}/shared/map-plugin-ai-child-capability-ids.ts`,
  `${ROOT}/validation/map-capability-registry-validator.ts`,
  `${ROOT}/validation/map-package-validator.ts`,
  `${ROOT}/validation/map-security-validator.ts`,
  `${ROOT}/authoring/map-authoring-governed-catalogs.ts`,
  ...BUILTIN_PACKAGE_FILES,
] as const;

export const REQUIRED_AUDIT_FILES = [
  `${AUDIT_ROOT}/required-shape.ts`,
  `${AUDIT_ROOT}/forbidden-shape.ts`,
  `${AUDIT_ROOT}/boundary-attack.ts`,
  `${AUDIT_ROOT}/anti-escape.ts`,
  `${AUDIT_ROOT}/negative-proof-harness.ts`,
  `${AUDIT_ROOT}/scorecard-gate.ts`,
  `${AUDIT_ROOT}/run-inspector.ts`,
  INSPECTOR_PATH,
] as const;

export const LEGACY_MAP_IDS = [
  "product-video-detection",
  "browse-next-video",
  "comment-evidence",
  "recovery",
  "human-review",
] as const;
