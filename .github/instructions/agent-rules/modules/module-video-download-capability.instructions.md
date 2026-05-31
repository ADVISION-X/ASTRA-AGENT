---
name: "GrassEye Video Download Capability"
description: "Use when defining universal web video download capability, platform-specific media source extraction, download evidence, or handoff from downloaded video artifacts to AI analysis."
applyTo: ".github/instructions/agent-rules/modules/module-video-download-capability.instructions.md, docs/法案辅助文件/GrassEye Video Download 视频下载能力组施工图.md, src/capabilities/video-download/**/*.{ts,tsx,js,jsx,mjs,json}, scripts/audit/domains/video-download-capability/**"
---

# GrassEye Video Download Capability

version: 2026-05-21-v2
Scope: governs the active `video-download` ability group — universal web video extraction plus named-platform child capabilities.
Boundary: this module governs media-source discovery, download authorization, platform routing, artifact proof, and AI handoff boundaries.
Excludes: product value judgment, AI product-seeding classification, visual mission planning, login bypass, platform business workflows, and credential handling.
Authority: this file is authoritative only for the video-download-capability domain.

## Phase 1 Construction Status

The current construction phase is active source build with governance in place.

Phase 1 must deliver:

- `download-web-video-once` universal child capability — extracts video from any web page the user can see;
- named platform children: `download-facebook-video-once`, `download-tiktok-video-once`, `download-instagram-video-once`, `download-bilibili-video-once`, `download-douyin-video-once`, `download-x-video-once`, `download-xiaohongshu-video-once`, `download-telegram-web-video-once`;
- platform router that selects the correct child from the current page URL;
- forensics artifact proof for every attempt;
- honest failure for DRM, login walls, private videos, and unsupported formats.

All security redlines from Law 002 remain fully active. No law upgrade changes the credential, cookie, CAPTCHA, DRM, or login-bypass prohibitions.

## Law GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-001-V1

```apex-law
{
  "lawId": "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "video-download-capability",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+real-code-inspection",
  "summary": "video-download is a governed media artifact ability group, not a DOM helper, product judge, plugin shortcut, or platform workflow."
}
```

status: active
tier: P0
capabilityDomain: video-download-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: video-download is a standalone media artifact capability group, not a DOM helper, product judge, plugin shortcut, or platform workflow.

### 主题

视频下载能力组主权

### 法条

Video Download owns one class of executable ability: obtaining one governed video media artifact from a user-authorized current page or approved page URL and returning local artifact proof.

Required direction:
- The future ability group id must be `video-download`.
- The canonical runtime root must be `src/capabilities/video-download`.
- The group must own schemas, contracts, child catalog, execution boundary, artifact proof, and failure semantics for media download.
- The group may use public browser and DOM contracts as inputs, but must not live inside DOM Automation, Product Video DOM Runtime, PlatformRegistry, Open, Screenshot, or AI.
- The group must return downloaded media artifact refs and metadata only.
- Product value, product-seeding judgment, purchasing judgment, and advertising judgment remain outside this group.

### 禁止

FORBIDDEN:
- implementing video download inside `src/capabilities/dom-automation/**`, `src/plugins/product-video-dom-runtime/**`, or `src/platforms/**` as a private owner;
- treating video download as a DOM snapshot child, product-video plugin child, platform profile field, or AI semantic shortcut;
- returning screenshots, poster images, HTML, visible text, or page metadata as downloaded-video success;
- creating a compatibility, fallback, bridge, duplicate, or shadow downloader beside the video-download owner.

## Law GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-002-V1

```apex-law
{
  "lawId": "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-002-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "video-download-capability",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+real-code-inspection",
  "summary": "video download must use only user-authorized local page access and must never bypass credentials, login, CAPTCHA, risk controls, DRM, or platform protections."
}
```

status: active
tier: P0
capabilityDomain: video-download-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: video download must use only user-authorized local page access and must never bypass credentials, login, CAPTCHA, risk controls, DRM, or platform protections.

### 主题

授权访问与平台安全红线

### 法条

Video Download may use only media resources already available to the user's authorized local browser session or approved public page URL.

Required direction:
- Credentials, cookies, sessions, localStorage, sessionStorage, and tokens must remain undisclosed and unread.
- Login wall, CAPTCHA, 2FA, risk-control wall, private video, permission denial, or DRM must return `review_required` or `failed`.
- Media extraction must be read-only until a validated media candidate is downloaded.
- Platform request headers must be minimal and must not smuggle secrets from browser storage.
- Temporary CDN URLs must be treated as expiring source evidence, not durable product evidence.

### 禁止

