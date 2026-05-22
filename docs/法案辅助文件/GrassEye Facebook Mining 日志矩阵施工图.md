# GrassEye Facebook Mining 日志矩阵施工图

status: active  
version: 2026-05-22  
ownerDomain: facebook-product-video-mining  
relatedLawModule: `.github/instructions/agent-rules/modules/module-runtime-log-spine.instructions.md`  
relatedBlueprint: `docs/法案辅助文件/GrassEye Runtime Log Spine 顶级观测施工图.md`  
enforcement: P0 / machine-blocking  

---

## 0. 定位

本文件是 Facebook 种草视频挖掘流程的专项日志矩阵。

目标：

```txt
用户在 APP 输入 50，点击开始后；
系统后续每一条 Facebook 种草视频挖掘步骤；
都必须可观察、可还原、可诊断、可审计。
```

Facebook DOM 不稳定，页面动态变化强，AI 上传和视频下载也存在天然不确定性。

因此 Facebook mining 不能依赖“出错后猜”。必须依赖日志证据链。

---

## 1. Facebook Mining 标准流程

```txt
MISSION_START
OPEN_FACEBOOK_FEED
WAIT_VIDEO_STABLE
ROUND_START
IDENTIFY_VIDEO
DOM_PROBE
COLLECT_COMMENTS
DOWNLOAD_VIDEO
AI_UPLOAD_AND_JUDGE
PARSE_AI_RESULT
APPLY_DECISION
SAVE_OR_REJECT
NOT_INTERESTED_OPTIONAL
NAVIGATE_NEXT
VERIFY_NEXT_VIDEO_STABLE
ROUND_COMPLETE
```

每个阶段必须有日志。

---

## 2. 可见性原则

### FLOW

只给生产使用者看：

```txt
开始任务：目标 50
第 1 条：rejected
第 2 条：saved
第 3 条：download failed, skipped
第 4 条：saved
...
已保存 50 条，任务完成
```

### DEBUG

给开发调试看：每阶段 started/completed/failed、耗时、数量、refs、hashes、failureClass、recoveryTrail 摘要。

### TRACE

给深度验尸看：DOM 候选、视频身份证据、评论滚动过程、下载候选验证过程、GPT 上传策略、AI 原始输出引用、JSON parse 细节、下一条 before/after signature、fallback 每一步。

---

## 3. Mandatory Stages

```ts
export const FACEBOOK_MINING_MANDATORY_STAGES = [
  "FACEBOOK_MISSION_PREFLIGHT",
  "FACEBOOK_OPEN_FEED",
  "FACEBOOK_WAIT_VIDEO_STABLE",
  "FACEBOOK_ROUND_START",
  "FACEBOOK_IDENTIFY_VIDEO",
  "FACEBOOK_DOM_PROBE",
  "FACEBOOK_COMMENT_COLLECTION",
  "FACEBOOK_VIDEO_DOWNLOAD",
  "FACEBOOK_AI_UPLOAD",
  "FACEBOOK_AI_RESPONSE_WAIT",
  "FACEBOOK_AI_PARSE",
  "FACEBOOK_DECISION_APPLY",
  "FACEBOOK_ARTIFACT_PROMOTE_OR_DELETE",
  "FACEBOOK_NOT_INTERESTED",
  "FACEBOOK_NAVIGATION_NEXT",
  "FACEBOOK_VERIFY_NEXT_STABLE",
  "FACEBOOK_ROUND_FINALIZE",
] as const;
```

每个 stage 必须有：

```txt
STAGE_STARTED
STAGE_COMPLETED | STAGE_FAILED | STAGE_SKIPPED | STAGE_REVIEW_REQUIRED
```

---

## 4. 总矩阵

