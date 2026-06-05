# GrassEye Media Processing 媒体处理能力组施工图

status: active
version: 2026-06-05-v2
lawModule: `.github/instructions/agent-rules/modules/module-media-processing-capability.instructions.md`
capabilityDomain: `media-processing-capability`
canonicalRoot: `src/capabilities/media-processing/`

## 0. 施工定位

`media-processing` 是 GrassEye 的本地媒体处理能力组。

它的唯一使命是：

```txt
把已经存在于本地、并且经过用户授权或治理链路产生的媒体 artifact，
加工成适合网站图文展示和视频流播放的成品 artifact。
```

它不是下载器，不是浏览器自动化，不是网站发布器，不是 App Shell 技能本身，也不是业务工作流。

一句话边界：

```txt
video-download 负责“拿到视频 artifact”；
media-processing 负责“把本地媒体 artifact 加工成网站可用成品”；
App Shell skill 只是入口；
Job Flow 决定什么时候处理、处理哪个 artifact、结果交给谁。
```

## 1. 云仓现状对齐

当前云仓/AGENT 是 Node.js + TypeScript 的本地 HTTP Workbench 形态，已有 App Shell、技能注册、能力组、job flow、runtime logs、artifact/evidence 治理链路。

现有关键事实：

```txt
已存在能力组：
- dom-automation
- ai-input-gateway
- forensics-persistence
- video-download

已存在 App Shell skill registry：
- Amazon Product Mining
- Facebook Video Mining
- Deep Research Analysis
- Video Downloader
- Amazon Invoice Upload
- planned TikTok Product Mining

已存在 video-download 能力组：
- 负责下载单个视频 artifact
- 不负责压缩、转码、图片处理、网站展示优化
```

因此，本次建设不能把媒体处理塞入 `video-download`，也不能在 App Shell、route、plugin、script 里绕出第二条处理链。

正确路线：

```txt
active law
-> construction blueprint
-> capability-group governance admission
-> src/capabilities/media-processing/**
-> mediator/job flow/API route if UI requires
-> optional App Shell skill: Media Optimizer
-> inspector + acceptance
-> npm run ci:full PASS
```

## 2. 目标问题

网站素材处理有两个高频需求：

### 2.1 视频处理

目标：

```txt
让视频更适合网站流播放、首屏展示、商品页展示、移动端加载。
```

典型动作：

- 转为网站兼容 MP4；
- H.264/AAC 或无音频 profile；
- `faststart` / progressive download；
- 限制分辨率；
- 限制码率或目标体积；
- 压缩体积；
- 生成 poster/thumbnail；
- 输出 metadata：时长、宽高、码率、大小、sha256、压缩率、proofRef。

### 2.2 图片处理

目标：

```txt
让图片更适合网站图文展示、商品详情页、博客/内容页、移动端响应式加载。
```

典型动作：

- resize；
- format convert：WebP / AVIF / JPEG / PNG；
- quality 控制；
- 生成 responsive variants；
- 去除不必要 metadata；
- 限制尺寸和体积；
- 输出 metadata：宽高、格式、大小、sha256、压缩率、variant set。

## 3. 非目标

本能力组不建设：

```txt
- 视频下载
- 图片下载
- 网页探针
- 浏览器自动化
- AI 判断产品价值
- 自动发布到网站/CDN/CMS
- 自动生成 SEO 文案
- 商品详情页排版决策
- 批量业务流程编排
- 私有日志链
- 私有证据库
- 独立 ffmpeg 服务/daemon
- 绕过能力组的媒体脚本
```

## 4. 架构位置

标准链路：

```txt
App Shell / API Route / Job Flow
  -> validated request
  -> media-processing public facade
  -> ability-group registry
  -> selected child ability
  -> runtime adapter
  -> output artifact storage
  -> proof/log emission
  -> structured result
```

禁止链路：

