# Deep Research Current Flow Debug Guide

## One Sentence Answer

The current Deep Research flow is designed to switch back to the source page after one web-chat round finishes. The bug was that the GPT web-chat path could treat the previous assistant message as the current round's answer, return too early, and then restore the APP page immediately. The fix now requires the assistant message count to increase before the round may finish.

## What The User Sees First

1. In the workbench page, the user fills in:
   - `userQuestion`
   - `analysisGoal`
   - `language`
   - `maxSubQuestions`
   - `providerKind`
2. The form submit handler lives in [src/app/workbench-deep-research-client.ts](src/app/workbench-deep-research-client.ts).
3. When the user clicks Start, the browser sends `POST /api/deep-research-analysis/start`.
4. The request body contains:
   - `userQuestion`
   - `analysisGoal`
   - `language`
   - `maxSubQuestions`
   - `outputFormat`
   - `providerKind`
5. The client does not wait for the whole research job to finish in the browser tab.
6. The client immediately renders the first snapshot returned by the server, stores `jobId` in localStorage, and starts polling `/api/deep-research-analysis/timeline` every 5 seconds.

## HTTP Entry And Workbench Start

1. The HTTP entry is [src/app/workbench-deep-research-routes.ts](src/app/workbench-deep-research-routes.ts).
2. `handleStartRequest` reads JSON, validates the basic fields, and calls `workbench.startDeepResearchAnalysis(...)`.
3. The workbench handle implementation is in [src/lib/local-runtime/workbench.ts](src/lib/local-runtime/workbench.ts).
4. `startDeepResearchAnalysis` does two different things almost at the same time:
   - It creates `runPromise = deepResearchAnalysisPublicFacade.runDeepResearchAnalysis(...)`.
   - It immediately reads the latest snapshot from the local store and returns that snapshot to the HTTP caller.
5. This means the Start API is intentionally non-blocking.
6. The APP page does not stay blocked waiting for the whole Deep Research job. Instead, it returns a job snapshot quickly and relies on polling for later progress.

## Background Run Creation

1. The public facade delegates to `runDeepResearchAnalysis(...)` in [src/plugins/deep-research-analysis/deep-research-analysis.analysis-runner.ts](src/plugins/deep-research-analysis/deep-research-analysis.analysis-runner.ts).
2. `createExecutionContext(...)` builds the runtime context:
   - `runtimeLogger`
   - `dataDir`
   - `sender`
   - `store`
   - `jobId`
   - `traceContext`
   - `stageLogger`
   - `providerKind`
   - `recordHashes`
3. The record store is created by [src/plugins/deep-research-analysis/deep-research-analysis.records.ts](src/plugins/deep-research-analysis/deep-research-analysis.records.ts).
4. `store.createJob(...)` inserts a row into `research_jobs` with:
   - `status = queued`
   - `phase = INTAKE`
5. The runner emits `DEEP_RESEARCH_JOB_STARTED` through [src/plugins/deep-research-analysis/deep-research-analysis.logging.ts](src/plugins/deep-research-analysis/deep-research-analysis.logging.ts).
6. Then it enters `runAnalysisPhases(...)`.

## The Real Main Flow

The real execution order is:

1. `runDecompositionPhase(...)`
2. `runSubQuestionPhases(...)`
3. `buildFullCaseFileStage(...)`
4. `runFinalAdjudicationPhase(...)`
5. `runBusinessHtmlReportPhase(...)`
6. `completeSuccessfulRun(...)`

These steps are driven by:

- [src/plugins/deep-research-analysis/deep-research-analysis.analysis-runner.ts](src/plugins/deep-research-analysis/deep-research-analysis.analysis-runner.ts)
- [src/plugins/deep-research-analysis/deep-research-analysis.analysis-sub-questions.ts](src/plugins/deep-research-analysis/deep-research-analysis.analysis-sub-questions.ts)
- [src/plugins/deep-research-analysis/deep-research-analysis.analysis-finalization.ts](src/plugins/deep-research-analysis/deep-research-analysis.analysis-finalization.ts)
- [src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts](src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts)

If any decomposition, sub-question, final adjudication, or HTML report stage returns a terminal failure, the job stops immediately with `failed` or `review_required`. Later sub-questions, final adjudication, HTML generation, and export must not continue.

## Common Prompt Exchange Skeleton