FORBIDDEN:
- reading, exporting, logging, injecting, replaying, or persisting cookies, sessions, tokens, browser passwords, localStorage, or sessionStorage;
- bypassing login, CAPTCHA, 2FA, risk control, private-video gates, signed-access gates, or DRM;
- using third-party downloader websites or hidden paid APIs as default runtime paths;
- scraping private messages, private videos, or non-public pages;
- logging full signed media URLs when they contain sensitive or expiring credential material.

## Law GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-003-V1

```apex-law
{
  "lawId": "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-003-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "video-download-capability",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+real-code-inspection",
  "summary": "The video-download group exposes one universal child, named-platform children, and a YouTube child that each download one video artifact per invocation and must not become business workflows."
}
```

status: active
tier: P0
capabilityDomain: video-download-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: The video-download group exposes one universal child and named-platform children that each download one video artifact per invocation and must not become business workflows.

### 主题

子能力边界 — 通用 + 多平台

### 法条

The approved child capabilities are:

**Universal:**
- `download-web-video-once` — works on any web page the user can see; uses generic extraction (video elements, performance entries, HLS/DASH manifests, script data).

**Named-platform:**
- `download-facebook-video-once` — Facebook Relay data / native MP4 extraction.
- `download-tiktok-video-once` — TikTok `__NEXT_DATA__` / SIGI_STATE media extraction.
- `download-instagram-video-once` — Instagram shared data / video element extraction.
- `download-bilibili-video-once` — Bilibili page data / video element extraction.
- `download-douyin-video-once` — Douyin page data extraction (same engine family as TikTok).
- `download-x-video-once` — X/Twitter `__NEXT_DATA__` / video CDN extraction.
- `download-xiaohongshu-video-once` — 小红书/RED page data / video element extraction.
- `download-youtube-video-once` — YouTube governed artifact download through the local yt-dlp runtime for user-authorized videos.
- `download-telegram-web-video-once` — Telegram Web governed artifact assembly from user-authorized Service Worker / CacheStorage media bytes.

Required for every child capability:
- Downloads at most one target video artifact per invocation.
- Declares explicit input schema, forbidden inputs, output proof, failure policy, and platform host allowlist.
- Returns structured result: `success`, `failed`, or `review_required`.
- Any platform-specific parser stays under the video-download owner inside `runtime/` or a `providers/` subfolder.
- If extraction is uncertain or blocked, returns `review_required` with an explicit reason — never fake success.

Universal child (`download-web-video-once`) detection order:
1. `<video>` element `currentSrc` / `src` / `<source>` children.
2. Performance resource entries with video MIME types or URL patterns (`.mp4`, `.webm`, `.m3u8`, `.mpd`, `.ts`).
3. HLS/M3U8 manifest URLs found in inline script text.
4. DASH/MPD manifest URLs found in inline script text.
5. Direct MP4/WebM URLs in script data.

Named-platform children take priority when a platform router identifies the current page URL as a known platform host.

### 禁止

FORBIDDEN:
- combining open page, classify product, like, comment, save lead, next video, and download into one child capability;
- adding any `download-*` as a child of DOM Automation, Open, or Screenshot;
- storing platform-specific media parser logic in DOM Automation or Product Video DOM Runtime;
- using platform names as business-flow packages instead of child media download boundaries;
- treating the universal child as a bypass for platform-specific security boundaries;
- universal child returning DRM-protected or login-required content as success.

## Law GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-004-V1

```apex-law
{
  "lawId": "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-004-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "video-download-capability",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+real-code-inspection",
  "summary": "every media candidate must be validated before download success can be claimed."
}
```

status: active
tier: P0
capabilityDomain: video-download-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: every media candidate must be validated before download success can be claimed.

### 主题

媒体候选验证

### 法条

Video Download must prove that a candidate is a real video media resource before writing success evidence.

Required direction:
- Candidate hosts must pass platform-owned allowlists or approved media CDN policies.
- Candidate URLs must pass MIME, status, size, and byte-range checks when available.
- Downloaded files must be verified as real media containers with video streams.
- Output metadata must include content type, byte size, duration, dimensions when available, selected quality, and source candidate kind.
- Failed, ambiguous, expired, poster-only, image-only, HTML-only, and DRM-blocked candidates must not become success.

### 禁止

FORBIDDEN:
- treating `.jpg`, `.webp`, poster images, thumbnails, HTML, JSON, screenshots, or empty files as video success;
- skipping media validation because a URL string contains `video` or `mp4`;
- using unobservable wait, or using unbounded download size on non-YouTube children whose active implementation still requires `maxBytes`;
- returning stale or expired CDN URLs as the only output proof.

## Law GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-005-V1

```apex-law
{
  "lawId": "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-005-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "video-download-capability",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+real-code-inspection",
  "summary": "every download attempt must leave Forensics-compatible artifact proof and structured failure evidence."
}
```

status: active
tier: P0
capabilityDomain: video-download-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: every download attempt must leave Forensics-compatible artifact proof and structured failure evidence.