```txt
App Shell UI -> ffmpeg/sharp 直接处理                 # 禁止
API Route -> private runtime 直接处理                # 禁止
Plugin -> children/** 直接 import                    # 禁止
scripts/media-processor.ts 独立跑                    # 禁止
video-download -> 顺手转码/压缩                       # 禁止
media-processing -> 下载远程视频/图片                 # 禁止
media-processing -> 发布到网站/CDN                    # 禁止
```

## 5. 目录结构

建议生产目录：

```txt
src/capabilities/media-processing/
  ├─ index.ts                                  # public facade, explicit exports only
  ├─ ability-group.ts                          # MediaProcessingAbilityGroup factory
  ├─ contract.ts                               # public interfaces + ports
  ├─ schema.ts                                 # zod schemas + public types
  ├─ registry.ts                               # child capability registry, private to group
  ├─ children/
  │  ├─ optimize-video-for-web-once.ts
  │  ├─ compress-video-for-web-once.ts
  │  ├─ generate-video-poster-once.ts
  │  ├─ optimize-image-for-web-once.ts
  │  ├─ resize-image-for-web-once.ts
  │  └─ generate-responsive-image-variants-once.ts
  ├─ runtime/
  │  ├─ ffmpeg-runner.ts                       # safe process adapter, no shell:true
  │  ├─ ffprobe-runner.ts                      # output/input video metadata validation
  │  ├─ image-runner.ts                        # image decode/encode adapter
  │  ├─ preset-resolver.ts                     # preset -> bounded runtime plan
  │  ├─ source-validation.ts                   # canonical path, artifact ref, MIME/decode probe
  │  ├─ output-validation.ts                   # validate real output before success
  │  ├─ artifact-storage.ts                    # governed output artifact write/import
  │  ├─ temp-workspace.ts                      # per-task temp dir + cleanup
  │  ├─ result.ts                              # success/failure builders
  │  ├─ filename.ts                            # safe names + collision-resistant suffix
  │  └─ progress-events.ts                     # approved runtime log event helpers
  └─ ports/
     ├─ media-artifact-storage-port.ts
     ├─ media-runtime-log-port.ts
     └─ media-processing-dependency-port.ts
```

可选 UI/job-flow 目录，只有在需要 App Shell 工作台时再建：

```txt
src/plugins/media-optimizer/                  # optional job flow owner, not ability group
src/app/workbench-media-processing-routes.ts  # optional API route wrapper
src/app/workbench-media-processing-client.ts  # optional client API helper
```

审计与验收目录：

```txt
scripts/audit/domains/media-processing-capability/
  ├─ manifest.json
  └─ inspector.ts

scripts/acceptance/media-processing-video.acceptance.ts
scripts/acceptance/media-processing-image.acceptance.ts
scripts/acceptance/media-processing-boundary.acceptance.ts
```

## 6. Public Facade 设计

`src/capabilities/media-processing/index.ts` 只能显式导出：

```ts
export type {
  MediaProcessingAbilityGroup,
  MediaProcessingExecutionContext,
  MediaProcessingResult,
  MediaProcessingPublicRequest,
  MediaProcessingChildCapabilityId,
} from "./contract.js";

export {
  MEDIA_PROCESSING_ABILITY_GROUP_ID,
  MediaProcessingPublicRequestSchema,
  MediaProcessingAbilityInputSchema,
  mediaProcessingPresetIds,
} from "./schema.js";

export {
  createMediaProcessingAbilityGroup,
  createMediaProcessingAbilityGroupFromFilesystem,
} from "./ability-group.js";

export {
  ensureMediaProcessingLatestDependenciesForUse,
  MEDIA_PROCESSING_LATEST_DEPENDENCY_PACKAGES,
  prepareMediaProcessingRuntimeDependencies,
} from "./runtime/runtime-dependencies.js";
```

禁止：

```ts
export * from "./runtime/...";
export * from "./children/...";
export * from "./registry.js";
```

消费者只能从 public facade 或 approved mediator/job-flow API 进入。

## 7. Ability Group Contract

建议核心接口：

