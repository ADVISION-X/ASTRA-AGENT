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
- 命名平台子能力：Facebook、TikTok、Instagram、Bilibili、Douyin、X/Twitter、小红书、YouTube、Telegram Web；
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
  │  ├─ download-xiaohongshu-video-once.ts
  │  ├─ download-youtube-video-once.ts
  │  └─ download-telegram-web-video-once.ts
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
  │  ├─ telegram-web-cache-probe-script.ts # Telegram Web CacheStorage 分片探针
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
| `download-youtube-video-once` | youtube.com, youtu.be, youtube-nocookie.com | 本地 yt-dlp runtime，受治理 artifact + subtitle proof |
| `download-telegram-web-video-once` | web.telegram.org | Service Worker / CacheStorage 完整分片拼接，受治理 artifact proof |

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
  | "xiaohongshu-web"
  | "youtube-web"
  | "telegram-web";
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
  | "dash_manifest"
  | "telegram_sw_progressive_cache"
  | "telegram_sw_download_stream";
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
| `youtube.com`, `youtu.be`, `youtube-nocookie.com` | `download-youtube-video-once` |
| `web.telegram.org` | `download-telegram-web-video-once` |
| 其他 | `download-web-video-once` |

## YouTube 清晰度与字幕验收

YouTube 子能力只允许作为 `src/capabilities/video-download/**` 内的受治理子能力存在。

必须支持的清晰度输入：

```txt
2160p / 1440p / 1080p / 720p / 480p / 360p / hd / sd / best_available
```

验收要求：

- 每个清晰度必须进入 bounded format selector，不得超过请求高度。
- App API `/api/video-download/start` 必须把 `preferredQuality` 和 `downloadSubtitles` 交给 mediator route，再进入 `video-download-artifact` job flow，由 job flow 调用 public facade。
- `downloadSubtitles=true` 必须向本地 yt-dlp runtime 请求字幕，并把 `.vtt` 或 `.srt` 写入治理 artifact path。
- success result 与 runtime proof 必须包含 `selectedQuality`、视频 artifact、`subtitleArtifacts`。
- 平台没有提供字幕时，不得伪造字幕 artifact；下载视频仍可按真实结果成功。
- YouTube 下载不得读取或导出 cookie、localStorage、sessionStorage、token。
- YouTube 下载不得使用第三方 downloader 网站、去水印 API、隐藏付费 API 或第二 downloader owner。
- App route 不得直接调用 `getVideoDownloadAbilityGroup().execute`；直调能力组是绕过 job flow 的违法捷径。

## Telegram Web 内部下载链路取证与实现边界

本节记录 Telegram Web 视频下载子能力的实证发现与 active 实现边界。`download-telegram-web-video-once` 只能在 `src/capabilities/video-download/**` 内实现。

当前取证结论：

```txt
YES: DOM / Service Worker / CacheStorage 能识别 Telegram Web 内部媒体链路。
NO: 裸 progressive URL 不能作为可下载媒体 URL；curl/fetch/XHR 会得到 302 或 HTML。
YES: 已缓存分片可程序化拼接成真实 MP4，并通过 ffprobe 验证。
```

已验证样例事实：

- Telegram Web 页面可暴露形如 `/a/progressive/document...` 的 media-like URL。
- 外部 `curl`、普通页面 `fetch`、普通 XHR 请求该 URL 时，返回的是 `302` / `text/html` / Telegram Web HTML，不是视频媒体字节。
- Telegram Web Service Worker 接管 `/progressive/` 和 `/download/` 路径，并通过 `requestPart` / `partResponse` 与页面客户端交换 MTProto 下载分片。
- Service Worker 使用 `tt-media-progressive` CacheStorage 缓存部分 progressive 分片；小视频在缓存分片完整时可以拼接为 MP4 artifact。
- 已拼接验证的样例 artifact：`video/mp4`，`1965028` bytes，约 `35.8s`，`480x360`，H.264 + AAC。

