---
name: "GrassEye AI Input Gateway"
description: "Use when defining external AI feeding, provider delivery, web chat adapters, AI transport proof, provider isolation, or business-plugin-to-AI provider boundaries."
applyTo: ".github/instructions/cursor-rules/modules/module-ai-input-gateway.instructions.md, docs/法案辅助文件/*AI投喂*, docs/法案辅助文件/*AI Input Gateway*, src/capabilities/ai-input-gateway/**/*.{ts,tsx,js,jsx,mjs,json,jsonc}"
---

# GrassEye AI Input Gateway

status: active
version: 2026-05-21
capabilityGroupId: ai-input-gateway
中文名: AI 投喂能立组 / 外部 AI 输入网关

## Boundary

AI Input Gateway owns external AI transport only: provider delivery, response retrieval, transport proof, output parsing status, and provider adapters.

It is not a replacement for `src/capabilities/ai`. The AI capability group owns cognitive tasks, prompt contracts, task output schemas, and task-level validation. AI Input Gateway owns how a governed prompt package is delivered to an external AI provider and how the raw provider result is returned with proof.

Required call direction:

```txt
business plugin
  -> AI capability group
      -> AI Input Gateway
          -> provider adapter
```

Forbidden call direction:

```txt
business plugin -> provider SDK/API/web chat
AI Input Gateway -> business judgment
AI Input Gateway -> browser mission workflow
```

## Law GRASSEYE-AI-FEED-001-V1

status: active
tier: P0
capabilityDomain: ai-input-gateway
enforcementMode: auto
evidenceMode: law+blueprint+real-code-inspection

summary: AI Input Gateway owns provider delivery, response retrieval, transport proof, and provider adapters, but must not own business judgment.

### 主题

AI 投喂能立组主权

### 法条

AI Input Gateway is the standalone transport capability group for feeding governed prompt packages and approved input artifacts to external AI providers, then returning raw and normalized provider output with transport proof.

Required direction:
- The canonical ability group id is `ai-input-gateway`.
- The canonical runtime root is `src/capabilities/ai-input-gateway`.
- The group must own schemas, manifest, public contract, runtime dispatch, provider adapters, feed proof, input package governance, output parsing, and rate guards.
- Every execution must return one unified `AiFeedResult`.
- Every execution must identify `providerKind`.
- Every execution must carry governed `promptPackageId`, `promptContractId`, and `inputRefs`.
- Provider proof must survive success, failure, and review-required outcomes.

Forbidden:
- deciding whether a video is a product-seeding video;
- deciding whether to save product-video evidence;
- deciding the next product-video DOM action;
- owning Amazon upload, Facebook mining, product sourcing, purchase, profit, ads, or business workflow logic;
- polluting `src/capabilities/ai` with provider adapter internals;
- polluting `src/capabilities/dom-automation` with AI provider flow logic.

## Law GRASSEYE-AI-FEED-002-V1

status: active
tier: P0
capabilityDomain: ai-input-gateway
enforcementMode: auto
evidenceMode: law+blueprint+real-code-inspection

summary: AI capability group owns cognitive tasks and output schemas; AI Input Gateway owns external AI transport and provider adapters.

### 主题

AI 判断层与 AI 投喂层分权

### 法条

AI task capabilities own what the model is asked to judge and how task-specific output is validated. AI Input Gateway owns only the provider transport, raw response retrieval, transport proof, parse status, and provider adapter boundary.

Required direction:
- Business plugins call AI task capabilities, not provider adapters.
- AI task capabilities build task prompts and expected output schema refs.
- AI task capabilities call AI Input Gateway through its public contract.
- AI task capabilities validate task-specific outputs after AI Input Gateway returns raw or parsed output.
- Product Video Judge must be an AI task capability before reaching a provider adapter.

Forbidden:
- `src/plugins/**` importing `src/lib/online-ai`;
- `src/plugins/**` directly importing Gemini, OpenAI, ChatGPT, or provider SDK/web-chat adapter internals;
- `src/plugins/**` directly operating Gemini Web Chat or GPT Web Chat DOM;
- AI Input Gateway importing product-video plugin internals;
- AI Input Gateway owning product-video final judgment.

## Law GRASSEYE-AI-FEED-003-V1