### 主题

下载证据与元数据

### 法条

Every video download attempt must leave traceable owner evidence for success and failure.

Required direction:
- Success output must include `artifactRef`, `sourcePageUrl`, `platformId`, `videoId` when known, `contentType`, `byteSize`, `durationMs` when known, `width` and `height` when known, `downloadedAt`, `candidateKind`, `status`, and owner proof.
- Failure output must include status, error code, reason, source page URL, platform id, and review-required reason when applicable.
- The media file must be stored as a local artifact through the governed evidence path.
- Logs must redact sensitive query material and must not write cookies, sessions, tokens, or credentials.

### 禁止

FORBIDDEN:
- silent success;
- silent failure;
- returning only an in-memory buffer with no artifact reference;
- storing raw sensitive signed URLs as durable evidence;
- writing downloaded media outside the governed artifact path.

## Law GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-006-V1

```apex-law
{
  "lawId": "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-006-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "video-download-capability",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+real-code-inspection",
  "summary": "downloaded video artifacts may feed AI analysis, but video-download must not own AI product judgment."
}
```

status: active
tier: P0
capabilityDomain: video-download-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: downloaded video artifacts may feed AI analysis, but video-download must not own AI product judgment.

### 主题

AI 分析交接边界

### 法条

Video Download may hand a verified local video artifact to downstream AI analysis or Product Video evidence assembly.

Required direction:
- Video Download output may be consumed by AI, Product Video DOM Runtime, or Forensics only through public contracts.
- Downstream AI may judge product visibility, product value, seed quality, purchase intent, or selection value.
- Video Download must stay limited to media acquisition and proof.
- If video cannot be downloaded, downstream analysis may receive a failure or review-required result, not a fake video artifact.

### 禁止

FORBIDDEN:
- video-download deciding whether a video is a product-seeding video;
- video-download scoring product value, profit, procurement, ads, comment intent, or market fit;
- hiding AI analysis prompt logic inside media downloader code;
- treating successful download as successful product discovery.

## Law GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-007-V1

```apex-law
{
  "lawId": "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-007-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "video-download-capability",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+real-code-inspection",
  "summary": "the universal child must extract video candidates using only publicly observable browser media data and must never bypass platform security."
}
```

status: active
tier: P0
capabilityDomain: video-download-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: the universal child must extract video candidates using only publicly observable browser media data and must never bypass platform security.

### 主题

通用网页视频提取边界

### 法条

The `download-web-video-once` child extracts video from any web page the user can see using only observable browser media data.

Required detection methods (in priority order):
1. `<video>` element `currentSrc`, `src`, and `<source>` element children.
2. `window.performance.getEntriesByType('resource')` entries with video MIME types or URL patterns (`.mp4`, `.webm`, `.m3u8`, `.mpd`, `.ts`, `.m4v`).
3. Inline `<script>` text searched for HLS/M3U8 manifest URL patterns.
4. Inline `<script>` text searched for DASH/MPD manifest URL patterns.
5. Direct MP4/WebM URLs found in script data matching media host allowlist.

Required quality ranking:
- Prefer higher-quality candidates when multiple candidates exist.
- `native_hd` > `video_element` (with `currentSrc`) > `media_resource` (performance entry) > `hls_manifest` > `dash_manifest` > `source_element` > `native_sd`.

Required output:
- `platformId` derived from the actual page URL host, or `"universal-web"` when no named platform matches.
- All other proof fields as required by Law 005.

Required failure behavior:
- If no candidates are found, return `failed` with `candidate_not_found`.
- If only DRM-protected, login-required, or expired candidates are found, return `review_required` with explicit reason.
- Never return success with a poster image, thumbnail, HTML document, or JSON response body.

### 禁止

FORBIDDEN:
- using third-party downloader websites or hidden paid APIs as default or fallback runtime paths;
- calling platform-named extraction logic from the universal child (use platform router + named children instead);
- treating blob: URLs without streaming validation as confirmed video artifacts;
- running the universal probe on a page the user has not authorized or cannot currently see;
- writing the universal probe result as evidence before media validation confirms a real video stream.

## Law GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-008-V1

```apex-law
{
  "lawId": "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-008-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "video-download-capability",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+real-code-inspection",
  "summary": "platform detection must route to the correct child capability and must not silently fall back to the universal extractor on a known platform."
}
```

status: active
tier: P0
capabilityDomain: video-download-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: platform detection must route to the correct child capability and must not silently fall back to the universal extractor on a known platform.

### 主题

平台检测与路由边界

### 法条

The video-download ability group must expose a platform router that maps the current page URL to the correct child capability ID.