```ts
type MediaProcessingAbilityGroupId = "media-processing";

interface MediaProcessingAbilityGroup {
  readonly abilityGroupId: MediaProcessingAbilityGroupId;
  listChildCapabilityIds(): MediaProcessingChildCapabilityId[];
  execute(input: MediaProcessingAbilityInput): Promise<MediaProcessingResult>;
  optimizeVideoForWeb(input: OptimizeVideoForWebPublicRequest): Promise<MediaProcessingResult>;
  compressVideoForWeb(input: CompressVideoForWebPublicRequest): Promise<MediaProcessingResult>;
  generateVideoPoster(input: GenerateVideoPosterPublicRequest): Promise<MediaProcessingResult>;
  optimizeImageForWeb(input: OptimizeImageForWebPublicRequest): Promise<MediaProcessingResult>;
  resizeImageForWeb(input: ResizeImageForWebPublicRequest): Promise<MediaProcessingResult>;
  generateResponsiveImageVariants(input: GenerateResponsiveImageVariantsPublicRequest): Promise<MediaProcessingResult>;
}
```

Execution context：

```ts
type MediaProcessingExecutionContext = {
  artifactStoragePort: MediaArtifactStoragePort;
  dependencyPort: MediaProcessingDependencyPort;
  runtimeLogger?: RuntimeLogger;
  dataDir: string;
};
```

注意：

```txt
- 不需要 browserMediaSourcePort；
- 不需要 AI port；
- 不需要 platform router；
- 不需要 video-download private imports；
- 只处理本地输入。
```

## 8. Child Capability Catalog

| childCapabilityId | 输入 | 输出 | 说明 |
|---|---|---|---|
| `optimize-video-for-web-once` | 1 个本地视频 artifact | 1 个网站流播放视频 artifact | 标准网站视频 profile，偏“成品可播放” |
| `compress-video-for-web-once` | 1 个本地视频 artifact | 1 个体积/码率受限视频 artifact | 偏“压体积”，仍必须网站兼容 |
| `generate-video-poster-once` | 1 个本地视频 artifact | 1 个 poster image artifact | 从合法时间点抽帧 |
| `optimize-image-for-web-once` | 1 个本地图片 artifact | 1 个优化图片 artifact | 格式/质量/metadata 优化 |
| `resize-image-for-web-once` | 1 个本地图片 artifact | 1 个尺寸受限图片 artifact | 不负责整套 responsive variants |
| `generate-responsive-image-variants-once` | 1 个本地图片 artifact | 1 个 deterministic variant set | 一个输入生成一组固定尺寸图 |

子能力原则：

```txt
一个 child = 一个原子媒体处理动作
一个 invocation = 一个 source media artifact
一个结果 = success / failed / review_required / invalid_input
```

## 9. 输入模型

### 9.1 通用 source 输入

```ts
type MediaProcessingSource =
  | {
      kind: "artifact_ref";
      artifactRef: string;
      expectedMediaKind: "video" | "image";
    }
  | {
      kind: "local_file";
      filePath: string;
      userAuthorizationRef: string;
      expectedMediaKind: "video" | "image";
    }
  | {
      kind: "staging_file";
      filePath: string;
      stagingRef: string;
      expectedMediaKind: "video" | "image";
    };
```

必须校验：

```txt
- filePath canonical path
- exists + readable
- not symlink escape
- within approved root or has userAuthorizationRef
- byte size <= maxInputBytes
- actual media probe/decode success
- actual media kind matches expectedMediaKind
```

### 9.2 Public Request 基础字段

```ts
type MediaProcessingPublicRequestBase = {
  missionId: string;
  runId: string;
  capabilityCallId?: string;
  source: MediaProcessingSource;
  presetId: MediaProcessingPresetId;
  maxInputBytes?: number;
  maxOutputBytes?: number;
  timeoutMs?: number;
  artifactDisposition?: "staging" | "final";
};
```

### 9.3 Ability Input 基础字段

```ts
type MediaProcessingAbilityInput = MediaProcessingPublicRequestBase & {
  abilityGroupId: "media-processing";
  childCapabilityId: MediaProcessingChildCapabilityId;
  capabilityCallId: string;
};
```