Almost every AI interaction in Deep Research goes through the same skeleton in [src/plugins/deep-research-analysis/deep-research-analysis.prompt-exchange-core.ts](src/plugins/deep-research-analysis/deep-research-analysis.prompt-exchange-core.ts).

For each stage, the system does this:

1. Build prompt hash.
2. Build prompt package.
3. Mark the job state as `running` and move it to the current `*_SEND` stage.
4. Emit `DEEP_RESEARCH_PROMPT_SENT`.
5. Call `capturePromptOutput(...)`.
6. Inside capture, call `sender(promptPackage)`.
7. Wait for the AI gateway to return a completed or terminal result.
8. Build `domRef`.
9. Emit `DEEP_RESEARCH_DOM_CAPTURE_STARTED` and `DEEP_RESEARCH_DOM_CAPTURE_COMPLETED` or a terminal failure.
10. Parse the normalized text.
11. If parsing fails, emit `DEEP_RESEARCH_PARSE_FAILED` and stop the job with `failed` or `review_required`.
12. If parsing succeeds, emit `DEEP_RESEARCH_PARSE_COMPLETED`.
13. Create one `research_interactions` row by calling `createInteractionRecord(...)` in [src/plugins/deep-research-analysis/deep-research-analysis.prompt-exchange-stage-support.ts](src/plugins/deep-research-analysis/deep-research-analysis.prompt-exchange-stage-support.ts).
14. Persist phase-specific structured records.
15. Emit `DEEP_RESEARCH_RECORD_PERSISTED`.

## What The Sender Really Is

1. Deep Research does not directly automate ChatGPT.
2. It calls `buildGatewaySender(...)` in [src/plugins/deep-research-analysis/deep-research-analysis.flow-shared.ts](src/plugins/deep-research-analysis/deep-research-analysis.flow-shared.ts).
3. `buildGatewaySender(...)` delegates to `aiInputGateway.execute(...)`.
4. That call enters the AI input gateway ability group.
5. For GPT web chat, the runtime path is:
   - [src/capabilities/ai-input-gateway/runtime/feed-gpt-web-chat-once.ts](src/capabilities/ai-input-gateway/runtime/feed-gpt-web-chat-once.ts)
   - [src/capabilities/ai-input-gateway/runtime/feed-provider-once.ts](src/capabilities/ai-input-gateway/runtime/feed-provider-once.ts)
   - [src/capabilities/ai-input-gateway/providers/gpt-web-chat.adapter.ts](src/capabilities/ai-input-gateway/providers/gpt-web-chat.adapter.ts)
   - [src/capabilities/ai-input-gateway/providers/web-chat-shared.ts](src/capabilities/ai-input-gateway/providers/web-chat-shared.ts)

## What Happens In One GPT Web Chat Round

The key runtime is `runWebChatAdapter(...)` in [src/capabilities/ai-input-gateway/providers/web-chat-shared.ts](src/capabilities/ai-input-gateway/providers/web-chat-shared.ts).

### Step 1: Remember The Current Source Page

1. The gateway calls `readActivePageUrl(browser)` from [src/capabilities/ai-input-gateway/providers/web-chat-shared-support.ts](src/capabilities/ai-input-gateway/providers/web-chat-shared-support.ts).
2. Whatever page is active right before opening ChatGPT becomes `sourcePageUrlBeforeFeed`.
3. In your current workbench scenario, that source page is usually the APP page.

### Step 2: Open Or Focus The GPT Page

1. The gateway calls `openProviderPage(...)`.
2. `openProviderPage(...)` first tries to focus an existing provider workspace tab.
3. If no saved workspace tab can be focused, it opens `https://chatgpt.com/`.
4. It waits until the composer is ready.
5. If a workspace URL is recognized, it persists that workspace URL for later reuse.

### Step 3: Optional Upload Phase

1. `pasteFilesViaClipboard(...)` is called.
2. For Deep Research, there are normally no file attachments.
3. So this step is usually a no-op in practice, but it still stays in the execution chain.

### Step 4: Read The Conversation State Before Submit

1. The gateway calls `readPreSubmitConversationState(...)`.
2. This reads a very short snapshot of the current chat using `waitForStableAnswer(...)` with a 1 second budget.
3. It extracts two critical values:
   - `previousAssistantCount`
   - `previousAnswerText`