Required routing rules:
- `facebook.com`, `fb.watch` → `download-facebook-video-once`
- `tiktok.com` (non-CN) → `download-tiktok-video-once`
- `instagram.com` → `download-instagram-video-once`
- `bilibili.com`, `b23.tv` → `download-bilibili-video-once`
- `douyin.com`, `iesdouyin.com` → `download-douyin-video-once`
- `x.com`, `twitter.com` → `download-x-video-once`
- `xiaohongshu.com`, `xhslink.com` → `download-xiaohongshu-video-once`
- `youtube.com`, `youtu.be`, `youtube-nocookie.com` → `download-youtube-video-once`
- `web.telegram.org` → `download-telegram-web-video-once`
- all other hosts → `download-web-video-once`

Required behavior:
- Platform routing is a pure URL-to-childCapabilityId mapping; it must not perform any DOM access or page execution.
- When a job flow calls the video-download ability group without specifying a child, the router selects the child automatically from `sourcePageUrl`.
- The router result must be logged (redacted URL host only, not query parameters or path tokens).
- If a named platform child returns `candidate_not_found` or `review_required`, the job flow (not the router and not the child) may decide to retry with the universal child.

### 禁止

FORBIDDEN:
- router performing DOM reads, network requests, or screenshot evidence;
- router containing platform-specific business decisions;
- router silently substituting `download-web-video-once` for a named platform without logging the substitution;
- child capabilities calling the router internally (router is caller-owned, not child-owned);
- adding routing logic inside `src/mediator` or any job flow.

## Law GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-009-V1

```apex-law
{
  "lawId": "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-009-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "video-download-capability",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+real-code-inspection",
  "summary": "YouTube downloads must honor explicit quality requests and subtitle requests through governed local artifacts."
}
```

status: active
tier: P0
capabilityDomain: video-download-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: YouTube downloads must honor explicit quality requests and subtitle requests through governed local artifacts.

### 主题

YouTube 清晰度与字幕下载边界

### 法条

`download-youtube-video-once` may download a user-authorized YouTube video only through the governed local runtime and must preserve selected quality and subtitle proof in the result.

Required behavior:
- Input must accept the explicit quality set `2160p`, `1440p`, `1080p`, `720p`, `480p`, `360p`, `hd`, `sd`, and `best_available`.
- Each explicit quality must map to a bounded format selector that does not exceed the requested height.
- `downloadSubtitles=true` must request subtitles using `subtitleLanguages` and persist subtitle artifacts when the platform provides them.
- Success output and runtime proof must include `selectedQuality` and `subtitleArtifacts`.
- App API requests must pass `preferredQuality` and `downloadSubtitles` through a mediator route and explicit job flow before the job flow calls the video-download public facade.

### 禁止

FORBIDDEN:
- ignoring requested quality while reporting it as selected;
- treating subtitle request success as proven when no subtitle artifact exists and the platform provided subtitles;
- storing subtitles outside the governed artifact path;
- adding a YouTube downloader outside `src/capabilities/video-download/**`;
- using a third-party downloader website or cookie/session export to fetch YouTube media.

## Law GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-010-V1

```apex-law
{
  "lawId": "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-010-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "video-download-capability",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+real-code-inspection",
  "summary": "Telegram Web downloads must use only the user-authorized Telegram Web Service Worker / CacheStorage media chain and must never treat raw progressive URLs or UI download buttons as success."
}
```

status: active
tier: P0
capabilityDomain: video-download-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection

summary: Telegram Web downloads must use only the user-authorized Telegram Web Service Worker / CacheStorage media chain and must never treat raw progressive URLs or UI download buttons as success.

### 主题

Telegram Web 内部媒体链路下载边界

### 法条

`download-telegram-web-video-once` may assemble one verified video artifact only from media bytes already available through the user's authorized `web.telegram.org` browser page and Telegram Web's own Service Worker / CacheStorage media chain.

Required behavior:
- The child must only accept `web.telegram.org` source pages.
- The child must use the active browser page as the authorization boundary and must not export browser credentials or Telegram session material.
- CacheStorage media assembly is allowed only when range coverage proves a complete contiguous video payload for one Telegram document.
- Success requires media bytes, video MIME, bounded byte size, MP4/WebM container validation, artifact storage, and structured proof.
- Incomplete cache coverage, missing Service Worker control, missing visible media, login wall, permission denial, or unavailable internal chunk path must return `review_required` or `failed`.
- Raw Telegram progressive/download URLs are expiring implementation details and must not be durable success proof.

### 禁止

FORBIDDEN:
- clicking or depending on the Telegram UI download button as the programmatic capability path;
- treating `/progressive/document...`, `video.currentSrc`, performance entries, curl, fetch, or XHR HTML/302 responses as downloaded media success;
- reading, exporting, logging, or persisting Telegram cookies, sessions, account secrets, browser storage credentials, MTProto session material, or authorization tokens;
- bypassing group membership, private message permissions, login, CAPTCHA, 2FA, risk controls, or Telegram access gates;
- using third-party Telegram downloader websites, proxy download services, hidden paid APIs, or a second downloader owner;
- returning partial CacheStorage chunks, thumbnails, posters, HTML, JSON, or empty files as success;
- storing raw Telegram media URLs, group names, message text, account identity, or sensitive path/query material as durable proof.

