---
name: "GrassEye AI Choice Judge"
description: "Governs bounded AI option judging and forbids AI planning or browser control."
applyTo: "src/capabilities/ai-input-gateway/**, src/plugins/**, src/lib/online-ai/**"
---

# GrassEye AI Choice Judge

status: active
version: 2026-05-21

## Boundary

AI is a choice judge only. It may classify a provided situation into finite options chosen by the calling flow script.

Canonical question shape:

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
- The caller supplies all options.
- AI returns only `selectedOptionId`, `confidence`, and `reason`.
- The flow script decides what to do with the selected option.
- Provider proof is recorded when an external provider is used.

Forbidden:
- AI deciding a full process;
- AI outputting a multi-step plan;
- AI outputting browser actions, DOM selectors, coordinates, or file paths;
- AI selecting unbounded actions;
- AI controlling submission, payment, refund, delete, or other sensitive final actions.