## 10. 视频 Preset 设计

第一阶段建议只保留少量生产可用 preset，不要泛滥。

```ts
type VideoWebPresetId =
  | "web-video-mp4-1080p"
  | "web-video-mp4-720p"
  | "web-video-mp4-480p"
  | "web-video-muted-loop-720p"
  | "web-video-size-target";
```

建议默认规则：

| presetId | container | codec | maxWidth | maxHeight | audio | 目标 |
|---|---|---|---:|---:|---|---|
| `web-video-mp4-1080p` | mp4 | h264 | 1920 | 1080 | aac/copy if valid | hero/详情页主视频 |
| `web-video-mp4-720p` | mp4 | h264 | 1280 | 720 | aac/copy if valid | 通用网站视频 |
| `web-video-mp4-480p` | mp4 | h264 | 854 | 480 | aac/copy if valid | 移动端轻量视频 |
| `web-video-muted-loop-720p` | mp4 | h264 | 1280 | 720 | removed | 首页循环展示 |
| `web-video-size-target` | mp4 | h264 | caller bounded | caller bounded | caller bounded | 目标体积压缩 |

所有 MP4 网站流播放输出必须：

```txt
- progressive / faststart 可验证；
- output duration > 0；
- width > 0；
- height > 0；
- video codec 可识别；
- byteSize <= maxOutputBytes；
- 不超过 preset max dimension；
- 生成 sha256；
- 写入 proofRef。
```

## 11. 图片 Preset 设计

```ts
type ImageWebPresetId =
  | "web-image-webp-1600"
  | "web-image-webp-1200"
  | "web-image-webp-800"
  | "web-image-thumbnail-480"
  | "web-image-original-format-compressed"
  | "web-image-responsive-default";
```

建议规则：

| presetId | format | maxWidth | maxHeight | quality | 目标 |
|---|---|---:|---:|---:|---|
| `web-image-webp-1600` | webp | 1600 | 1600 | 82 | 详情页大图 |
| `web-image-webp-1200` | webp | 1200 | 1200 | 82 | 内容页/商品图 |
| `web-image-webp-800` | webp | 800 | 800 | 80 | 图文展示 |
| `web-image-thumbnail-480` | webp | 480 | 480 | 78 | 缩略图 |
| `web-image-original-format-compressed` | source-compatible | source bounded | source bounded | bounded | 保格式压缩 |
| `web-image-responsive-default` | webp | variant set | variant set | bounded | 响应式图组 |

默认 responsive variants：

```txt
480w / 768w / 1024w / 1440w / 1920w
```

生成规则：

```txt
- 不放大原图；
- 只生成 <= source width 的 variants；
- 每个 variant 必须真实 decode 验证；
- 每个 variant 有独立 artifactRef、byteSize、sha256、width、height、contentType；
- variant set 必须有 stable variantSetId；
- 任一必需 variant 写入失败，则整个 child 返回 failed，不得部分成功冒充完整成功。
```

## 12. 视频输出合同

成功结果建议：

```ts
type MediaProcessingVideoSuccess = {
  status: "success";
  mediaKind: "video";
  abilityGroupId: "media-processing";
  childCapabilityId:
    | "optimize-video-for-web-once"
    | "compress-video-for-web-once";
  source: {
    kind: "artifact_ref" | "local_file" | "staging_file";
    sourceArtifactRef?: string;
    sourcePathHash?: string;
    byteSize: number;
    width: number | null;
    height: number | null;
    durationMs: number | null;
    contentType: string | null;
  };
  output: {
    artifactRef: string;
    storageRef: string;
    filePath: string;
    contentType: string;
    byteSize: number;
    sha256: string;
    container: string;
    videoCodec: string;
    audioCodec: string | null;
    width: number;
    height: number;
    durationMs: number;
    presetId: VideoWebPresetId;
    fastStart: boolean;
    compressionRatio: number | null;
  };
  proofRef: string;
  startedAt: string;
  completedAt: string;
};
```