子能力名称：

```txt
download-telegram-web-video-once
```

platformId：

```txt
telegram-web
```

宿主白名单：

```txt
web.telegram.org
```

输入仍必须沿用命名平台输入结构：

```ts
type DownloadTelegramWebVideoInput = {
  abilityGroupId: "video-download";
  childCapabilityId: "download-telegram-web-video-once";
  missionId: string;
  runId: string;
  capabilityCallId: string;
  sourcePageUrl: string;          // 必须是 web.telegram.org 下的当前授权页面
  currentBrowserPageRef: string;  // 必须来自用户已登录、已授权的本地浏览器会话
  telegramDocumentIdHash?: string; // 来自可见视频清单探针的 document id hash；用于绑定目标视频
  preferredQuality?: "best_available";
  maxBytes?: number;
  timeoutMs?: number;
};
```

允许的取证/下载来源：

- 当前授权 Telegram Web 页面中已经可见、可播放、或已由用户会话加载过的视频消息。
- Service Worker 注册信息、Service Worker script 中公开可读的 `/progressive/` / `/download/` 处理逻辑。
- 当前 origin 下 CacheStorage 中已有的 `tt-media-progressive` 分片。
- 由当前页面真实 Service Worker 和客户端内部链路产生的媒体 bytes。

禁止的来源：

- UI 下载按钮作为成功依据；该按钮稳定性不足，只能作为人工动作，不作为程序能力核心链路。
- 把 `video.currentSrc`、`performance` 里的 `/progressive/document...` 或页面 DOM 里的 media-like URL 当作 direct media URL。
- 用裸 `curl`、普通 `fetch`、普通 XHR 的 HTML/302 响应冒充下载成功。
- 读取、导出、打印、持久化 cookie、localStorage、sessionStorage、IndexedDB auth key、MTProto session、token 或账号凭据。
- 构造第三方 downloader、代理下载站、隐藏 API、登录绕过、验证码绕过或私密群权限绕过。
- 伪造 Service Worker `requestPart` 消息并把未被真实页面链路响应的结果当作成功。
- 把 poster、thumbnail、HTML、JSON、错误页、空文件、部分分片冒充完整视频 artifact。
- 将 raw progressive URL、带敏感查询参数的 URL、群组名称、消息正文或账号身份写入 durable proof。

实现路线：

```txt
Step 1: 页面与链路识别
  - 仅接受 web.telegram.org 当前授权页面。
  - 识别目标视频消息、document id、progressive/download path、SW controller 状态。
  - APP 自动检测必须先返回可见视频清单：`documentIdHash`、duration、dimensions、redacted path prefix、cache coverage；不得只填 URL 后直接下载第一个缓存命中。
  - 下载请求若携带 `telegramDocumentIdHash`，CacheStorage 拼接只能选择该 hash 对应 document；hash 不在当前授权页可见媒体列表中时返回 `review_required`。
  - Workbench 页面必须显示下载动态进度区；至少在生产请求进行中显示明确 running 状态，不得让用户以为页面卡死。
  - 页面不得再写死 500MB 上限；大文件边界由生产 schema 的受治理 `maxBytes` 控制。当前法案禁止 unbounded download size，因此实现采用 5GB 上限而不是无限制。
  - 若页面未登录、消息不可见、视频未加载、SW 未接管，返回 review_required。

Step 2: CacheStorage 证据探测
  - 下载探针识别目标 document id 时，必须合并当前可见 video src、performance resource、CacheStorage keys 三个授权页面内来源；不得只依赖 performance 条目。
  - CacheStorage keys 只能作为受限补充来源；Telegram 大缓存可能抛出 `Operation too large`，不得让全量 key 枚举失败覆盖 visible video / performance 证据。
  - 读取 `tt-media-progressive` 中与目标 document 对应的分片 metadata。
  - 只记录 redacted path、range、content-type、content-range、byte length。
  - 若所有分片覆盖完整 `fullSize`，可拼接 artifact 并进入验证。

Step 3: 完整分片拼接
  - 只在 CacheStorage 分片完整、range 连续、fullSize 匹配时拼接 artifact。
  - 对超过缓存覆盖范围的视频，当前 active 实现返回 review_required，不退化为裸 HTTP direct URL 下载。

Step 4: 媒体验证
  - 逐字节拼接后必须验证 container、MIME、duration、width、height、byteSize。
  - `status: "success"` 只能在完整 artifact 通过验证后返回。
  - 分片缺失、range 不连续、content-type 非视频、container 无法解析时返回 `failed` 或 `review_required`。

Step 5: 证据落库
  - proof 只记录 redacted sourcePageUrl、platformId、document hash/id hash、range coverage、contentType、byteSize、duration/dimensions、candidateKind。
  - 媒体只能写入受治理 artifact path。
```