## Law GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-011-V1

```apex-law
{
  "lawId": "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-011-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "video-download-capability",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+real-code-inspection+acceptance",
  "summary": "YouTube production downloads must be stream/file based, size-gated during download, media-probed, startup dependency resilient, and user-observable through one governed Workbench status path."
}
```

status: active
tier: P0
capabilityDomain: video-download-capability
enforcementMode: machine-blocking
evidenceMode: law+blueprint+real-code-inspection+acceptance

summary: YouTube production downloads must be stream/file based, size-gated during download, media-probed, startup dependency resilient, and user-observable through one governed Workbench status path.

### 主题

YouTube 生产级下载防复发边界

### 法条

`download-youtube-video-once` must be implemented as a production media artifact path, not an in-memory toy downloader.

Required behavior:
- YouTube video bytes must be imported from a downloaded file path into governed artifact storage; the runtime must not read the entire video into memory as a `Uint8Array`.
- YouTube download execution must pass the governed `maxBytes` into yt-dlp as a download-time `--max-filesize` gate; post-download byte-size checks are only a second line of defense.
- Success requires container/header validation plus real media probing that proves at least one video stream, positive duration, width, and height.
- Success proof must derive `selectedQuality` from the verified media height or explicit quality class, not merely echo the requested quality.
- When `downloadSubtitles=true`, metadata must prove whether requested subtitle languages are available; if the platform reports available requested subtitles but no subtitle artifact is written, the result must fail.
- Workbench startup must verify both managed `yt-dlp` and `ffprobe`; missing `ffprobe` is a dependency failure, not a fake media failure after download.
- Workbench startup dependency refresh must prefer managed latest `yt-dlp`, but if refresh fails and an already verified managed local binary exists, startup may continue with that managed binary and expose the condition through logs/status.
- Download execution must not refresh dependencies.
- The local UI must use a governed Workbench status path for long-running YouTube jobs; task state must be bounded, persisted under the existing Workbench data dir, and guarded by a concurrency limit.
- Copying the final artifact to the user Downloads directory is part of delivery; copy failure must be surfaced as a failure instead of silently swallowed.
- Production acceptance and owner inspector must block regressions for in-memory video reads, missing download-time size gate, missing media probe, fake selectedQuality, missing subtitle availability proof, missing status route, missing dependency gate, unbounded async tasks, and silent Downloads copy failure.

### 禁止

FORBIDDEN:
- `readFile()` or equivalent full-buffer loading of YouTube video artifacts;
- artifact storage accepting large YouTube media only as in-memory bytes;
- missing `--max-filesize` during yt-dlp execution;
- reporting requested quality as selected quality without verified media-height proof;
- claiming subtitle request success when requested subtitles are reported available but no subtitle artifact exists;
- relying on implicit system `ffprobe` without a startup dependency gate;
- killing YouTube production downloads through a short Workbench request timeout while the governed async task is still running;
- relying only on file extension or `ftyp`/magic bytes as the success proof;
- hiding copy-to-Downloads failure while reporting final delivery success;
- a second downloader, second status server, second runtime log chain, or second evidence chain;
- UI-only timers that pretend to be task status without reading the governed Workbench status path.

## Law GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-012-V1

```apex-law
{
  "lawId": "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-012-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "video-download-capability",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ts-morph+symbol+anti-evasion+acceptance",
  "summary": "Video-download owner inspection must be AST/symbol/anti-evasion based and must not use raw source string scans, regex, or marker theater as enforcement."
}
```

status: active
tier: P0
capabilityDomain: video-download-capability
enforcementMode: machine-blocking
evidenceMode: ts-morph+symbol+anti-evasion+acceptance

summary: Video-download owner inspection must be AST/symbol/anti-evasion based and must not use raw source string scans, regex, or marker theater as enforcement.

### 主题

Video Download 质检真实性与防复发

### 法条

The `video-download-capability` owner inspector and production acceptance must prove production rules through ts-morph AST and symbol-level structure.

Required behavior:
- Inspector must use `InspectorContext.project` and `SourceFile` structure as the execution evidence source.
- Inspector must verify schemas, child registry, runtime calls, object literal contracts, import boundaries, forbidden credential surfaces, Workbench route admission, job-flow pass-through, and YouTube production hardening by AST structure.
- Inspector must include anti-evasion checks that fail if the video-download inspector itself imports `readFileSync`, uses regular expression literals, `new RegExp`, raw source `includes`, raw `match`/`test`, `getFullText`, shell grep, or marker-only source scans as law enforcement.
- Production acceptance for YouTube hardening must also use ts-morph structural assertions, not raw text or regex assertions.