## 13. 图片输出合同

```ts
type MediaProcessingImageSuccess = {
  status: "success";
  mediaKind: "image";
  abilityGroupId: "media-processing";
  childCapabilityId:
    | "optimize-image-for-web-once"
    | "resize-image-for-web-once"
    | "generate-video-poster-once";
  source: {
    kind: "artifact_ref" | "local_file" | "staging_file";
    sourceArtifactRef?: string;
    sourcePathHash?: string;
    byteSize: number;
    width: number | null;
    height: number | null;
    contentType: string | null;
  };
  output: {
    artifactRef: string;
    storageRef: string;
    filePath: string;
    contentType: string;
    byteSize: number;
    sha256: string;
    format: string;
    width: number;
    height: number;
    presetId: ImageWebPresetId;
    quality: number | null;
    compressionRatio: number | null;
  };
  proofRef: string;
  startedAt: string;
  completedAt: string;
};
```

## 14. Responsive Variant Set 输出合同

```ts
type ResponsiveImageVariantSetSuccess = {
  status: "success";
  mediaKind: "image";
  abilityGroupId: "media-processing";
  childCapabilityId: "generate-responsive-image-variants-once";
  variantSetId: string;
  source: {
    kind: "artifact_ref" | "local_file" | "staging_file";
    sourceArtifactRef?: string;
    sourcePathHash?: string;
    byteSize: number;
    width: number;
    height: number;
    contentType: string;
  };
  variants: Array<{
    widthLabel: "480w" | "768w" | "1024w" | "1440w" | "1920w";
    artifactRef: string;
    storageRef: string;
    filePath: string;
    contentType: string;
    byteSize: number;
    sha256: string;
    width: number;
    height: number;
    format: string;
  }>;
  proofRef: string;
  startedAt: string;
  completedAt: string;
};
```

## 15. 失败输出合同

```ts
type MediaProcessingFailure = {
  status: "failed" | "review_required" | "invalid_input";
  abilityGroupId: "media-processing";
  childCapabilityId: MediaProcessingChildCapabilityId;
  mediaKind: "video" | "image" | "unknown";
  errorCode:
    | "input_schema_invalid"
    | "source_not_authorized"
    | "source_file_missing"
    | "source_path_forbidden"
    | "source_symlink_forbidden"
    | "source_media_invalid"
    | "unsupported_media_format"
    | "runtime_dependency_missing"
    | "runtime_execution_failed"
    | "processing_timeout"
    | "output_validation_failed"
    | "output_size_exceeded"
    | "artifact_persistence_failed"
    | "proof_persistence_failed"
    | "temp_cleanup_failed";
  reason: string;
  sourceRef?: string;
  proofRef?: string;
  startedAt: string;
  completedAt: string;
};
```

失败原则：

```txt
- 不确定就 review_required；
- schema 错就 invalid_input；
- 运行时失败就 failed；
- artifact/proof 持久化失败，不得显示 success；
- 临时清理失败至少要有 warning log；若影响 artifact truth，则 failed。
```

## 16. Source Validation 图纸

`source-validation.ts` 必须做：

```txt
1. parse input schema
2. resolve source kind
3. canonicalize local path
4. deny path traversal
5. deny symlink escape
6. verify file exists/readable
7. verify byte size <= maxInputBytes
8. probe/decode actual media
9. verify actual media kind matches expectedMediaKind
10. produce SourceValidationResult
```

禁止：

```txt
- 只看扩展名
- 直接相信 contentType
- 处理远程 URL
- 读取未授权绝对路径
- 让 ffmpeg 直接打开用户输入字符串
```

## 17. Runtime Adapter 图纸

### 17.0 Latest Dependency Use Gate

生产目标：

```txt
每一次媒体处理 public use 进入 child ability 之前，
都先由 media-processing 自己确认图片/视频处理依赖是 npm latest。
```

治理包清单：

```txt
- sharp
- @img/sharp-darwin-arm64
- ffmpeg-static
- ffprobe-static
```

