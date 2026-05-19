import type {
  PrimitiveIterationProof,
  PrimitiveScrollFailureResult,
  PrimitiveScrollSuccessResult,
} from "./primitive-scroll-runner-result.types.js";

const buildPrimitiveIterationProof = (input: PrimitiveIterationProof): PrimitiveIterationProof => input;

const buildPrimitiveScrollSuccessResult = (input: PrimitiveScrollSuccessResult): PrimitiveScrollSuccessResult => input;

const buildPrimitiveScrollFailureResult = (input: PrimitiveScrollFailureResult): PrimitiveScrollFailureResult => input;

export {
  buildPrimitiveIterationProof,
  buildPrimitiveScrollFailureResult,
  buildPrimitiveScrollSuccessResult,
};
