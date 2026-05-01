import { orchestrationInspectionConstants as config } from "./inspection-constants.js";

export const arraysEqual = (left: readonly string[], right: readonly string[]): boolean => {
  return left.length === right.length && left.every((value, index) => value === right[index]);
};

export const isPrivateOrchestrationPath = (relativePath: string): boolean => {
  return config.PRIVATE_ORCHESTRATION_SEGMENTS.some((segment) => relativePath.includes(segment));
};