执行位置：

```txt
processMedia / execute
  -> ensureMediaProcessingLatestDependenciesForUse
  -> child.execute
```

要求：

```txt
- 使用 npm outdated --json 检查治理包
- 只对 outdated 包执行 npm install <package>@latest
- 使用 execFile/argv 数组模式，禁止 shell:true
- bounded timeout
- 并发调用必须共用同一个 refresh promise
- 返回 already_latest / updated / failed
- failed 必须在 child processing 之前返回 structured review_required/failed
- 不依赖某一种启动方式；startup --update 只能是额外 preflight，不能是本目标的唯一保证
```

禁止：

```txt
- 新增 standalone updater
- 新增第二 dependency truth
- 把 latest gate 放到 App Shell UI
- 把 latest gate 放到 video-download
- route/plugin 直接调用 npm 或 runtime runner
- latest gate 失败后继续调用 sharp/ffmpeg/ffprobe
```

### 17.1 ffmpeg-runner

要求：

```txt
- 使用 spawn/execFile 等 argv 数组模式
- 禁止 shell:true
- 所有参数来自 preset resolver
- 用户不能传 raw filter / raw args / raw shell
- timeout 可 abort 子进程
- stderr 分级归类：progress / warning / failure
- stdout/stderr 日志必须 redaction
- exit code 非 0 必须 failed
```

### 17.2 ffprobe-runner

要求：

```txt
- 输入 probe：确认源视频真实有效
- 输出 probe：确认输出视频真实有效
- duration / width / height / codec / container 必须来自 probe
- 不得回显请求值作为 selected result
```

### 17.3 image-runner

要求：

```txt
- decode 输入图片确认真实有效
- 限制最大像素数与最大输入体积
- 不放大原图，除非未来 law 显式允许
- 输出后重新 decode 验证 width / height / format
- 每个 variant 单独验证
```

## 18. Artifact Storage 图纸

建议输出目录：

```txt
<dataDir>/artifacts/media-processing/<runId>/<capabilityCallId>/
  source-proof.json
  output/
    <safe-name>.<ext>
    <safe-name>.poster.webp
    responsive/
      <safe-name>-480w.webp
      <safe-name>-768w.webp
      <safe-name>-1024w.webp
      <safe-name>-1440w.webp
      <safe-name>-1920w.webp
  proof/
    media-processing-proof.json
```

写入原则：

```txt
- 先写 temp；
- validate temp output；
- hash temp output；
- atomic promote/import；
- proof 持久化成功后才返回 success；
- delivery copy 是交付动作，失败必须可见；
- 不覆盖已有用户文件。
```

## 19. Runtime Logs 图纸

建议事件：

```txt
MEDIA_PROCESSING_REQUEST_ACCEPTED
MEDIA_PROCESSING_SOURCE_VALIDATION_STARTED
MEDIA_PROCESSING_SOURCE_VALIDATION_COMPLETED
MEDIA_PROCESSING_LATEST_DEPENDENCY_REFRESHED
MEDIA_PROCESSING_RUNTIME_DEPENDENCY_CHECKED
MEDIA_PROCESSING_PRESET_RESOLVED
MEDIA_PROCESSING_PROCESS_STARTED
MEDIA_PROCESSING_PROCESS_PROGRESS
MEDIA_PROCESSING_PROCESS_WARNING
MEDIA_PROCESSING_PROCESS_FAILED
MEDIA_PROCESSING_OUTPUT_VALIDATION_STARTED
MEDIA_PROCESSING_OUTPUT_VALIDATION_COMPLETED
MEDIA_PROCESSING_ARTIFACT_RECORDED
MEDIA_PROCESSING_PROOF_RECORDED
MEDIA_PROCESSING_COMPLETED
MEDIA_PROCESSING_FAILED
```

日志必须让操作者看到：

```txt
- childCapabilityId
- presetId
- input kind
- output format
- output dimensions
- output byteSize
- compression ratio
- artifactRef
- proofRef
- failure reason
```