status: active
tier: P0
capabilityDomain: ai-input-gateway
enforcementMode: auto
evidenceMode: law+blueprint+real-code-inspection

summary: Each AI provider channel must be isolated as an adapter behind the AI Input Gateway contract.

### 主题

Provider Adapter 隔离

### 法条

Each external AI channel must be isolated behind the AI Input Gateway provider adapter contract.

Allowed phase-one provider kinds:
- `gemini-api`
- `gemini-web-chat`
- `gpt-web-chat`

Required direction:
- `providerKind` must be explicit on every request and result.
- Adapter inputs and outputs must normalize through the AI Input Gateway contract.
- Adapters must not import one another.
- Adapters must not own task-specific output schemas.
- Adapters must not call business plugins.

Forbidden:
- hiding provider-specific behavior in business plugins;
- adding task judgment schemas inside provider adapters;
- using one provider adapter as a fallback or bridge to another adapter;
- exposing provider adapters as public business APIs.

## Law GRASSEYE-AI-FEED-004-V1

status: active
tier: P0
capabilityDomain: ai-input-gateway
enforcementMode: auto
evidenceMode: law+blueprint+real-code-inspection

summary: Web chat AI adapters must use only operator-authorized browser sessions and must not bypass login, captcha, account limits, or read secrets.

### 主题

网页 AI 投喂安全边界

### 法条

Web chat provider adapters may use only operator-authorized browser sessions and governed browser or DOM contracts. They must stop for review when login, CAPTCHA, 2FA, risk control, or provider limits block execution.

Required direction:
- Web chat adapters must reuse governed `BrowserController` and DOM capability contracts.
- Login must be manual and operator-authorized.
- Login pages must return `review_required`.
- CAPTCHA, 2FA, risk-control, or account-limit pages must return `review_required`.
- Each feed must save input summary, output summary, provider proof, and parse status.
- Each feed must enforce input size limits, timeout, retry limits, and cooldown/rate guards.

Forbidden:
- reading cookies;
- reading localStorage or sessionStorage;
- reading tokens or browser passwords;
- automatically entering account credentials;
- bypassing CAPTCHA, 2FA, risk controls, or provider limits;
- rotating multiple accounts;
- submitting unbounded or high-frequency web-chat feeds;
- logging full provider page HTML or secret-bearing provider state.

## Law GRASSEYE-AI-FEED-005-V1

status: active
tier: P0
capabilityDomain: ai-input-gateway
enforcementMode: auto
evidenceMode: law+blueprint+real-code-inspection

summary: Web chat adapters must not cause active mission tab drift and must preserve or restore the source browsing context.

### 主题

Web Chat Tab Ownership

### 法条

Web chat adapters operate browser pages and therefore must prevent active mission tab drift. A web-chat feed must either restore the source browsing context or return `review_required`.

Required direction:
- Web chat feeds must acquire a browser tab ownership lease before browser mutation.
- Provider proof must record `sourcePageUrlBeforeFeed`.
- Provider proof must record `providerPageUrl`.
- The source mission page must be restored after feed completion when a source URL exists.
- If source restoration fails, the result must be `review_required`.
- Only one web-chat feed may run at a time.
- Web-chat feed execution must not run concurrently with product-video next-video DOM operations.

Forbidden:
- browsing Facebook/Amazon mission pages while also operating Gemini/GPT web chat in the same uncontrolled context;
- continuing the next mission round before restoring the original mission page;
- closing the user's original business page;
- letting a Web Chat page become the next product-video DOM snapshot target.

## Law GRASSEYE-AI-FEED-006-V1

status: active
tier: P0
capabilityDomain: ai-input-gateway
enforcementMode: auto
evidenceMode: law+blueprint+real-code-inspection

summary: AI feed input must be a governed prompt package with explicit refs, size limits, and no sensitive browser data.

### 主题

投喂输入包治理

### 法条

Every AI feed input must be a governed prompt package with explicit contract identity, approved refs, size limits, and sensitive-data exclusion.

Required direction:
- Input must include `promptPackageId`.
- Input must include `promptContractId`.
- Input must include `expectedOutputSchemaRef` when task parsing or schema validation is requested.
- Input must include `inputRefs`.
- Input must include `providerKind`.
- Input must include `timeoutMs`.
- Input must include `maxInputChars`, `maxFileCount`, and `maxFileBytes`.
- Input proof must include `inputHash`.