### 禁止

FORBIDDEN:
- `readFileSync` source scans inside `scripts/audit/domains/video-download-capability/**`;
- `/.../`, `new RegExp()`, `String.prototype.match`, `String.prototype.includes`, or `getFullText()` as video-download audit enforcement;
- acceptance tests that pass only because a marker string appears in source;
- lowering law requirements to make marker checks pass;
- adding a second inspector, second generated truth, or parallel quality script for video-download.

## Law GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-013-V1

```apex-law
{
  "lawId": "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-013-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "video-download-capability",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ts-morph+symbol+anti-evasion+acceptance",
  "summary": "YouTube production runtime must use one prepared managed yt-dlp binary, bounded selectors, bounded bytes, real total timeout abort, file-based subtitle artifacts, and atomic task state persistence."
}
```

status: active
tier: P0
capabilityDomain: video-download-capability
enforcementMode: machine-blocking
evidenceMode: ts-morph+symbol+anti-evasion+acceptance

summary: YouTube production runtime must use one prepared managed yt-dlp binary, bounded selectors, bounded bytes, real total timeout abort, file-based subtitle artifacts, and atomic task state persistence.

### 主题

YouTube 生产级运行时单链路与防复发

### 法条

`download-youtube-video-once` must run through one prepared managed local `yt-dlp` runtime resolved by the Workbench startup dependency gate. Download execution must not rediscover dependencies, must not fall back to PATH `yt-dlp`, and must not create a second runtime selection chain.

Required behavior:
- Startup dependency preparation must resolve and store the managed `yt-dlp` runtime path before any YouTube download can execute.
- Download execution must obtain the binary path only from the prepared runtime accessor.
- Non-override production resolution must never fall back to PATH `yt-dlp`; `GRASSEYE_YT_DLP_BINARY` remains the only explicit operator override.
- Every YouTube format selector branch, including fallback branches, must be height-bounded for its quality class; `best_available` must still have an explicit maximum production height.
- Workbench YouTube requests must use a finite governed `maxBytes` value, never `Number.MAX_SAFE_INTEGER`.
- The child must enforce a real total timeout by aborting the running yt-dlp process when `timeoutMs` expires.
- Subtitle artifacts must be imported from subtitle file paths or otherwise streamed through the governed artifact port; subtitle persistence must not depend on in-memory `bytes` payloads.
- Async task snapshots must be persisted atomically under the existing Workbench data dir, and terminal persistence failure must fail the async task rather than silently diverging memory state from disk state.
- Owner inspector and production acceptance must prove these requirements through ts-morph AST and symbol-level checks, including anti-evasion checks against raw string, regex, and marker-only enforcement.

### 禁止

FORBIDDEN:
- fallback to PATH `yt-dlp` from the normal managed runtime path;
- resolving or refreshing `yt-dlp` during download execution;
- using `Number.MAX_SAFE_INTEGER` or equivalent unbounded value for YouTube `maxBytes`;
- naked `best` or format-id fallback branches that can exceed the requested height;
- selected quality derived by echoing `hd`, `sd`, or `best_available` instead of the verified media height;
- timeout fields that do not abort the active yt-dlp process;
- `readFile()`/full-buffer subtitle artifact persistence;
- non-atomic async task snapshot writes or swallowed terminal snapshot persistence failures;
- grep, raw source text scans, regex, or marker strings as the enforcement basis for this law.

## Law GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-014-V1

```apex-law
{
  "lawId": "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-014-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "video-download-capability",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ts-morph+symbol+anti-evasion+acceptance",
  "summary": "YouTube production readiness must be proven by semantic AST checks and executable route/runtime fixtures, not marker strings, regex scans, or shape-only tests."
}
```

status: active
tier: P0
capabilityDomain: video-download-capability
enforcementMode: machine-blocking
evidenceMode: ts-morph+symbol+anti-evasion+acceptance

summary: YouTube production readiness must be proven by semantic AST checks and executable route/runtime fixtures, not marker strings, regex scans, or shape-only tests.

### 主题

YouTube 生产验收真实性与防复发

### 法条

`video-download-capability` 的 YouTube 生产验收必须证明真实行为边界，而不是证明源码里出现了若干字符串。

