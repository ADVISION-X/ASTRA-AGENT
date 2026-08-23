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
  sourceTitle: string | null;
  displayTitle: string | null;
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
- `downloadSubtitles=true` 必须向本地 yt-dlp runtime 请求字幕，并把 `.vtt` 或 `.srt` 写入治理 artifact path。
- success result 与 runtime proof 必须包含 `selectedQuality`、视频 artifact、`subtitleArtifacts`。
- YouTube success result 与 runtime proof 必须包含 `sourceTitle` 和 `displayTitle`；`sourceTitle` 来自 yt-dlp metadata 的平台标题，`displayTitle` 只能为文件系统安全、长度边界和碰撞后缀做最小清洗。
- 平台没有提供字幕时，不得伪造字幕 artifact；下载视频仍可按真实结果成功。
- YouTube 下载不得读取或导出 cookie、localStorage、sessionStorage、token。
- YouTube 下载不得使用第三方 downloader 网站、去水印 API、隐藏付费 API 或第二 downloader owner。

YouTube 依赖更新规则：

- Workbench 启动时必须调用 `prepareVideoDownloadRuntimeDependencies()`。
- 默认必须执行 `resolveYtDlpBinaryPath({ refresh: process.env.GRASSEYE_YT_DLP_AUTO_UPDATE !== "0" })`，即每次启动刷新 managed local `yt-dlp`。
- 默认刷新必须优先于 PATH 中的系统 `yt-dlp`，避免系统旧版抢先命中导致 YouTube 下载失败。
- managed binary 存放在用户本机 cache：`~/.cache/grasseye/video-download/yt-dlp`；如当前 yt-dlp zipapp 需要 Python，必须生成 `yt-dlp-runner` 并使用 Python 3.10+。
- `GRASSEYE_YT_DLP_BINARY` 是显式人工 override；设置后由操作者负责该 binary 的版本治理。
- `GRASSEYE_YT_DLP_AUTO_UPDATE=0` 只允许用于离线/调试场景；生产默认不得关闭。
- 下载执行阶段不得再次刷新依赖；刷新属于启动 dependency gate，下载阶段只能使用启动时已解析并保存的 managed runtime binary，避免每次点击下载都被依赖网络阻塞。
- 非人工 override 的生产路径不得退回 PATH 中的系统 `yt-dlp`；`GRASSEYE_YT_DLP_BINARY` 是唯一允许的人为 runtime override。

YouTube 生产级下载规则：

- YouTube 视频 artifact 必须以文件路径导入 artifact storage，不得把完整视频 `readFile()` 成内存 `Uint8Array` 后再写入。
- YouTube 字幕 artifact 也必须以字幕文件路径导入或流式写入 artifact storage，不得为了省事把字幕文件 `readFile()` 成 bytes 后再作为质检绕过。
- yt-dlp 执行必须包含下载中 `--max-filesize` gate；下载完成后的 `byteSize > maxBytes` 只能作为二次防线。
- `timeoutMs` 必须是总任务超时；到期必须 abort 正在运行的 yt-dlp 进程，不能只设置 socket timeout。
- 成功必须经过真实媒体探针验证：至少证明存在 video stream、duration > 0、width、height；仅凭扩展名、`ftyp` 或 magic bytes 不足以宣告成功。
- Workbench 启动 dependency gate 必须同时验证 managed `yt-dlp` 和 `ffprobe`。缺少 `ffprobe` 不能等到下载完成后伪装成媒体无效。
- `selectedQuality` 必须来自已验证媒体高度，不得简单回显 `hd`、`sd`、`best_available` 或请求值。
- `downloadSubtitles=true` 时必须读取 yt-dlp metadata 中的字幕可得性；平台报告请求语言字幕存在但无 subtitle artifact 时必须失败。
- artifact storage 必须支持 `importVideoArtifactFromFile`，并用 stream/hash 计算 sha256，避免 1GB+ 文件内存爆炸。
- 启动刷新 `yt-dlp` 若网络失败，但 managed local binary 已验证可执行，可继续启动并使用该 managed binary；不得退回第三方 downloader 或 cookie/session 绕过。

YouTube 生产验收真实性追加规则：

- YouTube artifact id 必须用 collision-resistant id，不得只用 `Date.now()`。
- YouTube metadata probe 必须读取 `title`；成功结果不能缺 `sourceTitle` / `displayTitle`。
- 字幕可得性判断必须支持语言变体：请求 `en` 时，平台 `en-US` / `en-GB` 视为可得；请求 `zh` 时，平台 `zh-Hans` / `zh-Hant` 视为可得。平台报告可得但未落 artifact 时必须失败。
- `selectedQuality` 必须同时满足两个条件：来自 ffprobe height，且不得超过请求质量上限；超限时必须失败。
- Source-page JavaScript 安全守门不得依赖 regex/text blacklist；只能执行 video-download owner 提供的 allowlisted probe script，或使用结构化 allowlist token。
- YouTube production acceptance 不得只看 marker 字符串；必须包含可执行 fixture，覆盖字幕语言变体、质量上限和 artifact id 防碰撞。