Forbidden:
- feeding cookies, tokens, passwords, sessions, browser storage, or hidden credential material;
- feeding full raw webpage HTML;
- feeding unapproved local files;
- uploading arbitrary directory contents to Web Chat;
- writing unfiltered user-private fields into prompts;
- treating unbounded prompt text as a governed package.

## Law GRASSEYE-AI-FEED-007-V1

status: active
tier: P0
capabilityDomain: ai-input-gateway
enforcementMode: auto
evidenceMode: law+blueprint+real-code-inspection

summary: Every AI feed must produce raw output proof, normalized text, parse status, and schema validation result.

### 主题

输出证明与解析

### 法条

Every AI feed result must prove what provider output was received and how it was parsed.

Required direction:
- Result must include `rawOutputRef`.
- Result must include `rawOutputHash`.
- Result must include `normalizedText`.
- Result must include `parseStatus`.
- Result must include `schemaValidationStatus`.
- Result must include `providerProof`.
- Provider proof must include `startedAt`, `endedAt`, and `durationMs`.
- Provider errors must be surfaced as structured failed or review-required outcomes.

Forbidden:
- claiming success without output;
- treating JSON parse failure as schema valid;
- saving only console logs as proof;
- swallowing provider errors;
- silently converting provider failure into business rejection.

## Law GRASSEYE-AI-FEED-008-V1

status: active
tier: P1
capabilityDomain: ai-input-gateway
enforcementMode: auto
evidenceMode: law+blueprint+real-code-inspection

summary: AI feed gateway must expose provider cost and rate guard controls and must not submit unbounded requests.

### 主题

成本与频率治理

### 法条

AI Input Gateway must expose cost/rate guard data where available and must not submit unbounded requests.

Required direction:
- Gemini API feeds must record `modelName`.
- Gemini API feeds must record estimated input/output tokens or an unavailable reason.
- Web Chat feeds must record `providerKind`, cooldown, and rate-guard decision.
- Every provider path must support `timeoutMs`.
- Every provider path must enforce retry-count limits.
- Daily and session guard configuration must be representable.

Forbidden:
- infinite retries;
- continuous Web Chat feeding without interval;
- submitting the same `inputHash` repeatedly in one round;
- hiding provider cost/rate information when it is available.

## Law GRASSEYE-AI-FEED-009-V1

status: active
tier: P1
capabilityDomain: ai-input-gateway
enforcementMode: manual
evidenceMode: law+blueprint

summary: Phase 1 is limited to Gemini API, Gemini Web Chat, and GPT Web Chat feeding only.

### 主题

第一期范围冻结

### 法条

Phase 1 AI Input Gateway scope is limited to three feed children.

Allowed phase-one child capabilities:
- `feed-gemini-api-once`
- `feed-gemini-web-chat-once`
- `feed-gpt-web-chat-once`

Forbidden in phase one:
- OpenAI API feed;
- Claude feed;
- batch provider router;
- multi-account router;
- automatic account login;
- automatic CAPTCHA handling;
- large-scale parallel feeding.

## Law GRASSEYE-AI-FEED-010-V1

status: active
tier: P0
capabilityDomain: ai-input-gateway
enforcementMode: auto
evidenceMode: law+blueprint+real-code-inspection

summary: Business plugins must not call AI provider SDKs or web chat adapters directly; they must call AI task capabilities.

### 主题

业务插件禁止直连 Provider

### 法条

Business plugins must not call AI providers directly. They must call AI task capabilities, and AI task capabilities may call AI Input Gateway through the gateway public contract.

Required direction:
- `product-video-dom-runtime` must call an AI task capability for product-video judgment.
- The AI task capability must build the task prompt and expected schema ref.
- The AI task capability must call AI Input Gateway for provider transport.
- The AI task capability must validate the task-specific output schema.

Forbidden:
- `src/plugins/**` importing `src/lib/online-ai`;
- `src/plugins/**` importing provider SDKs directly;
- `src/plugins/**` operating Gemini Web Chat DOM directly;
- `src/plugins/**` operating GPT Web Chat DOM directly;
- business plugins deciding provider adapter details.
