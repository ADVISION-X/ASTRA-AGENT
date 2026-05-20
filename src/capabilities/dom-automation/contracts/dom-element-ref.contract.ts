import type {
  DomElementRef,
  LocateDomElementInput,
} from "../schema.js";

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