YouTube 真实交付防复发规则：

- 字幕可得性必须先做语言变体匹配，再判断是否缺 artifact。请求 `en` 时，`en-US` / `en-GB` 是可得字幕；请求 `zh` 时，`zh-Hans` / `zh-Hant` 是可得字幕。
- metadata probe 和 media download 必须走同一个 prepared managed `yt-dlp` binary 与同一个 abortable process runner；不得让 metadata probe 留在另一条不可杀的执行链里。
- `tmpdir()/grasseye-youtube-*` 必须在 yt-dlp 异常和 post-download validation failure 两类失败中都清理；成功路径由 artifact import 后的 child finally 清理。
- 初始 async snapshot 写入失败时，HTTP 必须返回可观察 failed task body，内存状态也必须是 failed；不得留下 running。
- Artifact id 必须使用 collision-resistant id，并以安全清洗后的 `displayTitle` 作为人类可读部分。
- 真实交付验收必须记录 artifact path、ffprobe metadata 和 runtime log evidence。

YouTube 证据一致性与人机交互防复发规则：

- 成功结果中 `output.candidateKind` 与 `runtimeProof.candidateKind` 必须同时非空且一致；YouTube 默认为 `media_resource`，不得让 proof 留空。
- yt-dlp retry/error 行必须进入 warning/failure 语义事件，不得写成 `status=success`。
- 下载百分比、metadata probe、retry 行不得复用 `ARTIFACT_REF_RECORDED`；artifact-ref 事件只用于真实 artifact/proof 记录。
- 完成日志必须暴露 `selectedQuality`、contentType、byteSize、artifactRef、candidateKind，方便 operator 直接判断交付质量。
- Workbench 成功结果必须显示交付文件、selectedQuality、分辨率、时长、大小、sha256、proofRef、subtitle artifact 数量。
- Workbench 成功结果必须把 YouTube 标题作为第一视觉身份显示；文件路径、artifact id、video id、sha256、proofRef 只能作为证据字段，不能替代标题。
- 生产 release 不能忽略 `npm audit` moderate-or-higher 漏洞；除非 active law 明确例外，否则必须修复或阻断 PASS。

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
  - 下载请求若携带 `telegramDocumentIdHash`，CacheStorage 拼接只能选择该 hash 对应 document；hash 不在当前授权页可见媒体列表中时返回 `review_required`。
  - Workbench 页面必须显示下载动态进度区；至少在生产请求进行中显示明确 running 状态，不得让用户以为页面卡死。
  - YouTube 页面不得显示或发送 `Max MB`；Telegram 等缓存型链路仍可按其 active law 使用受治理 `maxBytes`。
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
- 成功输出必须包含 artifactRef、platformId=`telegram-web`、byteSize、durationMs、width、height、candidateKind、range coverage proof。
- 失败输出必须说明阻断点：未登录、页面不可见、SW 未接管、缓存不完整、内部 chunk 链路不可用、超时、超限、验证失败。
- 验收不得依赖群组名称、账号身份、消息正文或任何 secret。

Telegram Web 实现阻断条件：

- `video-download-capability` inspector 未把 Telegram child、platformId、candidateKind 和禁用面纳入检查。
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
  ├─ manifest.json    (12 条 law IDs)
  └─ inspector.ts