| Stage | FLOW | DEBUG | TRACE | 必填字段 |
|---|---|---|---|---|
| FACEBOOK_MISSION_PREFLIGHT | 配置摘要 | 完整 redacted config hash | config redacted payload | targetProductCount, maxRounds, maxMinutes, providerKind |
| FACEBOOK_OPEN_FEED | open success/fail | feedEntryUrl redacted, tab status | browser session summary | feedEntryUrl, durationMs |
| FACEBOOK_WAIT_VIDEO_STABLE | 不显示 | video ready summary | 3 次稳定采样 | videoCount, readyState, stableSampleCount |
| FACEBOOK_ROUND_START | round index | roundId | trace/span | roundId, roundIndex |
| FACEBOOK_IDENTIFY_VIDEO | 不显示 | videoKey summary | URL/currentSrc/frame/text/hash chain | videoKey, facebookVideoId, currentSrcHash |
| FACEBOOK_DOM_PROBE | 不显示 | like/comment/share/video facts summary | selector candidates, matched signals | status, likeCount, commentCountDisplayed |
| FACEBOOK_COMMENT_COLLECTION | count summary | scroll count, stopReason | each scroll before/after | commentsLoadedCount, commentsComplete, stopReason |
| FACEBOOK_VIDEO_DOWNLOAD | success/fail | candidateKind, byteSize, sha256 | candidate validation trail | artifactRef, sha256, byteSize |
| FACEBOOK_AI_UPLOAD | success/fail | provider, upload strategy, duration | composer/file chip/submit details | providerKind, fileHash, uploadStrategy |
| FACEBOOK_AI_RESPONSE_WAIT | 不显示 | duration, rawOutputRef | wait/poll timeline | rawOutputRef, outputHash |
| FACEBOOK_AI_PARSE | decision summary | parseStatus/schemaStatus | validation errors, normalized hash | selectedOptionId, confidence |
| FACEBOOK_DECISION_APPLY | saved/rejected/uncertain | reason, status | decision payload | selectedOptionId, status |
| FACEBOOK_ARTIFACT_PROMOTE_OR_DELETE | saved/deleted | artifact disposition | file operation details | artifactRef, disposition |
| FACEBOOK_NOT_INTERESTED | optional status | selector/action result | action attempts | enabled, status |
| FACEBOOK_NAVIGATION_NEXT | next success/fail | before/after videoKey | before/after full signature, fallback | beforeHash, afterHash, changed |
| FACEBOOK_VERIFY_NEXT_STABLE | 不显示 | stable result | stable samples | newVideoKey, stableSampleCount |
| FACEBOOK_ROUND_FINALIZE | round result | duration, failureClass | full summary refs | status, durationMs |

---

## 5. Stage Event 合同

### 5.1 Started Event

```ts
type FacebookStageStartedLog = {
  traceId: string;
  spanId: string;
  parentSpanId: string;
  level: "debug" | "info";
  modeVisibility: Array<"FLOW" | "DEBUG" | "TRACE">;
  eventType: RuntimeLogEventType;
  owner: "facebook-product-video-mining";
  missionId: string;
  runId: string;
  roundId?: string;
  stepId: string;
  status: "started";
  payload: {
    stageName: FacebookMiningStageName;
    stageAttempt: number;
  };
  createdAt: string;
};
```

### 5.2 Terminal Event

```ts
type FacebookStageTerminalLog = {
  traceId: string;
  spanId: string;
  parentSpanId: string;
  level: "debug" | "info" | "warn" | "error";
  modeVisibility: Array<"FLOW" | "DEBUG" | "TRACE">;
  eventType: RuntimeLogEventType;
  owner: "facebook-product-video-mining";
  missionId: string;
  runId: string;
  roundId?: string;
  stepId: string;
  status: "success" | "failed" | "review_required" | "skipped";
  reason?: string;
  durationMs: number;
  refs?: Record<string, string>;
  hashes?: Record<string, string>;
  metrics?: Record<string, number>;
  preview?: Record<string, string>;
  payload: {
    stageName: FacebookMiningStageName;
    stageAttempt: number;
    failureClass?: RuntimeFailureClass;
    retryable?: boolean;
    terminal?: boolean;
    recoveryPolicy?: string;
    recoveryTrail?: unknown[];
  };
  createdAt: string;
};
```

---

## 6. 每阶段详细要求