Required behavior:
- Owner inspector and production acceptance must use ts-morph AST, symbols, declarations, import graph, object contracts, and executable fixtures as evidence.
- Anti-evasion must fail any video-download audit or YouTube production acceptance file that uses regular expression literals, `new RegExp`, `String.prototype.includes`, `String.prototype.match`, `String.prototype.test`, `getText`, `getFullText`, `readFileSync` source scans, or marker-only source assertions as enforcement.
- Production acceptance must execute deterministic fixtures for Workbench route defaults, async terminal persistence failure, Downloads copy failure, YouTube subtitle availability matching, selected-quality height bounds, and artifact-id collision resistance.
- YouTube Workbench requests without explicit `preferredQuality` must default to `best_available`, not silently downgrade to `720p`.
- Synchronous `/api/video-download/start` must not execute long-running YouTube downloads; YouTube must use the governed async status path.
- Terminal async task snapshot persistence failure must make the task terminal failed and observable; memory success with disk failure is forbidden.
- YouTube artifact ids must be collision-resistant and must not rely only on `Date.now()`.
- YouTube subtitle availability matching must treat language variants such as `en-US` as satisfying a requested base language such as `en`, and must fail when a matching available subtitle is not persisted.
- Source-page script safety checks must be structural and allowlisted; regex/text blacklists are not sufficient production enforcement.

### 禁止

FORBIDDEN:
- marker-only YouTube production acceptance;
- regex or raw string source scans in video-download owner inspector or YouTube production acceptance;
- YouTube route defaults that silently cap production requests at `720p`;
- executing YouTube through synchronous long-request route;
- terminal snapshot persistence errors that are swallowed or reported as success;
- YouTube video or subtitle artifact ids based only on timestamp;
- exact-only subtitle language checks that miss available platform language variants;
- security gates based only on regex-blacklisting page-evaluation script text.

## Law GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-015-V1

```apex-law
{
  "lawId": "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-015-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "video-download-capability",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ts-morph+symbol+executable-fixture+real-download",
  "summary": "YouTube production delivery must close all runtime-state gaps: variant subtitle matching, abortable metadata probes, temp cleanup, bounded caller controls, observable persistence failure, collision-resistant Downloads delivery, and real URL delivery evidence."
}
```

status: active
tier: P0
capabilityDomain: video-download-capability
enforcementMode: machine-blocking
evidenceMode: ts-morph+symbol+executable-fixture+real-download

summary: YouTube production delivery must close all runtime-state gaps: variant subtitle matching, abortable metadata probes, temp cleanup, bounded caller controls, observable persistence failure, collision-resistant Downloads delivery, and real URL delivery evidence.

### 主题

YouTube 真实交付与状态一致性防复发

### 法条

`download-youtube-video-once` and the governed Workbench route must be production-delivery complete, not merely shape-compliant.

Required behavior:
- YouTube subtitle availability must be decided by a reusable variant-aware helper; requested `en` must match available `en-US` / `en-GB`, requested `zh` must match `zh-Hans` / `zh-Hant`, and missing matching subtitle artifacts must fail the result.
- Metadata probing and media downloading must use the same prepared managed `yt-dlp` binary and the same abortable process runner class; timeout must be able to terminate the active metadata or download process.
- YouTube temporary directories must be removed both when yt-dlp throws and when post-download validation returns failure.
- Workbench YouTube requests must honor a caller-provided finite `maxBytes` when smaller than the governed maximum, and must cap larger values to the governed maximum.
- Workbench YouTube requests must pass caller `subtitleLanguages` through the mediated job input; hard-coded English-only subtitle requests are forbidden except as the documented default when the caller omits languages.
- Initial async task snapshot persistence failure must become an observable failed task response; it must not leave an unobservable thrown request or a stale in-memory running task.
- Downloads delivery filenames must use collision-resistant ids and must surface copy failure as task failure.
- Production acceptance must include executable fixtures for bounded caller maxBytes, subtitle language pass-through, variant subtitle availability, failed initial persistence, Downloads copy failure, collision-resistant delivery names, and synchronous YouTube rejection.
- Final release evidence for a user-requested YouTube URL must include actual artifact proof, ffprobe-backed media metadata, governed Downloads delivery path, status route observation, and runtime logs.

### 禁止

FORBIDDEN:
- exact-only subtitle availability checks before variant matching;
- metadata probes that use a separate non-abortable yt-dlp execution path;
- temporary YouTube download directories left behind after validation failure;
- ignoring caller `maxBytes` for YouTube requests;
- hard-coding subtitle languages when the caller supplied a valid language list;
- initial async persistence failure that throws without an observable failed task body;
- timestamp-only Downloads delivery names;
- reporting a user-requested YouTube delivery complete without real artifact, ffprobe metadata, status-path evidence, and delivery-path proof.

## Law GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-016-V1

```apex-law
{
  "lawId": "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-016-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "video-download-capability",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ts-morph+symbol+executable-fixture+real-download",
  "summary": "YouTube production evidence must be operator-readable and internally consistent: runtime proof candidate kind cannot be null on success, retry/error logs cannot be marked success, progress cannot masquerade as artifact refs, UI must expose delivery proof, and final release cannot ignore dependency audit risk."
}
```