```

inspector 阻断条件：
- 法案文件缺失或少于 12 条 active law；
- `src/capabilities/video-download/children/` 少于 10 个子文件；
- `platform-router.ts` 不存在；
- `universal-page-probe-script.ts` 不存在；
- `schema.ts` 中 `platformId` 仍是 `z.literal("facebook-web")` 硬编码；
- Telegram Web child、platformId、candidateKind、platform-router 或 CacheStorage 探针缺失；
- Telegram Web visible media list 探针缺失、`videoCandidates` 输出缺失、或 `telegramDocumentIdHash` 目标绑定链路缺失；
- Telegram Web 下载探针只从 `performance` resource 识别 selected document，未合并可见 video src 与 CacheStorage keys，导致清单 hash 到下载 hash 断链；
- Telegram Web 下载探针无条件枚举大型 `tt-media-progressive` cache keys，导致 `Operation too large` 直接变成 `network_failed`；
- Workbench 启动未刷新 managed YouTube `yt-dlp`，或默认先使用 PATH 里的系统 `yt-dlp`；
- YouTube 下载阶段调用 runtime resolver 或回落 PATH `yt-dlp`，而不是使用启动 dependency gate 保存的 managed runtime；
- YouTube 下载执行阶段刷新依赖，导致每次下载都被依赖更新网络阻塞；
- YouTube 视频以 `bytes: Uint8Array` 或完整 `readFile()` 进入 artifact storage；
- YouTube 字幕以完整 `readFile()`/`bytes` 进入 artifact storage；
- yt-dlp 参数缺少 `--max-filesize`；
- YouTube `timeoutMs` 没有 abort 正在运行的 yt-dlp 进程；
- YouTube format selector 存在裸 `best` 或不带高度上限的 fallback branch；
- YouTube success 缺少 ffprobe / media stream 级验证，或 Workbench 启动未验证 `ffprobe`；
- YouTube `selectedQuality` 只是请求值、`hd`、`sd`、`best_available` 回显，没有来自媒体高度的 proof；
- `downloadSubtitles=true` 但未核对 metadata 字幕可得性；
- YouTube metadata 没有读取 title，或 success output/runtimeProof 没有保留 `sourceTitle` / `displayTitle`；
- YouTube artifact id 只依赖 `Date.now()`；
- 字幕语言变体可得性没有纳入缺失判定；
- `selectedQuality` 未校验不超过请求质量上限；
- source-page script safety gate 使用 regex/text blacklist 作为生产守门；
- 代码复活 `telegram-web-download-stream-probe`、裸 progressive XHR/fetch 分片下载，或把 HTTP 302/HTML 当作成功；
- 代码中出现 cookie/session/token/DRM/CAPTCHA bypass 正向实现；
- 代码中出现第三方下载站调用；
- 截图/封面图冒充视频下载成功。

质检脚本硬要求：

- `scripts/audit/domains/video-download-capability/inspector.ts` 必须使用 ts-morph `Project` / `SourceFile` / AST 节点 / symbol 或 declaration 结构作为执法依据。
- video-download owner inspector 和 YouTube production acceptance 禁止 `readFileSync` 读源码后搜索、禁止 RegExp、禁止 `includes`/`match`/`test` marker 扫描、禁止 `getFullText()`。
- YouTube production acceptance 必须使用 ts-morph AST/symbol 断言与可执行 fixture 组合；禁止只因某个源码 marker 存在而 PASS。
- inspector 必须自检本域 inspector 文件，发现 raw source scan 或 regex 执法即 FAIL。

## 10. 验收定义

Phase 1 完成标准：

- 法案文件存在并含 12 条 active law；
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
- YouTube dependency gate 必须证明 Workbench 启动默认刷新 managed local `yt-dlp`，刷新顺序优先于 PATH 系统 `yt-dlp`，并验证 `ffprobe`；该规则必须进入 `video-download-capability` inspector 与 production acceptance。
- YouTube production gate 必须证明：无完整视频内存读取、存在 `importVideoArtifactFromFile`、存在 `--max-filesize`、存在 ffprobe media probe、真实 `selectedQuality` 和字幕可得性核对。
- YouTube production acceptance 必须执行本地 deterministic fixtures，证明字幕语言变体正确匹配、质量上限越界失败和 artifact id 防碰撞。
- YouTube evidence acceptance 必须执行 deterministic fixture，证明 success output/proof candidateKind 一致、`sourceTitle` / `displayTitle` 从 metadata 到 proof/output 全链路保真、retry/error 日志不再记 success、progress 不用 `ARTIFACT_REF_RECORDED`。
- 字幕实测必须用 `downloadSubtitles=true` 请求，平台提供字幕时必须产生 `subtitleArtifacts`；平台未提供字幕时必须在交付中如实说明，不得伪造。
- Telegram Web 实测必须证明 `web.telegram.org` 路由、CacheStorage 完整分片拼接成功路径、缓存不完整 `review_required` 路径、以及不读取 credential/storage/token 的红线。
- Telegram Web 实测必须证明目标页先识别出可见视频清单，选择某个 `documentIdHash` 后只下载该目标；不得以“第一个完整缓存命中”冒充用户选择。
- Telegram Web 大文件实测：若 CacheStorage 不完整且内部 chunk 链路不可用，必须返回 `review_required` 并显示进度/失败状态；不得卡死、不得假成功。2026-05-23 对 1.408GB 候选生产实测返回 `review_required: Telegram stream chunk returned HTTP 302`，因此 XHR/Range stream 路径不得作为生产成功依据。
- 不允许通过手工编辑 generated artifacts、第二 downloader、第三方 downloader 网站、cookie/session/token 导出完成验收。