## 6.1 FACEBOOK_MISSION_PREFLIGHT

STARTED 必须记录：targetProductCount、maxRounds、maxMinutes、providerKind、modelName、notInterestedEnabled、maxCommentScrolls、maxCommentWaitMs、maxVideoBytes。

COMPLETED 必须记录：resolved config hash、runId、missionId、debugBundleRef if created。

FAILED failureClass：SCHEMA_CONTRACT_VIOLATION / INTERNAL_BUG。

---

## 6.2 FACEBOOK_OPEN_FEED

STARTED 必须记录：feedEntryUrl redacted、preferred existing tab policy、browser session ref/hash。

COMPLETED 必须记录：opened or focused existing tab、currentUrl redacted、durationMs。

FAILED 必须记录：reason、failureClass、browser status、actionableMessage。

failureClass：RECOVERABLE_BROWSER_DRIFT / ACCOUNT_SECURITY_BLOCKER / PLATFORM_RATE_LIMIT / INTERNAL_BUG。

---

## 6.3 FACEBOOK_WAIT_VIDEO_STABLE

STARTED 必须记录：maxWaitMs、sampleIntervalMs、requiredStableSamples。

DEBUG COMPLETED 必须记录：videoCount、readyState、duration、width、height、stableSampleCount。

TRACE 必须记录每次采样：sampleIndex、urlRedacted、videoCount、currentSrcHash、readyState、duration、rect summary。

FAILED failureClass：DOM_PROBE_FAILURE / ACCOUNT_SECURITY_BLOCKER / PLATFORM_RATE_LIMIT。

---

## 6.4 FACEBOOK_IDENTIFY_VIDEO

必须生成 VideoIdentity：

```ts
type FacebookVideoIdentityLog = {
  urlPathId: string | null;
  watchParamId: string | null;
  currentSrcHash: string | null;
  downloadedSha256?: string | null;
  visualFrameHash?: string | null;
  textHash?: string | null;
  finalVideoKey: string;
  confidence: number;
  evidenceParts: string[];
};
```

禁止只用 roundIndex 或 URL 作为视频身份。currentSrc 明文 signed URL 不得进入日志。

---

## 6.5 FACEBOOK_DOM_PROBE

STARTED 必须记录：probe script version/hash、expected surfaces。

DEBUG COMPLETED 必须记录：status、likeCount、commentCountDisplayed、shareCountDisplayed、videoElementFacts summary、commentEntry candidate count、moreMenu candidate count、nextVideo candidate count、blocker。

TRACE 必须记录：selector candidate list、matchedSignals、confidence、visibleText clipped、candidate ranking reason。

FAILED/REVIEW_REQUIRED failureClass：DOM_PROBE_FAILURE / ACCOUNT_SECURITY_BLOCKER / PLATFORM_RATE_LIMIT。

---

## 6.6 FACEBOOK_COMMENT_COLLECTION

STARTED 必须记录：maxCommentScrolls、maxCommentWaitMs、entry strategy。

DEBUG COMPLETED 必须记录：commentsLoadedCount、commentsComplete、stopReason、scrollAttempts、durationMs。

TRACE 每次滚动记录：scrollIndex、beforeCount、afterCount、newCount、waitMs、stopCandidate。

评论采集失败不得默认终止 mission；应落账并继续下载/AI，除非账号安全阻断。

---

## 6.7 FACEBOOK_VIDEO_DOWNLOAD

STARTED 必须记录：sourcePageUrl redacted、preferredQuality、maxVideoBytes、roundId。

DEBUG COMPLETED 必须记录：artifactRef、contentType、byteSize、sha256、candidateKind、durationMs、selectedQuality。

TRACE 必须记录 candidate validation trail：candidateKind、urlHash、hostAllowed、rangeProbeStatus、contentType、ftypValid、selected。

下载失败默认应跳过当前视频并继续下一条，不应 terminal mission，除非安全阻断。

---

## 6.8 FACEBOOK_AI_UPLOAD

