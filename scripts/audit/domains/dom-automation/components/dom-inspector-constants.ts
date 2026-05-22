export const domSurface = {
  root: "src/capabilities/dom-automation/",
  publicFacade: "src/capabilities/dom-automation/index.ts",
  schemaPath: "src/capabilities/dom-automation/schema.ts",
} as const;

export const requiredDomLawIds = [
  "APEX-DOM-001-V1",
  "APEX-DOM-002-V1",
  "APEX-DOM-003-V1",
  "APEX-DOM-004-V1",
  "APEX-DOM-005-V1",
  "APEX-DOM-006-V1",
  "APEX-DOM-007-V1",
  "APEX-DOM-008-V1",
  "APEX-DOM-009-V1",
  "APEX-DOM-010-V1",
  "APEX-DOM-011-V1",
  "APEX-DOM-012-V1",
  "APEX-DOM-013-V1",
] as const;

export const requiredChildAbilities = [
  "read-dom-snapshot-once",
  "locate-dom-element-once",
  "fill-dom-element-once",
  "click-dom-element-once",
  "upload-approved-file-once",
  "wait-for-dom-state-once",
  "verify-dom-state-once",
] as const;

export const requiredChildFunctionExports = [
  "readDomSnapshotOnce",
  "locateDomElementOnce",
  "fillDomElementOnce",
  "clickDomElementOnce",
  "uploadApprovedFileOnce",
  "waitForDomStateOnce",
  "verifyDomStateOnce",
] as const;

export const requiredTargetKinds = [
  "dropdown-trigger",
  "overlay-dismiss-button",
  "tab-button",
  "rich-text-editor",
  "select",
  "combobox",
] as const;

export const requiredSnapshotFields = [
  "dropdownTriggers",
  "overlays",
  "loadingIndicators",
  "stickyElements",
] as const;

export const requiredDetectedStates = [
  "cookie-consent-overlay",
  "promotional-overlay",
  "modal-dialog",
  "drawer-panel",
  "loading-skeleton",
  "empty-state",
  "error-state",
  "rate-limited",
] as const;

export const requiredRuntimeFiles = [
  "src/capabilities/dom-automation/runtime/dom-snapshot.ts",
  "src/capabilities/dom-automation/runtime/dom-locator.ts",
  "src/capabilities/dom-automation/runtime/dom-fill.ts",
  "src/capabilities/dom-automation/runtime/dom-click.ts",
  "src/capabilities/dom-automation/runtime/dom-upload.ts",
  "src/capabilities/dom-automation/runtime/dom-wait.ts",
  "src/capabilities/dom-automation/runtime/dom-verify.ts",
] as const;
