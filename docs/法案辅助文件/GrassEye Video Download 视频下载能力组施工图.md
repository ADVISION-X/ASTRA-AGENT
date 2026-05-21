# GrassEye Video Download 视频下载能力组施工图

status: active
version: 2026-05-21-v2

## 0. 定位

Video Download 是 GrassEye 能力组之一，解决"能看到的所有网页视频，都能下载"的核心问题。

它解决的问题是：

```txt
截图只捕捉画面片段；
下载完整视频 artifact 后再交给 AI 分析，证据更完整、更稳定。
```

架构原则：

```txt
一个子能力 = 下载一个视频 artifact
平台专属提取器 + 通用兜底提取器 = 全网覆盖
路由选择 = 由调用方（job flow）负责
证据 = 每次尝试都有 proof
```

它不是 DOM 自动化的子能力，不是 Product Video DOM Runtime 的私有脚本，也不是 AI 判断能力。

一句话：

```txt
Video Download 只把当前目标视频下载成受治理的本地媒体 artifact；
AI 和产品分析链路再基于 artifact 判断价值。
```

## 1. 当前能力组位置

当前能力组白名单位置：

```txt
src/capabilities/video-download/
```

## 2. Phase 1 建设边界

Phase 1 建设内容：

- `download-web-video-once`：通用子能力，适配任意网页视频提取；
- 命名平台子能力：Facebook、TikTok、Instagram、Bilibili、Douyin、X/Twitter、小红书；
- 平台路由器：`platform-router.ts`，纯 URL → childCapabilityId 映射；
- 证据系统：每次下载尝试都有 Forensics 兼容的 proof；
- 诚实失败：DRM、登录墙、私密视频、不支持格式 → `review_required` 或 `failed`。

Phase 1 不建设：

- 产品价值判断；
- AI 规划动作；
- 去水印第三方 API；
- 批量下载编排流程（属于 job flow 职责）。

## 3. 目录结构

```txt
src/capabilities/video-download/
  ├─ index.ts                          # 公共 facade，explicit exports only
  ├─ ability-group.ts                  # VideoDownloadAbilityGroup 实现
  ├─ contract.ts                       # 接口类型定义
  ├─ schema.ts                         # zod schemas + type exports
  ├─ registry.ts                       # 子能力注册表
  ├─ children/
  │  ├─ download-web-video-once.ts     # 通用子能力（核心）
  │  ├─ download-facebook-video-once.ts
  │  ├─ download-tiktok-video-once.ts
  │  ├─ download-instagram-video-once.ts
  │  ├─ download-bilibili-video-once.ts
  │  ├─ download-douyin-video-once.ts
  │  ├─ download-x-video-once.ts
  │  └─ download-xiaohongshu-video-once.ts
  ├─ runtime/
  │  ├─ universal-page-probe-script.ts # 通用浏览器探针脚本（字符串）
  │  ├─ universal-candidates.ts        # 解析/排序通用探针结果
  │  ├─ platform-router.ts             # URL → childCapabilityId 路由
  │  ├─ candidate-validation.ts        # MIME/size/byte-range 验证
  │  ├─ media-download.ts              # HTTP 下载执行
  │  ├─ artifact-storage.ts            # 本地 artifact 写入
  │  ├─ facebook-page-probe-script.ts  # Facebook 专属探针
  │  ├─ facebook-candidates.ts         # Facebook 候选解析
  │  ├─ tiktok-page-probe-script.ts    # TikTok/Douyin 专属探针
  │  ├─ tiktok-candidates.ts           # TikTok/Douyin 候选解析
  │  └─ result.ts                      # 结果构建工具
  └─ ports/
     ├─ browser-media-source-port.ts   # 浏览器媒体执行接口
     └─ video-artifact-storage-port.ts # artifact 存储接口
```

## 4. 子能力清单

| childCapabilityId | 平台 | 提取策略 |
|---|---|---|
| `download-web-video-once` | 任意网页 | 通用探针（video元素/performance/script/HLS/DASH） |
| `download-facebook-video-once` | facebook.com, fb.watch | Relay data / native MP4 |
| `download-tiktok-video-once` | tiktok.com | `__NEXT_DATA__` / SIGI_STATE |
| `download-instagram-video-once` | instagram.com | shared data / video element |
| `download-bilibili-video-once` | bilibili.com, b23.tv | 页面数据 / video element |
| `download-douyin-video-once` | douyin.com, iesdouyin.com | 同 TikTok 引擎 |
| `download-x-video-once` | x.com, twitter.com | `__NEXT_DATA__` / video CDN |
| `download-xiaohongshu-video-once` | xiaohongshu.com, xhslink.com | 页面数据 / video element |

每个子能力规则：
- 每次调用最多下载一个视频 artifact；
- 有明确 input schema、禁止输入、输出证据、失败策略、平台宿主白名单；
- 不确定或被阻断 → `review_required`（不得假成功）；
- 平台专属解析器存放在 `runtime/` 子目录下。

## 5. 子能力输入设计

### 5.1 通用子能力输入

```ts
type DownloadWebVideoInput = {
  abilityGroupId: "video-download";
  childCapabilityId: "download-web-video-once";
  missionId: string;
  runId: string;
  capabilityCallId: string;
  sourcePageUrl: string;
  preferredQuality?: "hd" | "sd" | "best_available"; // default: best_available
  maxBytes?: number;   // default: 200_000_000 (200MB)
  timeoutMs?: number;  // default: 60_000 (60s)
};
```

### 5.2 命名平台输入（通用结构）