STARTED 必须记录：providerKind、modelName、videoFileHash、videoByteSize、promptHash、expectedOutputSchemaRef、timeoutMs。

DEBUG COMPLETED 必须记录：uploadStrategy、webChatUrl redacted、sourcePageUrlBeforeFeed redacted、restoredSourcePage、durationMs。

TRACE 必须记录：composerDetected、fileInputDetected、fileChipDetected、submitButtonDetected、submitEnabled、uploadStrategyTrail。

AI 上传失败默认可重试；重试耗尽后跳过当前视频，不应直接 terminal mission，除非无法恢复 Facebook tab。

---

## 6.9 FACEBOOK_AI_RESPONSE_WAIT

STARTED 必须记录：timeoutMs、providerKind。

COMPLETED 必须记录：rawOutputRef、rawOutputHash、outputPreview clipped、durationMs。

TRACE 记录轮询过程：pollIndex、assistantMessageDetected、textLength、looksComplete。

---

## 6.10 FACEBOOK_AI_PARSE

STARTED 必须记录：rawOutputHash、expected schema。

FLOW 记录 selectedOptionId、confidence。

DEBUG 记录 parseStatus、schemaValidationStatus、selectedOptionId、visibleProduct、productCategory、reason clipped。

TRACE 记录 normalizedTextHash、validation errors summary、extracted JSON clipped。

AI parse failed 默认应保存 raw output ref，然后跳过当前视频，继续下一条；不要丢失原始输出。

---

## 6.11 FACEBOOK_DECISION_APPLY

STARTED 必须记录：selectedOptionId、confidence、policy。

FLOW 记录 round saved/rejected/uncertain。

DEBUG 记录 status、reason、aiConfidence、commentsLoadedCount、likeCount、commentCountDisplayed。

---

## 6.12 FACEBOOK_ARTIFACT_PROMOTE_OR_DELETE

Accepted 必须记录：staging artifact ref、final artifact ref、sha256、byteSize、disposition = final。

Rejected 必须记录：deleted artifact ref、sha256、disposition = deleted/rejected、saveRejectedTrace。

FAILED failureClass：ARTIFACT_FAILURE。

---

## 6.13 FACEBOOK_NOT_INTERESTED

STARTED 必须记录：enabled、strategy、moreMenuElementRef summary。

COMPLETED 必须记录：status、action selected、durationMs。

TRACE 必须记录：menu open action、option candidates、clicked candidate、after state hash。

Not Interested 失败不得终止 mission，除非导致页面安全阻断。

---

## 6.14 FACEBOOK_NAVIGATION_NEXT

STARTED 必须记录：beforeVideoKey、beforeSignatureHash、activeDialogCount、strategy order。

DEBUG COMPLETED 必须记录：action used、fallback used、afterVideoKey、afterSignatureHash、changed、durationMs。

TRACE 必须记录 before/after full signature summary 和 actions trail。

单次 navigation failed 不应立即 terminal mission。必须先执行 recovery policy：close dialogs、focus Facebook tab、ArrowDown、scroll、reopen feed、verify new video stable。全部失败才 review_required。

---

## 6.15 FACEBOOK_VERIFY_NEXT_STABLE

STARTED 必须记录：oldVideoKey、requiredStableSamples、maxWaitMs。

COMPLETED 必须记录：newVideoKey、stableSampleCount、changedFromOld、durationMs。

如果无法确认新视频稳定，可重试 navigation；重试耗尽后跳过或 review_required，取决于连续失败次数。

---

## 6.16 FACEBOOK_ROUND_FINALIZE

FLOW 必须记录：roundIndex、status、savedProductCount、scannedCount、targetProductCount。

DEBUG 必须记录：durationMs、candidateId、videoKey、failureClass if any、recoveryTrail summary。

TRACE 必须记录：stage refs、round summary ref。

---

## 7. FailureClass 策略

