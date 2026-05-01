import {
  ImageEvidenceSchema as ExternalImageEvidenceSchema,
  OcrTextResultSchema as ExternalOcrTextResultSchema,
  type EvidenceRef as ExternalEvidenceRef,
  type ImageEvidence as ExternalImageEvidence,
  type OcrTextResult as ExternalOcrTextResult,
} from "../../../types/evidence.js";

const ImageEvidenceSchema = ExternalImageEvidenceSchema;
const OcrTextResultSchema = ExternalOcrTextResultSchema;

type EvidenceRef = ExternalEvidenceRef;
type ImageEvidence = ExternalImageEvidence;
type OcrTextResult = ExternalOcrTextResult;

export {
  ImageEvidenceSchema,
  OcrTextResultSchema,
};

export type {
  EvidenceRef,
  ImageEvidence,
  OcrTextResult,
};