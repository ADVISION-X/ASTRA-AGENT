import type { DomElementRef } from "../../../types/dom-automation.js";
import type { LocateDomElementInput } from "../../../types/dom-automation-inputs.js";

export type DomElementRefContract = DomElementRef;

export type LocateDomElementContractInput = LocateDomElementInput;

export type DomElementRefEvidenceContract = Pick<
  DomElementRef,
  | "elementRef"
  | "selector"
  | "frameRef"
  | "targetKind"
  | "confidence"
  | "matchedSignals"
  | "reason"
  | "fallbackUsed"
>;
