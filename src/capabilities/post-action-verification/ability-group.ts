import type { PostActionEvidenceReadPort } from "./ports/post-action-evidence-read-port.js";
import type { PostActionVerificationClockPort } from "./ports/post-action-verification-clock-port.js";
import { type CreatePostActionVerificationAbilityGroupInput, type PostActionVerificationAbilityGroup, type PostActionVerificationAbilityInput, type PostActionVerificationChildCapabilityId, type ParsedPostActionVerificationAbilityInput } from "./contract.js";
import { PostActionVerificationAbilityResultSchema, PostActionVerificationAbilityInputSchema } from "./schema.js";
import { createPostActionVerificationRegistry, listPostActionVerificationChildren } from "./registry.js";
import { executePostActionVerification } from "./runtime/post-action-verification-executor.js";
import { createInvalidPostActionInputResult, createPostActionFailureResult } from "./runtime/post-action-result-builders.js";

async function executePostActionVerificationChildCapability(input: {
  registry: ReturnType<typeof createPostActionVerificationRegistry>;
  context: {
    clock: PostActionVerificationClockPort;
    evidenceReadPort: PostActionEvidenceReadPort;
  };
  childCapabilityId: PostActionVerificationChildCapabilityId;
  callInput: ParsedPostActionVerificationAbilityInput;
}) {
  const capability = input.registry.get(input.childCapabilityId);
  if (!capability) {
    return createPostActionFailureResult({
      request: input.callInput,
      context: input.context,
      status: "failed",
      verificationDecision: "failed",
      confidence: 0,
      failureReason: "unknown_child_capability",
      statusMessage: `Post Action Verification child capability is not registered for ${input.childCapabilityId}.`,
    });
  }

  try {
    return PostActionVerificationAbilityResultSchema.parse(await executePostActionVerification({
      request: input.callInput,
      context: input.context,
      capability,
    }));
  } catch (error) {
    return createPostActionFailureResult({
      request: input.callInput,
      context: input.context,
      status: "failed",
      verificationDecision: "failed",
      confidence: 0,
      failureReason: "child_execution_failed",
      statusMessage: error instanceof Error ? error.message : "Post Action Verification child execution failed.",
    });
  }
}

async function executePostActionVerificationInput(input: {
  registry: ReturnType<typeof createPostActionVerificationRegistry>;
  context: {
    clock: PostActionVerificationClockPort;
    evidenceReadPort: PostActionEvidenceReadPort;
  };
  inputValue: PostActionVerificationAbilityInput;
}) {
  const parsed = PostActionVerificationAbilityInputSchema.safeParse(input.inputValue);
  if (!parsed.success) {
    return createInvalidPostActionInputResult({
      rawInput: input.inputValue,
      context: input.context,
      issues: parsed.error.issues,
    });
  }

  return executePostActionVerificationChildCapability({
    registry: input.registry,
    context: input.context,
    childCapabilityId: parsed.data.childCapabilityId,
    callInput: parsed.data,
  });
}

export function createPostActionVerificationAbilityGroup(input: CreatePostActionVerificationAbilityGroupInput): PostActionVerificationAbilityGroup {
  const registry = createPostActionVerificationRegistry();
  const context = {
    clock: input.clock,
    evidenceReadPort: input.evidenceReadPort,
  };

  return {
    listChildCapabilityIds() {
      return listPostActionVerificationChildren();
    },
    async execute(inputValue: PostActionVerificationAbilityInput) {
      return executePostActionVerificationInput({ registry, context, inputValue });
    },
  };
}
