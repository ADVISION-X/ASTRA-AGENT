# GrassEye Runtime Log Spine 顶级观测施工图

status: active  
version: 2026-05-22  
ownerDomain: runtime-log-spine  
relatedLawModule: `.github/instructions/agent-rules/modules/module-runtime-log-spine.instructions.md`  
enforcement: P0 / machine-blocking  

---

## 0. 施工图目标

本施工图用于把 Runtime Log Spine 法案落成可执行架构。

目标不是“多打印日志”，而是建立一个能支撑 GrassEye 长期成长的顶级观测系统：

```txt
生产：一眼看流程；
调试：一眼看阶段；
TRACE：一眼看原子动作；
审计：一眼证明没有日志黑洞。
```

---

## 1. 推荐目录结构

### 1.1 Runtime Log Spine 核心目录

```txt
src/lib/runtime-logs/
  ├─ index.ts
  ├─ schema.ts
  ├─ event-types.ts
  ├─ failure-classes.ts
  ├─ mode.ts
  ├─ logger.ts
  ├─ sinks.ts
  ├─ redaction.ts
  ├─ trace-context.ts
  ├─ event-factory.ts
  ├─ stage-logger.ts
  ├─ recovery-logger.ts
  ├─ ai-log-contract.ts
  ├─ browser-action-log-contract.ts
  ├─ debug-bundle.ts
  ├─ debug-bundle-index.ts
  └─ diagnosis.ts
```

### 1.2 Runtime Log Spine 审计目录

```txt
scripts/audit/domains/runtime-log-spine/
  ├─ manifest.json
  ├─ inspector.ts
  ├─ forbidden-console-inspector.ts
  ├─ event-type-registry-inspector.ts
  ├─ runtime-log-emit-contract-inspector.ts
  ├─ stage-pair-coverage-inspector.ts
  ├─ catch-branch-log-inspector.ts
  ├─ failure-class-inspector.ts
  ├─ redaction-inspector.ts
  ├─ debug-bundle-inspector.ts
  ├─ mode-visibility-inspector.ts
  └─ generated-report-writer.ts
```

---

## 2. Trace Context 设计

新增：

```txt
src/lib/runtime-logs/trace-context.ts
```

### 2.1 类型

```ts
type RuntimeTraceContext = {
  traceId: string;
  missionId?: string;
  runId?: string;
  roundId?: string;
  stepId?: string;
  spanId?: string;
  parentSpanId?: string;
  owner: RuntimeLogOwner;
};
```

### 2.2 Helper

```ts
function createMissionTrace(input: {
  missionId: string;
  runId: string;
  owner: RuntimeLogOwner;
}): RuntimeTraceContext;

function withRound(input: {
  context: RuntimeTraceContext;
  roundId: string;
}): RuntimeTraceContext;

function childSpan(input: {
  context: RuntimeTraceContext;
  spanId: string;
  stepId?: string;
}): RuntimeTraceContext;
```

### 2.3 强制规则

所有 stage logger、AI logger、browser action logger 都只接收 `RuntimeTraceContext`，禁止在业务代码里手写散乱 trace 字段。

---

## 3. Stage Logger 设计

新增：

```txt
src/lib/runtime-logs/stage-logger.ts
```

### 3.1 标准 API

```ts
type RuntimeStageName = string;

type StageLogger = {
  start(input: {
    context: RuntimeTraceContext;
    stageName: RuntimeStageName;
    modeVisibility?: RuntimeLogMode[];
    preview?: Record<string, string>;
    refs?: Record<string, string>;
    hashes?: Record<string, string>;
    metrics?: Record<string, number>;
  }): RuntimeStageHandle;
};

type RuntimeStageHandle = {
  stageName: RuntimeStageName;
  startedAt: number;
  stepId: string;

  complete(input?: {
    preview?: Record<string, string>;
    refs?: Record<string, string>;
    hashes?: Record<string, string>;
    metrics?: Record<string, number>;
    payload?: Record<string, unknown>;
  }): void;

  fail(input: {
    reason: string;
    failureClass: RuntimeFailureClass;
    retryable: boolean;
    terminal: boolean;
    recoveryPolicy: RuntimeRecoveryPolicy;
    actionableMessage?: string;
    preview?: Record<string, string>;
    refs?: Record<string, string>;
    hashes?: Record<string, string>;
    metrics?: Record<string, number>;
    payload?: Record<string, unknown>;
  }): void;

  skip(input: {
    reason: string;
    failureClass: RuntimeFailureClass;
    preview?: Record<string, string>;
    metrics?: Record<string, number>;
  }): void;

  reviewRequired(input: {
    reason: string;
    failureClass: RuntimeFailureClass;
    actionableMessage?: string;
    preview?: Record<string, string>;
    payload?: Record<string, unknown>;
  }): void;
};
```

### 3.2 自动能力

Stage logger 必须自动填：

- `durationMs`
- `stepId`
- `spanId`
- `parentSpanId`
- `traceId`
- `owner`
- `modeVisibility`
- `status`
- `eventType`

---

## 4. Event Factory 设计

新增：