```ts
type DownloadPlatformVideoInput = {
  abilityGroupId: "video-download";
  childCapabilityId: VideoDownloadChildCapabilityId; // 排除 download-web-video-once
  missionId: string;
  runId: string;
  capabilityCallId: string;
  sourcePageUrl: string;          // 必须匹配平台宿主白名单
  preferredQuality?: "hd" | "sd" | "best_available";
  maxBytes?: number;
  timeoutMs?: number;
};
```

输入建议：

```ts
type DownloadTikTokVideoInput = {
  platformId: "tiktok-web";
  sourcePageUrl: string;
  pageSnapshotRef?: string;
  currentBrowserPageRef?: string;
  preferredQuality?: "best_available";
  missionId: string;
  runId: string;
};
```

允许候选来源：

- 当前授权页面中已经可播放的 `video` element source；
- 页面脚本状态中已暴露的 media candidates；
- performance media resources；
- 已通过页面授权可访问的 media response。

禁止：

- 外部 TikTok downloader 网站；
- 去水印第三方接口；
- 风控/CAPTCHA/登录绕过；
- DRM 或私密视频绕过；
- 下载失败时假成功。

## 6. 输出合同

### 6.1 成功输出

```ts
type VideoDownloadSuccess = {
  status: "success";
  platformId: VideoDownloadPlatformId; // 从 URL 推导，或 "universal-web"
  sourcePageUrl: string;
  videoId: string | null;
  artifactRef: string;
  storageRef: string;
  filePath: string;
  contentType: string;
  byteSize: number;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  selectedQuality: "hd" | "sd" | "best_available" | "unknown";
  candidateKind: VideoDownloadCandidateKind;
  downloadedAt: string;
  proofRef: string;
};
```

### 6.2 失败/人工复核输出

```ts
type VideoDownloadFailure = {
  status: "failed" | "review_required" | "invalid_input";
  platformId: VideoDownloadPlatformId;
  sourcePageUrl: string;
  errorCode: VideoDownloadFailureReason;
  reason: string;
  proofRef: string;
};
```

### 6.3 platformId 枚举

```ts
type VideoDownloadPlatformId =
  | "universal-web"
  | "facebook-web"
  | "tiktok-web"
  | "instagram-web"
  | "bilibili-web"
  | "douyin-web"
  | "x-web"
  | "xiaohongshu-web";
```

### 6.4 candidateKind 枚举（新增 hls_manifest, source_element）

```ts
type VideoDownloadCandidateKind =
  | "native_hd"
  | "native_sd"
  | "video_element"
  | "source_element"
  | "media_resource"
  | "hls_manifest"
  | "dash_manifest";
```

### 6.5 候选排序优先级

```txt
native_hd > video_element(currentSrc) > media_resource(performance) > hls_manifest > dash_manifest > source_element > native_sd
```

## 7. 通用探针图纸（universal-page-probe-script.ts）

通用探针在授权的活动 tab 中执行，探测步骤：

```txt
Step 1: <video> 元素扫描
  - querySelectorAll('video')
  - 收集 currentSrc（优先）、src、<source> 子元素 src

Step 2: performance.getEntriesByType('resource') 扫描
  - 过滤条件：MIME type 含 video/ 或 URL 含 .mp4/.webm/.m3u8/.mpd/.ts/.m4v
  - initiatorType 为 'video' 或 'media' 的额外权重

Step 3: <script> 内联文本扫描（限前 200KB）
  - 匹配 HLS/M3U8：.m3u8 模式
  - 匹配 DASH/MPD：.mpd 模式
  - 匹配直接 MP4/WebM URL

Step 4: 候选去重 + 排序
  - 按 candidateKind 优先级排序
  - 相同 kind 按 URL 唯一性去重
```

## 8. 平台路由图纸（platform-router.ts）

纯 URL → `VideoDownloadChildCapabilityId` 映射，不执行任何 DOM 操作：

| 宿主匹配 | 路由到 |
|---|---|
| `facebook.com`, `fb.watch` | `download-facebook-video-once` |
| `tiktok.com` | `download-tiktok-video-once` |
| `instagram.com` | `download-instagram-video-once` |
| `bilibili.com`, `b23.tv` | `download-bilibili-video-once` |
| `douyin.com`, `iesdouyin.com` | `download-douyin-video-once` |
| `x.com`, `twitter.com` | `download-x-video-once` |
| `xiaohongshu.com`, `xhslink.com` | `download-xiaohongshu-video-once` |
| 其他 | `download-web-video-once` |

## 9. 质检建设

Phase 1 inspector 必须覆盖：

```txt
scripts/audit/domains/video-download-capability/
  ├─ manifest.json    (8 条 law IDs)
  └─ inspector.ts
```

inspector 阻断条件：
- 法案文件缺失或少于 8 条 active law；
- `src/capabilities/video-download/children/` 少于 8 个子文件；
- `platform-router.ts` 不存在；
- `universal-page-probe-script.ts` 不存在；
- `schema.ts` 中 `platformId` 仍是 `z.literal("facebook-web")` 硬编码；
- 代码中出现 cookie/session/token/DRM/CAPTCHA bypass 正向实现；
- 代码中出现第三方下载站调用；
- 截图/封面图冒充视频下载成功。

## 10. 验收定义

Phase 1 完成标准：

- 法案文件存在并含 8 条 active law；
- 施工图存在并明确 Phase 1 结构；
- CI-FULL 能看到 video-download owner step；
- `download-web-video-once` 在真实网页中能找到视频候选；
- Facebook Reel 可下载真实 MP4 artifact；
- platform-router 能正确路由 8 个平台 URL；
- 没有截图冒充完整视频；
- 没有 cookie/session/token/DRM/CAPTCHA 绕过。
