export {
  DOM_AUTOMATION_ABILITY_GROUP_ID,
  DomActionResultSchema,
  DomAutomationChildCapabilityIdSchema,
  DomElementRefSchema,
  DomSnapshotSchema,
  DomVerificationResultSchema,
  type ClickDomElementInput,
  type DomActionResult,
  type DomAutomationChildCapabilityId,
  type DomElementRef,
  type DomSnapshot,
  type DomVerificationResult,
  type FillDomElementInput,
  type LocateDomElementInput,
  type ReadDomSnapshotInput,
  type UploadApprovedFileInput,
  type VerifyDomStateInput,
  type WaitForDomStateInput,
} from "./schema.js";
export { readDomSnapshotOnce } from "./runtime/dom-snapshot.js";
export { locateDomElementOnce } from "./runtime/dom-locator.js";
export { fillDomElementOnce } from "./runtime/dom-fill.js";
export { clickDomElementOnce } from "./runtime/dom-click.js";
export { uploadApprovedFileOnce } from "./runtime/dom-upload.js";
export { verifyDomStateOnce } from "./runtime/dom-verify.js";
export { waitForDomStateOnce } from "./runtime/dom-wait.js";
