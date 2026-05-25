---
name: "GrassEye AI Choice Judge"
description: "Governs bounded AI option judging and forbids AI planning or browser control."
applyTo: "src/capabilities/ai-input-gateway/**, src/plugins/**, src/lib/online-ai/**"
---

# GrassEye AI Choice Judge

status: active
version: 2026-05-26

## Boundary

AI is a bounded choice judge by default. It may classify a provided situation into finite options chosen by the calling flow script.

An active P0 job-flow law may explicitly authorize a flow-scoped AI content contract when that law defines prompt ownership, exact runtime stages, raw response persistence, downstream validation, and audit coverage. Such an exception does not permit AI planning, browser control, DOM selectors, coordinates, file paths, or sensitive final action control.

Default bounded-choice question shape:

```ts
type AiChoiceQuestion = {
  questionId: string;
  taskContext: string;
  facts: Record<string, unknown>;
  options: Array<{
    id: "A" | "B" | "C" | "D";
    label: string;
    meaning: string;
  }>;
  requiredOutput: {
    selectedOptionId: "A" | "B" | "C" | "D";
    confidence: number;
    reason: string;
  };
};
```

## Law GRASSEYE-AI-CHOICE-001-V1

Required:
- For bounded-choice tasks, the caller supplies all options.
- For bounded-choice tasks, AI returns only `selectedOptionId`, `confidence`, and `reason`.
- The flow script decides what to do with the selected option.
- When an active P0 job-flow law explicitly authorizes a non-choice AI stage, that job-flow law owns the prompt contract, allowed output fields, raw persistence, and downstream validation.
- Provider proof is recorded when an external provider is used.

Forbidden:
- AI deciding a full process;
- AI outputting a multi-step plan;
- AI outputting browser actions, DOM selectors, coordinates, or file paths;
- AI selecting unbounded actions;
- AI stages that are not explicitly owned by an active P0 job-flow law;
- AI controlling submission, payment, refund, delete, or other sensitive final actions.
