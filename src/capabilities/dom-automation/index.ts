export {
  DOM_AUTOMATION_ABILITY_GROUP_ID,
  DomActionResultSchema,
  DomAutomationChildCapabilityIdSchema,
  DomElementRefSchema,
  DomLocateResultSchema,
  DomSnapshotSchema,
  DomVerificationResultSchema,
  type ClickDomElementInput,
  type DismissOverlayInput,
  type DomActionResult,
  type DomAutomationChildCapabilityId,
  type DomElementRef,
  type DomLocateResult,
  type DomSnapshot,
  type DomVerificationResult,
  type FillDomElementInput,
  type LocateDomElementInput,
  type ReadDomSnapshotInput,
  type ScrollToElementInput,
  type SelectOptionInput,
  type UploadApprovedFileInput,
  type VerifyDomStateInput,
  type WaitForDomStateInput,
} from "./schema.js";
export { readDomSnapshotOnce } from "./runtime/dom-snapshot.js";
export { locateDomElementOnce, locateDomElementResultOnce } from "./runtime/dom-locator.js";
export { fillDomElementOnce } from "./runtime/dom-fill.js";
export { clickDomElementOnce } from "./runtime/dom-click.js";
export { uploadApprovedFileOnce } from "./runtime/dom-upload.js";
export { scrollToElementOnce } from "./runtime/dom-scroll.js";
export { selectOptionOnce } from "./runtime/dom-select.js";
export { dismissOverlayOnce } from "./runtime/dom-dismiss-overlay.js";
export { verifyDomStateOnce } from "./runtime/dom-verify.js";
export { waitForDomStateOnce } from "./runtime/dom-wait.js";
