export const DOM_FACADE_PATH = "src/capabilities/dom-automation/index.ts";
export const BROWSER_CONTROLLER_PATH = "src/lib/browser/browser-controller.ts";
export const CURRENT_CHROME_PATH = "src/lib/browser/current-chrome-browser-controller.ts";
export const PLUGIN_ROUTE_PATH = "src/app/plugin-task-api-handlers.ts";

export const DOM_EXPORTS = [
  "readDomSnapshotOnce",
  "locateDomElementOnce",
  "fillDomElementOnce",
  "clickDomElementOnce",
  "uploadApprovedFileOnce",
  "verifyDomStateOnce",
  "waitForDomStateOnce",
] as const;

export const DOM_ACTION_CODES = [
  "READ_DOM_SNAPSHOT_ONCE",
  "LOCATE_DOM_ELEMENT_ONCE",
  "FILL_DOM_ELEMENT_ONCE",
  "CLICK_DOM_ELEMENT_ONCE",
  "UPLOAD_APPROVED_FILE_ONCE",
  "VERIFY_DOM_STATE_ONCE",
  "WAIT_FOR_DOM_STATE_ONCE",
] as const;

export const DOM_REQUIRED_PATHS = [
  "src/capabilities/dom-automation/index.ts",
  "src/capabilities/dom-automation/schema.ts",
  "src/capabilities/dom-automation/manifest.ts",
  "src/capabilities/dom-automation/runtime/dom-snapshot.ts",
  "src/capabilities/dom-automation/runtime/dom-locator.ts",
  "src/capabilities/dom-automation/runtime/dom-fill.ts",
  "src/capabilities/dom-automation/runtime/dom-click.ts",
  "src/capabilities/dom-automation/runtime/dom-upload.ts",
  "src/capabilities/dom-automation/runtime/dom-verify.ts",
  "src/capabilities/dom-automation/runtime/dom-wait.ts",
  "src/capabilities/dom-automation/contracts/dom-snapshot.contract.ts",
  "src/capabilities/dom-automation/contracts/dom-element-ref.contract.ts",
  "src/capabilities/dom-automation/contracts/dom-action-result.contract.ts",
  "src/capabilities/dom-automation/contracts/dom-review-required.contract.ts",
  "src/capabilities/dom-automation/tests/dom-snapshot.fixture.ts",
  "src/capabilities/dom-automation/tests/dom-locator.fixture.ts",
  "src/capabilities/dom-automation/tests/dom-upload.fixture.ts",
] as const;

export const PLUGIN_REQUIRED_PATHS = [
  "src/plugins/amazon-invoice-upload/index.ts",
  "src/plugins/amazon-invoice-upload/mission.schema.ts",
  "src/plugins/amazon-invoice-upload/amazon-dom-hints.ts",
  "src/plugins/amazon-invoice-upload/amazon-platform.config.ts",
  "src/plugins/amazon-invoice-upload/amazon-result-detector.ts",
  "src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts",
  "src/plugins/amazon-invoice-upload/amazon-invoice-upload-flow-support.ts",
  "src/plugins/amazon-invoice-upload/amazon-invoice-upload-task-service.ts",
  "src/plugins/amazon-invoice-upload/amazon-invoice-upload-storage.ts",
  "src/plugins/amazon-invoice-upload/README.md",
  PLUGIN_ROUTE_PATH,
  "scripts/acceptance/dom-automation-smoke.ts",
  "scripts/acceptance/amazon-invoice-agent-start-smoke.ts",
  "scripts/acceptance/amazon-invoice-upload-smoke.ts",
  "scripts/acceptance/amazon-invoice-upload-complete-smoke.ts",
] as const;

export const DOM_BUSINESS_VOCAB = ["amazon", "seller central", "sellercentral", "invoice upload", "marketplace"] as const;
export const SENSITIVE_PROPERTY_NAMES = ["cookie", "localstorage", "sessionstorage", "outerhtml", "innerhtml"] as const;
export const LOG_FIELD_FORBIDDEN = ["cookie", "token", "password", "localStorage", "sessionStorage", "fullHtml", "pdfContent", "rawHtml"] as const;