| FailureClass | 是否重试 | 是否跳过当前视频 | 是否终止 mission |
|---|---:|---:|---:|
| TRANSIENT_RETRYABLE | 是 | 重试耗尽后是 | 否 |
| SKIPPABLE_ROUND_FAILURE | 否 | 是 | 否 |
| RECOVERABLE_BROWSER_DRIFT | 是 | 恢复失败后是 | 连续失败才是 |
| ACCOUNT_SECURITY_BLOCKER | 否 | 否 | 是 |
| PLATFORM_RATE_LIMIT | 可延迟 | 否 | 是/Review |
| SCHEMA_CONTRACT_VIOLATION | 否 | 否 | 是 |
| AI_PROVIDER_FAILURE | 是 | 重试耗尽后是 | 否 |
| AI_PARSE_FAILURE | 可重试一次 | 是 | 否 |
| MEDIA_DOWNLOAD_FAILURE | 可重试 | 是 | 否 |
| DOM_PROBE_FAILURE | 可重试 | 是 | 连续失败才是 |
| NAVIGATION_FAILURE | 可恢复 | 否 | 恢复失败才是 |
| ARTIFACT_FAILURE | 否 | 视情况 | 是/Review |
| INTERNAL_BUG | 否 | 否 | 是 |
| UNKNOWN | 否 | 否 | Review |

---

## 8. Recovery Trail 标准

```ts
type FacebookRecoveryTrailItem = {
  action:
    | "close_comment_surface"
    | "focus_facebook_tab"
    | "restore_source_page"
    | "retry_dom_probe"
    | "retry_download"
    | "retry_ai_upload"
    | "click_next_candidate"
    | "arrow_down"
    | "scroll_feed"
    | "reopen_feed"
    | "verify_video_stable";

  status: "started" | "success" | "failed" | "skipped";
  reason?: string;
  durationMs?: number;
  beforeHash?: string;
  afterHash?: string;
};
```

失败事件必须携带 recoveryTrail。

---

## 9. Debug Bundle Round 结构

每个 round 必须可落成：

```txt
round-000001/
  round-summary.json
  stage-timeline.json
  video-identity.json
  dom-probe.json
  comments.summary.json
  video-download-result.json
  ai-upload.summary.json
  ai-response.ref.json
  ai-parse-result.json
  decision.json
  navigation-before.json
  navigation-after.json
  recovery-trail.json
```

---

## 10. 自动诊断输出

任意 failed/review_required round 必须生成：

```md
# Facebook Mining Round Diagnosis

## Summary

- runId:
- roundId:
- roundIndex:
- stage:
- failureClass:
- terminal:
- retryable:

## Human-readable reason

...

## Evidence

- videoKey:
- beforeSignatureHash:
- afterSignatureHash:
- aiRawOutputRef:
- videoArtifactRef:

## Recovery Trail

...

## Suggested Fix

...
```

---

## 11. Inspector 验收

Facebook 日志覆盖 inspector 必须检查：

```txt
1. flow.ts 是否有 mission started/completed/stopped 日志。
2. round.ts 是否覆盖 mandatory stages。
3. comments.ts 是否记录 collection started/completed/failure。
4. video.ts 是否记录 download started/completed/failure。
5. ai-judge.ts 是否记录 AI upload/response/parse。
6. navigation.ts 是否记录 before/action/after/fallback。
7. not-interested.ts 是否记录 action attempt。
8. outcome.ts 是否记录 save/reject/promote/delete。
9. 所有 failure 是否有 failureClass。
10. 所有 recovery 是否有 recoveryTrail。
11. 所有 terminal 是否有 actionableMessage。
12. 所有 event 是否有 traceId/runId/roundId。
```

---

## 12. 完成定义

本专项施工图完成后，必须达到：

```txt
用户输入 50 点击开始；
任意一条视频失败；
开发者打开 debug bundle；
无需重新跑；
无需猜；
可以直接知道：

是 DOM 没识别？
是评论没打开？
是视频没下载？
是 GPT 没上传？
是 AI JSON 坏了？
是下一条没切换？
是 tab 跑偏？
是 Facebook 安全阻断？

并且知道系统尝试过哪些恢复动作。
```

这就是 Facebook 种草视频挖掘的顶级日志标准。