```txt
src/lib/runtime-logs/event-factory.ts
```

目的：禁止到处手写 `RuntimeLogger.emit({ ... })`。

```ts
function createRuntimeEvent(input: {
  context: RuntimeTraceContext;
  eventType: RuntimeLogEventType;
  level: RuntimeLogLevel;
  modeVisibility: RuntimeLogMode[];
  status?: RuntimeStatus;
  reason?: string;
  refs?: Record<string, string>;
  metrics?: Record<string, number>;
  hashes?: Record<string, string>;
  preview?: Record<string, string>;
  payload?: Record<string, unknown>;
  durationMs?: number;
}): RuntimeLogEventInput;
```

原则：业务模块优先使用 stage logger / recovery logger / AI log contract / browser action log contract。少数底层场景才允许直接 `logger.emit`。

Inspector 应统计直接 emit，并要求理由。

---

## 5. Debug Bundle 设计

新增：

```txt
src/lib/runtime-logs/debug-bundle.ts
src/lib/runtime-logs/debug-bundle-index.ts
```

### 5.1 Bundle 根目录

```txt
<dataDir>/debug-bundles/<runId>/
```

### 5.2 Bundle 结构

```txt
debug-bundles/<runId>/
  runtime-log.jsonl
  mission-summary.json
  config.redacted.json
  index.json
  rounds/
    round-000001/
      round-summary.json
      dom-probe.json
      comments.summary.json
      video-download-result.json
      ai-request.summary.json
      ai-response.raw.ref.json
      ai-parse-result.json
      navigation-before.json
      navigation-after.json
      recovery-trail.json
  artifacts/
    refs.json
```

### 5.3 index.json

```ts
type DebugBundleIndex = {
  runId: string;
  missionId: string;
  createdAt: string;
  logMode: "FLOW" | "DEBUG" | "TRACE";
  runtimeLogRef: string;
  rounds: Array<{
    roundId: string;
    roundIndex: number;
    status: string;
    stageRefs: Record<string, string>;
    failureClass?: string;
    failureReason?: string;
  }>;
  artifacts: Record<string, {
    ref: string;
    sha256?: string;
    byteSize?: number;
    contentType?: string;
  }>;
};
```

### 5.4 写入失败规则

Debug bundle 写入失败不得 crash mission，但必须 emit：

```txt
DEBUG_BUNDLE_WRITE_FAILED
```

并带：path、reason、failureClass = ARTIFACT_FAILURE、recoveryPolicy = continue_without_bundle。

---

## 6. Redaction 施工要求

### 6.1 Redaction 必须在 sink 前执行

所有 sink，包括 terminal、file、debug bundle、future UI stream，都必须调用统一 redaction。

### 6.2 Redaction 规则

必须处理：

```txt
cookie
cookies
token
authorization
password
api_key
api-key
secret
session
bearer
auth
localStorage
sessionStorage
data:*;base64
long base64-like string
signed CDN URL query
```

### 6.3 URL 脱敏

新增：

```ts
function redactUrlForLog(value: string): string {
  // keep origin + pathname
  // remove query/search/hash
}
```

### 6.4 Signed URL 保存

如果需要关联 signed URL，只允许：

```json
{
  "urlRedacted": "https://video.xx.fbcdn.net/path/video.mp4",
  "urlHash": "sha256:..."
}
```

---

## 7. RuntimeLogEventType 扩展建议

建议增加通用阶段事件：

```ts
RUNTIME_STAGE_STARTED
RUNTIME_STAGE_COMPLETED
RUNTIME_STAGE_FAILED
RUNTIME_STAGE_SKIPPED
RUNTIME_STAGE_REVIEW_REQUIRED
RECOVERY_STARTED
RECOVERY_COMPLETED
RECOVERY_FAILED
DEBUG_BUNDLE_CREATED
DEBUG_BUNDLE_WRITE_FAILED
BROWSER_ACTION_STARTED
BROWSER_ACTION_COMPLETED
BROWSER_ACTION_FAILED
AI_UPLOAD_STARTED
AI_UPLOAD_COMPLETED
AI_UPLOAD_FAILED
AI_PARSE_STARTED
AI_PARSE_COMPLETED
AI_PARSE_FAILED
VIDEO_IDENTITY_RESOLVED
ARTIFACT_REF_RECORDED
```

---

### 7.1 Browser Authority 运行态事件

固定解压扩展与 Workbench 只能通过注入的 Runtime Logger 记录以下状态，不得建立扩展私有日志、第二 WebSocket 或第二持久化链：

```txt
BROWSER_INFRASTRUCTURE_READY
BROWSER_AUTH_WAITING_FOR_PAIRING
BROWSER_AUTH_PAIRING_STARTED
BROWSER_AUTH_PAIRING_COMPLETED
BROWSER_AUTH_PAIRING_FAILED
BROWSER_SOCKET_AUTHENTICATED
BROWSER_LIVENESS_HEARTBEAT
BROWSER_AUTH_REVOKED
BROWSER_EXTENSION_FAILURE
BROWSER_TARGET_CLAIMED
BROWSER_TARGET_LEASE_INVALIDATED
```

