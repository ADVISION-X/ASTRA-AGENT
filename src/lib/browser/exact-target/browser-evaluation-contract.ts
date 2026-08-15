const FUNCTION_BODY_PREFIX = "(() => {\n";
const FUNCTION_BODY_SUFFIX = "\n})()";

export const toBrowserEvaluationExpression = (functionBody: string): string => {
  if (!functionBody.trim()) {
    throw new Error("Browser evaluation function body must not be empty");
  }
  return `${FUNCTION_BODY_PREFIX}${functionBody}${FUNCTION_BODY_SUFFIX}`;
};