`candidateKind`：

```txt
telegram_sw_progressive_cache
telegram_sw_download_stream
```

Telegram Web 验收口径：

- 至少一个小视频通过 CacheStorage 完整分片拼接成功，并用媒体探针证明是完整 MP4，不是缓存碎片集合。
- 至少一个大于 Service Worker 早期缓存范围的视频完成内部链路评估；如果无法合法取得完整分片，必须如实返回 `review_required`，不得退回 UI 点击或 direct URL。
- APP 接入必须通过 Video Download 输入面提交 `download-telegram-web-video-once`，经 `/api/video-download/start` -> mediator -> `video-download-artifact` job flow -> video-download public facade；APP 不得直调 child/runtime。
- 从 APP 发起时，video-download 浏览器端口必须按 `sourcePageUrl` 定位已授权 Telegram Web 标签页执行探针，不能误在 Workbench 页面上探测。
- `/api/video-download/source-page?platform=telegram-web` 必须返回 `videoCandidates` 清单；清单只允许 durable-safe 字段：document hash、duration、width、height、readyState、viewport rect、cache completeness、cached byte size，不得返回 raw progressive URL、消息正文、群组名、账号身份或 credential。
- UI 必须要求用户从 `videoCandidates` 选择目标，随后把 `telegramDocumentIdHash` 交给 job flow；没有清单或 hash 未绑定时不得把“可下载”呈现为确定成功。
- UI 必须有进度条/进度状态。若生产链路无法取得 byte-level progress，只能显示真实 running/review/success 状态，不得伪造百分比。
- 成功输出必须包含 artifactRef、platformId=`telegram-web`、byteSize、durationMs、width、height、candidateKind、range coverage proof。
- 失败输出必须说明阻断点：未登录、页面不可见、SW 未接管、缓存不完整、内部 chunk 链路不可用、超时、超限、验证失败。
- 验收不得依赖群组名称、账号身份、消息正文或任何 secret。

Telegram Web 实现阻断条件：

- `video-download-capability` inspector 未把 Telegram child、platformId、candidateKind 和禁用面纳入检查。
- inspector 未用 AST 级检查 `telegramDocumentIdHash` 从 app route -> mediator/job schema -> job flow -> child input schema 的传递，或未检查 source page detection 返回 `videoCandidates`。
- 没有媒体 container 验证。
- 只能通过 UI 下载按钮成功。
- 没有可见视频清单，仅下载 CacheStorage 中第一个完整分片。
- 页面保留 500MB 固定上限，导致 1GB+ Telegram 视频无法进入合法尝试。
- 页面无进度条或无 running 状态，导致长下载看起来卡死。
- 只能通过 CacheStorage 早期缓存成功，却把大文件未覆盖分片冒充完整 artifact。
- 复活已实测失败的 XHR/fetch progressive 分片流；2026-05-23 生产实测 `/a/progressive/document...` XHR/Fetch 即使设置 Range 仍返回 302/opaqueredirect，必须视为 invalid path，除非未来重新取证证明 Telegram Web active law 允许且生产实测成功。
- 任何实现读取或记录 cookie/session/storage/token。