status: active
tier: P0
capabilityDomain: video-download-capability
enforcementMode: machine-blocking
evidenceMode: ts-morph+symbol+executable-fixture+real-download

summary: YouTube production evidence must be operator-readable and internally consistent: runtime proof candidate kind cannot be null on success, retry/error logs cannot be marked success, progress cannot masquerade as artifact refs, UI must expose delivery proof, and final release cannot ignore dependency audit risk.

### 主题

YouTube 生产交付证据一致性与人机交互防复发

### 法条

YouTube success evidence, runtime logs, and Workbench presentation must be usable by a production operator without reading code or guessing hidden state.

Required behavior:
- On every successful YouTube result, `output.candidateKind` and `runtimeProof.candidateKind` must both be non-null and equal.
- YouTube retry/error progress lines from yt-dlp must be logged as warning or failure events, never as `status: "success"`.
- YouTube progress lines must not use `ARTIFACT_REF_RECORDED`; artifact-ref events are reserved for actual artifact/proof recording.
- YouTube stage-completion logs must expose `selectedQuality`, content type, byte size, artifact ref, and candidate kind.
- Workbench result UI must expose Downloads path or artifact path, selected quality, dimensions/duration, size, sha256, proof ref, and subtitle artifact count.
- YouTube UI must expose subtitle request and caller language controls instead of hiding the subtitle chain.
- Owner inspector and production acceptance must block proof/output candidate-kind divergence, artifact-ref progress misuse, success-logged retry/error events, missing UI proof fields, and hidden YouTube subtitle controls using ts-morph AST/symbol checks plus executable fixtures.
- Final production release must treat `npm audit` moderate-or-higher vulnerabilities as unresolved risk unless explicitly fixed or documented by an active law exception.

### 禁止

FORBIDDEN:
- successful YouTube runtime proof with `candidateKind: null`;
- `output.candidateKind` diverging from `runtimeProof.candidateKind`;
- logging yt-dlp retry/error text as successful progress;
- using `ARTIFACT_REF_RECORDED` for download percentages or metadata-progress chatter;
- hiding selected quality, dimensions, sha256, proof ref, or subtitle artifact count from the final Workbench result;
- hiding all YouTube subtitle controls while claiming subtitle production readiness;
- final PASS while dependency audit reports unresolved moderate-or-higher vulnerabilities without an explicit active-law exception.

## Law GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-017-V1

```apex-law
{
  "lawId": "GRASSEYE-VIDEO-DOWNLOAD-CAPABILITY-017-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "video-download-capability",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ts-morph+symbol+executable-fixture+real-download",
  "summary": "YouTube production delivery must preserve the platform source title as operator-facing metadata and Downloads filename; random ids may prevent collision but must not replace the title."
}
```

status: active
tier: P0
capabilityDomain: video-download-capability
enforcementMode: machine-blocking
evidenceMode: ts-morph+symbol+executable-fixture+real-download

summary: YouTube production delivery must preserve the platform source title as operator-facing metadata and Downloads filename; random ids may prevent collision but must not replace the title.

### 主题

YouTube 原始标题保真与交付文件名防复发

### 法条

YouTube success evidence, artifact storage, Workbench status, and Downloads delivery must preserve the YouTube metadata title as a first-class operator-readable field.

Required behavior:
- Metadata probing must read the platform `title` from yt-dlp JSON and fail or review when a successful YouTube result cannot expose a non-empty `sourceTitle`.
- YouTube success output and runtime proof must include `sourceTitle` and `displayTitle`.
- `displayTitle` must be derived from `sourceTitle`; it may only be changed for filesystem safety, length bounds, or collision-resistant suffixes.
- Artifact ids and Downloads filenames may include `randomUUID()` or other collision-resistant suffixes, but the visible basename must begin with or otherwise prominently preserve the sanitized source title.
- Workbench UI must show the title as the primary success label, above or alongside delivery path, quality, dimensions, size, sha256, proof, and subtitle count.
- Production acceptance must execute fixtures proving title extraction, title propagation into proof/output, sanitized title delivery names, and that pure UUID/random-only YouTube delivery names are rejected.
- Owner inspector must block regressions through ts-morph AST/symbol checks, including schema fields, runtime metadata title extraction, child propagation, Downloads filename construction, UI title rendering, and acceptance fixture coverage.

### 禁止

FORBIDDEN:
- fixed yt-dlp output templates such as `youtube_video.%(ext)s` as the final human-facing identity;
- success output or runtime proof that omits `sourceTitle` or `displayTitle`;
- Downloads delivery filenames that are only UUID/timestamp/hash plus extension or only UUID/timestamp/hash plus an internal artifact id;
- using random ids as a substitute for the YouTube title;
- UI success states that require the operator to infer the video identity from a path, artifact id, video id, sha256, or proof id;
- acceptance or inspector coverage that passes without a title-preservation fixture.