不得记录：

```txt
- 未脱敏的敏感本地绝对路径
- secrets / tokens / cookies
- raw signed URLs
- 大段二进制内容
```

## 20. Job Flow / Mediator / App Shell 接入

第一阶段可以只建设能力组，不急着做 skill。

如果做 App Shell skill，建议 skill：

```txt
id: media-optimizer
label: Media Optimizer
category: content
route: /skills/media-optimizer
status: active only after job/route/ability are ready
```

UI 只负责：

```txt
- 选择文件/artifact
- 选择 preset
- 开始任务
- 查看 running/success/failed
- 查看 metadata/proofRef
- 下载/打开输出 artifact
```

UI 禁止：

```txt
- 直接 import ffmpeg/sharp/image runtime
- 直接 import children/runtime/registry
- 自己实现压缩/转码/resize
- 用 timer 冒充任务进度
```

长视频任务建议：

```txt
POST /api/media-processing/start-async
GET  /api/media-processing/status?taskId=...
GET  /api/media-processing/artifact?artifactRef=...
```

同步 route 可用于小图片、小文件，但 UI 默认不要用同步 route 跑长视频。

## 21. Concurrency / TTL / Async 规则

因为这是高频工具，必须有资源边界。

建议默认：

```txt
maxConcurrentVideoTasks: 1 or 2
maxConcurrentImageTasks: 3 or 4
videoTaskTimeoutMs: bounded, preset controlled
imageTaskTimeoutMs: bounded, preset controlled
taskSnapshotTTL: bounded
tempCleanupTTL: bounded
```

规则：

```txt
- 进程重启后未完成任务不得继续显示 running；
- 终态必须先原子持久化，再对外显示 success/failed；
- queue full 必须返回 structured failed/review_required，不得假装排队成功；
- abort 必须杀掉本地媒体处理进程；
- 清理失败必须进入 runtime warning/failure。
```

## 22. Inspector 设计

`scripts/audit/domains/media-processing-capability/inspector.ts` 最低检查：

```txt
[ ] src/capabilities/media-processing/index.ts exists
[ ] public facade does not use export *
[ ] approved child files exist only under children/**
[ ] private runtime not imported by src/app/**
[ ] private runtime not imported by src/plugins/**
[ ] private runtime not imported by src/mediator/**
[ ] media-processing does not import src/plugins/**
[ ] media-processing does not import src/capabilities/video-download/runtime/** or children/**
[ ] video-download does not import media-processing runtime/children
[ ] no media processing logic under video-download
[ ] no standalone scripts/media-processing*.ts runner
[ ] no local daemon/service named media processor outside ability group
[ ] no shell:true in ffmpeg runner
[ ] no raw user CLI args allowed
[ ] no remote URL input accepted by schema
[ ] source validation module exists
[ ] output validation module exists
[ ] artifact proof path exists
[ ] acceptance files exist
```

如果系统当前 audit domain 数量已有上限压力，实施时可以优先把 inspector 设计为小而硬的 P0 边界检查，不要堆复杂报告。

## 23. Acceptance 设计

### 23.1 Video acceptance

Fixtures：

```txt
- tiny-valid-video.mp4
- invalid-video-renamed.mp4
- oversized-video-placeholder fixture
```

测试：

```txt
[ ] optimize-video-for-web-once success
[ ] compress-video-for-web-once success
[ ] generate-video-poster-once success
[ ] invalid extension-only video fails
[ ] output over max bytes fails
[ ] timeout abort returns failed
[ ] ffprobe missing/dependency unavailable returns failed/review_required
[ ] proof persistence failure prevents success
```

### 23.2 Image acceptance

Fixtures：

```txt
- tiny-valid-image.png
- invalid-image-renamed.jpg
- large-dimension synthetic image fixture
```

测试：

```txt
[ ] optimize-image-for-web-once success
[ ] resize-image-for-web-once success
[ ] generate-responsive-image-variants-once success
[ ] invalid extension-only image fails
[ ] variant set does not upscale
[ ] output validation failure prevents success
[ ] proof persistence failure prevents success
```

