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

export const DOM_BUSINESS_VOCAB = ["amazon", "seller central", "sellercentral", "invoice upload", "marketplace", "product video", "seed video"] as const;
export const SENSITIVE_PROPERTY_NAMES = ["cookie", "localstorage", "sessionstorage", "outerhtml", "innerhtml"] as const;
export const LOG_FIELD_FORBIDDEN = ["cookie", "token", "password", "localStorage", "sessionStorage", "fullHtml", "pdfContent", "rawHtml"] as const;