## 9. 质检建设

Phase 1 inspector 必须覆盖：

```txt
scripts/audit/domains/video-download-capability/
  ├─ manifest.json    (10 条 law IDs)
  └─ inspector.ts
```

inspector 阻断条件：
- 法案文件缺失或少于 10 条 active law；
- `src/capabilities/video-download/children/` 少于 10 个子文件；
- `platform-router.ts` 不存在；
- `universal-page-probe-script.ts` 不存在；
- `schema.ts` 中 `platformId` 仍是 `z.literal("facebook-web")` 硬编码；
- Telegram Web child、platformId、candidateKind、platform-router 或 CacheStorage 探针缺失；
- Telegram Web visible media list 探针缺失、`videoCandidates` 输出缺失、或 `telegramDocumentIdHash` 目标绑定链路缺失；
- Telegram Web 下载探针只从 `performance` resource 识别 selected document，未合并可见 video src 与 CacheStorage keys，导致清单 hash 到下载 hash 断链；
- Telegram Web 下载探针无条件枚举大型 `tt-media-progressive` cache keys，导致 `Operation too large` 直接变成 `network_failed`；
- Workbench 缺少下载进度 UI，或 Telegram 默认上限退回 500MB；
- 代码复活 `telegram-web-download-stream-probe`、裸 progressive XHR/fetch 分片下载，或把 HTTP 302/HTML 当作成功；
- 代码中出现 cookie/session/token/DRM/CAPTCHA bypass 正向实现；
- 代码中出现第三方下载站调用；
- 截图/封面图冒充视频下载成功。

## 10. 验收定义

Phase 1 完成标准：

- 法案文件存在并含 10 条 active law；
- 施工图存在并明确 Phase 1 结构；
- CI-FULL 能看到 video-download owner step；
- `download-web-video-once` 在真实网页中能找到视频候选；
- Facebook Reel 可下载真实 MP4 artifact；
- platform-router 能正确路由 10 个平台 URL；
- Telegram Web 已授权页面缓存完整分片可拼接出真实 MP4 artifact；缓存不完整时返回 `review_required`；
- 没有截图冒充完整视频；
- 没有 cookie/session/token/DRM/CAPTCHA 绕过。

## 13. 验收标准

最终交付必须同时满足：

- `npm run ci:full` 通过 `codex:entry-gate`、audit build、generated plan、typecheck 和现役 acceptance。
- `video-download-capability` owner report 为 `PASS`，并进入 generated registry / matrix / plan。
- YouTube API 实测至少覆盖两个不同 `preferredQuality` 请求，且必须经过 mediator + `video-download-artifact` job flow，并证明输出 `selectedQuality`、文件路径、字节数、sha256。
- 字幕实测必须用 `downloadSubtitles=true` 请求，平台提供字幕时必须产生 `subtitleArtifacts`；平台未提供字幕时必须在交付中如实说明，不得伪造。
- Telegram Web 实测必须证明 `web.telegram.org` 路由、CacheStorage 完整分片拼接成功路径、缓存不完整 `review_required` 路径、以及不读取 credential/storage/token 的红线。
- Telegram Web 实测必须证明目标页先识别出可见视频清单，选择某个 `documentIdHash` 后只下载该目标；不得以“第一个完整缓存命中”冒充用户选择。
- Telegram Web 大文件实测：若 CacheStorage 不完整且内部 chunk 链路不可用，必须返回 `review_required` 并显示进度/失败状态；不得卡死、不得假成功。2026-05-23 对 1.408GB 候选生产实测返回 `review_required: Telegram stream chunk returned HTTP 302`，因此 XHR/Range stream 路径不得作为生产成功依据。
- 不允许通过手工编辑 generated artifacts、第二 downloader、第三方 downloader 网站、cookie/session/token 导出完成验收。
