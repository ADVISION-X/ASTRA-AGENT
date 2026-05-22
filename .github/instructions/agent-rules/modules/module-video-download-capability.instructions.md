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
- named platform children: `download-facebook-video-once`, `download-tiktok-video-once`, `download-instagram-video-once`, `download-bilibili-video-once`, `download-douyin-video-once`, `download-x-video-once`, `download-xiaohongshu-video-once`;
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
- using unbounded download size or unbounded wait;
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
- App API requests must be able to pass `preferredQuality` and `downloadSubtitles` into the video-download public facade.

### 禁止

FORBIDDEN:
- ignoring requested quality while reporting it as selected;
- treating subtitle request success as proven when no subtitle artifact exists and the platform provided subtitles;
- storing subtitles outside the governed artifact path;
- adding a YouTube downloader outside `src/capabilities/video-download/**`;
- using a third-party downloader website or cookie/session export to fetch YouTube media.