4. These two values are supposed to protect the system from mistaking old conversation content for the new answer.

### Step 5: Submit The Prompt

1. The gateway calls `submitPromptViaClipboard(...)`.
2. It focuses the composer.
3. It clears the composer.
4. It pastes the prompt text into the browser.
5. It verifies that the pasted prompt text matches what Deep Research wanted to send.
6. It presses Return.
7. It waits for prompt submission proof.
8. Submission is considered successful if at least one of these becomes true:
   - assistant count increased
   - provider started generating
   - composer was cleared after submit

### Step 6: Wait For The New GPT Answer

1. After submit, the gateway calls `extractWebChatConversation(...)`.
2. That function focuses the provider workspace again.
3. Then it calls `waitForStableAnswer(...)`.
4. `waitForStableAnswer(...)` keeps polling the active provider tab.
5. Each poll evaluates:
   - latest assistant text
   - assistant count
   - whether the page looks like it is still generating
6. It keeps polling until the answer is stable for enough rounds and generation is no longer active.

## Why It Was Switching Back To The APP Page Too Early

The short version:

1. The system always restores the source page after one web-chat round ends.
2. That restore happens in the `finally` block of `runWebChatAdapter(...)`.
3. So the only safe way to avoid an early switch back is to make sure `runWebChatAdapter(...)` does not finish before the new GPT answer is actually detected.

The real bug was this:

1. The code correctly recorded `previousAssistantCount` before submission.
2. The answer polling code already had support for `minAssistantCount`.
3. But `extractWebChatConversation(...)` did not pass `minAssistantCount` into `waitForStableAnswer(...)`.
4. Because of that, the polling logic could accept a stable old assistant message as if it were the new answer for the current round.
5. Once that happened, `runWebChatAdapter(...)` returned early.
6. Then its `finally` block restored `sourcePageUrlBeforeFeed`.
7. Since `sourcePageUrlBeforeFeed` was your APP page, Chrome appeared to switch back immediately right after sending.

## The Fix That Was Applied

The fix is in [src/capabilities/ai-input-gateway/providers/web-chat-shared.ts](src/capabilities/ai-input-gateway/providers/web-chat-shared.ts).

The change is:

1. `extractWebChatConversation(...)` now receives `previousAssistantCount`.
2. It passes `minAssistantCount = previousAssistantCount + 1` into `waitForStableAnswer(...)`.
3. This means the current round cannot complete until a new assistant turn actually appears.
4. Only after that new assistant turn becomes stable may the gateway return and restore the APP page.

## Decomposition Phase In Detail

The decomposition phase is started by `runDecompositionPhase(...)` in [src/plugins/deep-research-analysis/deep-research-analysis.analysis-sub-questions.ts](src/plugins/deep-research-analysis/deep-research-analysis.analysis-sub-questions.ts).

Detailed steps:

1. Render the decomposition prompt from the user input.
2. Build `inputRefs = [job:<jobId>:user-question]`.
3. Run prompt exchange with stages:
   - `DECOMPOSE_SEND`
   - `DECOMPOSE_CAPTURE`
   - `DECOMPOSE_PARSE`
   - `DECOMPOSE_PERSIST`
4. Parse the AI output into structured sub-questions.
5. Save all sub-questions to the local database.
6. If any part fails, stop the full research job immediately with `failed` or `review_required`.

## N-Stage Analysis In Detail

For each sub-question:

1. Read the exact `subQuestion.promptBundle` that was persisted from the first AI Research Plan.
2. Render the analysis prompt by combining:
   - original user question
   - optional analysis goal
   - current sub-question JSON
   - the sub-question's own `promptBundle`
   - language
3. Build prompt key `analysis:<subQuestionId>`.
4. Run prompt exchange with:
   - `ANALYSIS_SEND`
   - `ANALYSIS_CAPTURE`
   - `ANALYSIS_PARSE`
   - `ANALYSIS_PERSIST`
5. Persist the raw interaction first.
6. If the response can be indexed as JSON, persist `parsedJsonIndex` as a secondary index.
7. If the response is non-empty but has no JSON envelope, persist the raw response as `answerText` and mark it as `parsed_text_raw_index`.
8. If the response is empty or the gateway returns a terminal failure, stop the full job immediately. No further sub-question, final adjudication, HTML report, or export stage may continue.

This loop repeats for every saved sub-question until one fails or all complete.