其中失败事件必须携带固定 `BROWSER_*` reason code；心跳、认领和撤销必须绑定当前连接代次。Extension authenticated frame failure、unhandled rejection 与 worker error 必须通过同一加密 WebSocket 上行，Workbench 终端记录脱敏 `diagnosticSource`、`runtimeEventType`、`errorName`、`failedFrameKind`、`failedFrameSequence`、`encodedByteLength`、`closeCode/closeReason` 或 `errorCode`。普通 runtime diagnostic 使用 `DIAGNOSTIC` frame，只记录、不撤销 Authority；认证完整性失败使用 `REVOKE`，先记录再撤销。日志禁止包含一次性配对密钥、会话密钥、私钥、cookie、token、原始加密帧、raw prompt/payload、页面正文、stack/raw path 或完整 URL 查询参数。

验收必须覆盖：服务端与扩展端对同一 header-only AAD 的双向 AES-GCM 互通、真实 Workbench 收到非法握手时打印配对失败事件，以及扩展 authenticated runtime failure 能在启动终端打印 `BROWSER_EXTENSION_FAILURE` 和脱敏 frame/transport refs；仅在 `chrome://extensions` 留下错误视为失败。

## 8. Inspector 施工

### 8.1 forbidden-console-inspector

扫描：

```txt
src/**/*.ts
```

禁止：

```txt
console.log
console.error
console.warn
console.debug
```

允许例外：

```txt
src/lib/runtime-logs/sinks.ts
scripts/**
tests/**
*.acceptance.ts
```

### 8.2 event-type-registry-inspector

阻断：

```txt
eventType: "SOME_STRING"
```

必须使用：

```ts
RuntimeLogEventType.X
```

### 8.3 emit-contract-inspector

所有 emit 必须有：traceId、level、modeVisibility、eventType、owner、status where applicable、reason where failed/review_required/skipped。

### 8.4 stage-pair-inspector

从 log matrix 读取 mandatory stages，检查代码中是否有 stage start 和 stage terminal。

### 8.5 failure-class-inspector

检查所有 failed/review_required/skipped event 是否包含 failureClass。

### 8.6 redaction-inspector

检查 sink 是否调用 redaction，且 redaction tests 覆盖 secret patterns。

### 8.7 debug-bundle-inspector

检查 bundle writer 和 acceptance 是否存在。

---

## 9. Acceptance 测试

### 9.1 runtime-log-mode.acceptance.ts

验证：

```txt
FLOW 只输出 FLOW events
DEBUG 输出 FLOW + DEBUG
TRACE 输出全部
```

### 9.2 runtime-log-redaction.acceptance.ts

验证 secret 不进入 sink。

### 9.3 runtime-log-stage-pair.acceptance.ts

模拟 stage start/complete/fail，验证 durationMs 和 pair。

---

## 10. 诊断报告格式

新增：

```txt
src/lib/runtime-logs/diagnosis.ts
```

输出：

```md
# Runtime Failure Diagnosis

## Summary

- Run: ...
- Round: ...
- Stage: ...
- FailureClass: ...
- Terminal: true/false
- RecoveryPolicy: ...

## What happened

...

## Evidence

- beforeSignatureHash: ...
- afterSignatureHash: ...
- aiRawOutputRef: ...
- videoArtifactRef: ...

## Recovery trail

1. close_comment_surface: success
2. focus_provider_tab: success
3. arrow_down_fallback: failed

## Suggested next action

...
```

---

## 11. 迁移顺序

### Phase 1：法案与基础设施

- 新增 runtime log spine 法案
- 新增本施工图
- 新增 failure-classes.ts
- 新增 stage-logger.ts
- 新增 trace-context.ts
- 新增 event-factory.ts
- 新增 inspector skeleton

### Phase 3：Debug bundle

- 实现 debug bundle writer
- 实现 debug bundle index
- 实现 failed round diagnosis

### Phase 4：全系统推广

- AI input gateway
- video download
- dom automation
- browser controller
- forensics persistence
- amazon invoice upload

---

## 12. 完成定义

完成后必须满足：

```txt
1. 任意 mission 有 run-level runtime-log.jsonl。
2. 任意 round 有阶段级日志。
3. 任意 failure 有 failureClass。
4. 任意 recovery 有 recoveryTrail。
5. 任意 AI call 有 request/response/parse/ref/hash。
6. 任意 browser action 有 before/action/after。
7. 任意 debug bundle 可生成 diagnosis。
8. FLOW/DEBUG/TRACE 能放能收。
9. CI 能阻断日志黑洞。
10. secret 不进入任何 sink。
```

## 13. Structured Logging And Privacy Ownership

`GRASSEYE-STRUCTURED-LOGGING-001-V1` 与 `GRASSEYE-SECURITY-PRIVACY-LOG-001-V1` 都归 `runtime-log-spine` 唯一 owner。结构化日志只能进入现役 Spine，隐私条款由同一 redaction/AST/acceptance 链阻断；不得新增 logger wrapper、兼容 sink 或第二日志法案链。