### 23.3 Boundary acceptance

测试：

```txt
[ ] App Shell does not import media-processing runtime/children/registry
[ ] plugins do not import media-processing runtime/children/registry
[ ] mediator does not import media-processing runtime/children/registry
[ ] no media processing implementation inside video-download
[ ] no standalone media runner/service/script
[ ] public facade explicit exports only
[ ] raw remote URL input rejected
[ ] symlink escape rejected
[ ] path traversal rejected
```

## 24. Implementation Phases

### Phase 0 — Law Admission

```txt
- Add active law module
- Add construction blueprint
- Admit capability root in capability governance if required by current runner
- Do not edit generated artifacts manually
```

### Phase 1 — Core Ability Group

```txt
- schema.ts
- contract.ts
- index.ts
- ability-group.ts
- registry.ts
- source-validation.ts
- output-validation.ts
- artifact-storage.ts
- result.ts
```

### Phase 2 — Image Processing First

优先图片，因为高频、风险低、反馈快。

```txt
- optimize-image-for-web-once
- resize-image-for-web-once
- generate-responsive-image-variants-once
- image acceptance
```

### Phase 3 — Video Processing

```txt
- prepareMediaProcessingRuntimeDependencies
- ensureMediaProcessingLatestDependenciesForUse
- MEDIA_PROCESSING_LATEST_DEPENDENCY_PACKAGES
- ffmpeg-runner
- ffprobe-runner
- optimize-video-for-web-once
- compress-video-for-web-once
- generate-video-poster-once
- video acceptance
```

### Phase 4 — Optional App Shell Skill

```txt
- Media Optimizer skill registry entry
- route/client/job flow wrapper
- async status for video
- artifact display and download
```

### Phase 5 — Final Hardening

```txt
- inspector visible in audit runner
- boundary acceptance
- runtime logs operator-visible
- temp cleanup verified
- npm run ci:full PASS
```

## 25. 最小正确 MVP

如果要快速但不失控，MVP 只做：

```txt
Ability group:
- optimize-image-for-web-once
- resize-image-for-web-once
- optimize-video-for-web-once
- generate-video-poster-once

No batch.
No website upload.
No CDN.
No AI.
No App Shell skill until route/job path ready.
```

这已经能覆盖：

```txt
- 图片更适合网站图文展示
- 视频更适合网站流播放
- 视频封面生成
```

## 26. 生产红线总表

```txt
RED LINE 1: media-processing 不下载媒体
RED LINE 2: video-download 不处理媒体
RED LINE 3: App Shell 不拥有处理逻辑
RED LINE 4: route/mediator 不拥有处理逻辑
RED LINE 5: child ability 不做业务流程
RED LINE 6: 不创建第二 runner/service/script 链
RED LINE 7: 不接收远程 URL 输入
RED LINE 8: 不执行 raw user CLI args
RED LINE 9: 不用扩展名冒充媒体验证
RED LINE 10: artifact/proof 没落盘不得 success
RED LINE 11: generated artifacts 不手改
RED LINE 12: 没有 ci:full PASS 不宣称 production-stable
```

## 27. 最终验收命令

后续实施完成后，最终验收必须：

```bash
npm run ci:full
```

并且必须能证明：

```txt
- law recognized
- blueprint aligned
- media-processing inspector PASS
- acceptance PASS
- no second-chain risk
- video-download owner 未被污染
- App Shell skill 如存在，只是 UI/任务入口
- output artifact metadata 真实
- proof/log 可追溯
```

## 28. 最终原则

```txt
一个能力组，只管一种真实动作。
media-processing 只做本地媒体 artifact 加工。
它不下载、不发布、不判断、不编排。

下载归 video-download。
业务归 job flow。
入口归 App Shell。
证据归 forensics。
日志归 runtime log spine。

任何为了快而新建的媒体脚本、服务、runner、route 私有处理逻辑，
都会形成 second-chain risk，必须阻断。
```