## Full Case File And Final Adjudication

After all sub-questions complete:

1. `buildFullCaseFileStage(...)` moves the job to `FULL_CASE_FILE_BUILD`.
2. It builds `structuredIndex` from all persisted interactions, sub-questions, answers, and prompt versions.
3. It builds the `fullCaseFile` from all raw prompts, all raw responses, parse states, provider proof, and the structured index.
4. It renders `fullCaseFileMarkdown` for downstream AI consumption and export.
5. `runFinalAdjudicationPhase(...)` renders the final prompt from:
   - `structuredIndex`
   - `fullCaseFile`
   - `fullCaseFileMarkdown`
   - `finalAdjudicationPromptBundle`
6. It runs another full prompt exchange using:
   - `FINAL_ADJUDICATION_SEND`
   - `FINAL_ADJUDICATION_CAPTURE`
   - `FINAL_ADJUDICATION_PARSE`
   - `FINAL_ADJUDICATION_PERSIST`
7. It saves `rawFinalAnswerText` as the primary final adjudication artifact.
8. If the final answer is JSON-shaped, it may also save `parsedJsonIndex` as a secondary navigation index.

## HTML Report, Export, And Completion

1. `runBusinessHtmlReportPhase(...)` renders the HTML prompt from:
   - `rawFinalAnswerText`
   - `fullCaseFile`
   - `fullCaseFileMarkdown`
   - `htmlReportPromptBundle`
2. It runs prompt exchange using:
   - `HTML_REPORT_SEND`
   - `HTML_REPORT_CAPTURE`
   - `HTML_REPORT_DETECT`
   - `HTML_REPORT_PERSIST`
3. The HTML stage succeeds only when AI directly returns one complete self-contained HTML document that can be persisted as `business-report.html`.
4. The job moves to `EXPORT_REPORT`.
5. `exportDeepResearchArtifacts(...)` writes:
   - `full-case-file.json`
   - `full-case-file.md`
   - `final-adjudication-raw.md`
   - `business-report.html`
   - `evidence-index.json`
   - `structured-index.json`
6. The job emits `DEEP_RESEARCH_EXPORT_COMPLETED`.
7. The job moves to `COMPLETE`.
8. The runner emits `DEEP_RESEARCH_JOB_COMPLETED`.

## How The Timeline UI Is Built

The data shown in the APP page timeline is reconstructed by [src/plugins/deep-research-analysis/deep-research-analysis.public.ts](src/plugins/deep-research-analysis/deep-research-analysis.public.ts).

For a given `jobId`, it reads:

1. the job row
2. all interactions
3. all sub-questions
4. all answers
5. the latest final adjudication raw record
6. all export records

Then it reconstructs per-interaction timeline entries containing:

1. `interactionId`
2. `phase`
3. `subQuestionId`
4. `promptId`
5. `promptVersion`
6. `promptHash`
7. `rawResponseHash`
8. reconstructed `promptText`
9. raw response text
10. parsed answer text or final raw text index
11. parsed JSON payload when available as a secondary index
12. parsed record ids
13. `domRef`
14. `createdAt`
15. prompt reconstruction verification status

This is why the APP timeline can later show "Copy prompt", "Copy response", "Parsed JSON", and prompt hash / response hash.

## Where To Inspect If The Flow Still Fails

If the flow still breaks, inspect in this order:

1. Was the prompt actually submitted on the GPT page?
   - Check `verifyPromptSubmitted(...)` behavior.
2. Did the assistant count increase after submit?
   - Check `assistantCount` in the evaluation script.
3. Did `waitForStableAnswer(...)` ever see `generating = true`?
4. Did the gateway return `status = completed`, `review_required`, or `failed`?
5. Was `rawOutputRef` written by the AI input gateway?
6. Did Deep Research write a `research_interactions` row?
7. Did parsing fail and stop at `*_PARSE`?
8. Did the job status become `review_required` but the UI only looked like it ended early?
9. Did `restoreSourcePage(...)` succeed, and what was `sourcePageUrlBeforeFeed`?

## Short Diagnostic Conclusion

The APP page switching back is not itself the bug. Switching back is normal after one provider round finishes. The bug was that the GPT provider round could finish too early because the current-round answer detector did not require a new assistant turn to appear. That gap is now closed by enforcing assistant-count growth before the round may be considered complete.