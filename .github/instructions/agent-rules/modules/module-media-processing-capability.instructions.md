---
name: "GrassEye Media Processing Capability"
description: "Use when defining governed local media processing for website-ready video and image artifacts, including video compression/transcoding, image resizing/optimization, poster generation, responsive variants, artifact proof, job-flow handoff, and App Shell entry boundaries."
applyTo: ".github/instructions/agent-rules/modules/module-media-processing-capability.instructions.md, docs/法案辅助文件/GrassEye Media Processing 媒体处理能力组施工图.md, src/capabilities/media-processing/**/*.{ts,tsx,js,jsx,mjs,json}, scripts/audit/domains/media-processing-capability/**, scripts/acceptance/media-processing*.{ts,js,mjs}"
---

# GrassEye Media Processing Capability

status: active
version: 2026-06-05-v1
capabilityDomain: media-processing-capability

## 0. Identity

GrassEye is a local job-flow automation system.

`media-processing` is a governed ability group that transforms one user-authorized local media artifact into website-ready optimized media artifacts.

It solves this problem:

```txt
Input: one local media artifact already available to GrassEye
Action: validate, transform, optimize, and write governed output artifacts
Output: website-ready video/image artifacts + metadata + proof refs
```

This ability group is created because the current approved `video-download` ability group owns only one action family: obtaining a governed video artifact. Video compression, video transcoding, image resizing, image optimization, poster extraction, and responsive media variant generation are a different action family and must not be inserted into `video-download`.

Allowed architecture position:

```txt
Job Flow / Mediator / Approved App Shell route
  -> media-processing public facade
      -> one media-processing child ability
          -> optimized artifact refs / metadata / proof ref / structured failure
```

## 1. Scope

`media-processing` owns one same-kind reusable action family:

```txt
local media artifact -> optimized website-ready local media artifact(s)
```

It may process:

- local video files selected by the user;
- local image files selected by the user;
- governed video artifacts produced by `video-download`;
- governed media artifacts produced by other approved job flows;
- temporary staging artifacts created by an approved App Shell route or job flow.

It may produce:

- progressive website video files;
- compressed website video files;
- poster/thumbnail images derived from video;
- optimized website images;
- resized website images;
- responsive image variant sets;
- structured metadata and proof refs for every attempt.

## 2. Exclusions

`media-processing` does not own:

- video downloading;
- webpage media-source discovery;
- browser automation;
- platform login, CAPTCHA, risk-control, DRM, or credential handling;
- product value judgment;
- listing decision;
- upload to website/CDN/CMS;
- cloud storage publication;
- SEO/copywriting judgment;
- App Shell UI ownership;
- business batch orchestration;
- private evidence database;
- private runtime log chain;
- universal media daemon or standalone worker outside the ability-group/job-flow formula.

## 3. Authority

This file is authoritative only for the `media-processing-capability` domain.

It does not weaken:

- `capability-group-governance`;
- `video-download-capability`;
- code purity and architecture boundary laws;
- runtime log and forensics ownership;
- local application shell boundaries;
- security redlines.

When this file is accepted into the law system, `media-processing` is admitted only under:

```txt
src/capabilities/media-processing/**
```

No other root becomes a valid media-processing owner.

## 4. Approved Ability Group Root

The only approved canonical runtime root is:

```txt
src/capabilities/media-processing/
```

The only approved audit domain root is:

```txt
scripts/audit/domains/media-processing-capability/
```

The corresponding construction blueprint is:

```txt
docs/法案辅助文件/GrassEye Media Processing 媒体处理能力组施工图.md
```

The generated artifacts are not source of truth and must not be edited manually.

## 5. Law GRASSEYE-MEDIA-PROCESSING-CAPABILITY-001-V1 — Ability Group Sovereignty

```apex-law
{
  "lawId": "GRASSEYE-MEDIA-PROCESSING-CAPABILITY-001-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "media-processing-capability",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+real-code-inspection",
  "summary": "media-processing is the only governed owner for local media artifact optimization into website-ready video and image artifacts."
}
```

### 主题

媒体处理能力组主权

### 法条

`media-processing` owns exactly one class of executable ability: transforming one authorized local media artifact into one or more website-ready optimized local media artifacts with structured metadata and proof.

Required direction:

- The ability group id must be `media-processing`.
- The canonical runtime root must be `src/capabilities/media-processing`.
- The group must own schemas, contracts, child catalog, execution boundary, artifact output metadata, failure semantics, and proof contract for local media processing.
- The group must expose a public facade and typed contracts.
- The group may use local filesystem, approved artifact storage ports, ffmpeg/ffprobe-style video probing/processing, and image decoding/encoding libraries through internal runtime adapters.
- The group must return processed artifact refs, metadata, proof refs, and structured status only.

### 禁止

FORBIDDEN:

- implementing compression, transcoding, image resizing, poster extraction, or responsive media generation inside `src/capabilities/video-download/**`;
- implementing media processing inside App Shell UI files, mediator routes, job plugins, platform folders, or ad-hoc scripts as private owners;
- creating `video-processing`, `image-processing`, `asset-processing`, `media-optimizer`, or any other parallel top-level owner for the same action family;
- creating a standalone ffmpeg service, local daemon, script runner, or hidden worker that bypasses ability group public facade and job flow;
- treating `media-processing` as a business workflow, website publisher, CMS uploader, or universal media agent.

## 6. Law GRASSEYE-MEDIA-PROCESSING-CAPABILITY-002-V1 — Source Artifact Authorization

```apex-law
{
  "lawId": "GRASSEYE-MEDIA-PROCESSING-CAPABILITY-002-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "media-processing-capability",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+real-code-inspection",
  "summary": "media-processing may process only user-authorized local files or governed local artifact refs; remote acquisition and credentialed source access are outside this group."
}
```

### 主题

输入来源授权边界

### 法条

`media-processing` may accept only local media input that is already authorized and locally available.

Allowed input origins:

- user-selected local file passed through an approved App Shell route;
- governed artifact ref from `video-download` or another approved ability/job flow;
- staging file under the approved GrassEye workbench data directory;
- explicit local path only after canonical path validation and user authorization proof.

Required direction:

- Input must be canonicalized before read.
- Symlinks, path traversal, and writes outside approved roots must be denied unless the output is a user-selected delivery destination.
- Input MIME/type must be validated by actual media probing or decoding, not by extension alone.
- Every failed authorization, missing file, unsupported format, or suspicious path must return structured failure.

### 禁止

FORBIDDEN:

- accepting remote HTTP/HTTPS URLs as processing input;
- downloading media inside `media-processing`;
- reading browser cookies, localStorage, sessionStorage, tokens, saved passwords, or platform credentials;
- replaying signed CDN URLs;
- bypassing DRM, login walls, private media gates, CAPTCHA, 2FA, or platform risk controls;
- processing arbitrary filesystem paths without canonical path validation and explicit authorization proof;
- following symlinks into unapproved roots;
- treating a file extension as proof that input is a valid image or video.

## 7. Law GRASSEYE-MEDIA-PROCESSING-CAPABILITY-003-V1 — Child Ability Catalog and Atomicity

```apex-law
{
  "lawId": "GRASSEYE-MEDIA-PROCESSING-CAPABILITY-003-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "media-processing-capability",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+ast",
  "summary": "media-processing exposes bounded atomic child abilities; each invocation processes one source media artifact and must not hide workflow logic."
}
```

### 主题

子能力目录与原子性

### 法条

Approved child capabilities are:

```txt
optimize-video-for-web-once
compress-video-for-web-once
generate-video-poster-once
optimize-image-for-web-once
resize-image-for-web-once
generate-responsive-image-variants-once
```

Child semantics:

- `optimize-video-for-web-once` transforms one source video into one website streaming profile output, such as progressive MP4 with validated metadata.
- `compress-video-for-web-once` transforms one source video into one size/bitrate-constrained video output while preserving the requested web-compatible target profile.
- `generate-video-poster-once` extracts one poster/thumbnail image from one source video at an approved timestamp policy.
- `optimize-image-for-web-once` transforms one source image into one optimized website image output.
- `resize-image-for-web-once` transforms one source image into one requested dimension-constrained image output.
- `generate-responsive-image-variants-once` transforms one source image into one deterministic responsive variant set defined by the caller-approved preset.

Required direction:

- Each child ability processes one source media artifact per invocation.
- Each child has explicit input schema, forbidden inputs, output contract, validation rules, timeout policy, and structured failure policy.
- Child abilities may create multiple output files only when the child contract defines one deterministic variant set for a single source artifact.
- Child abilities must not decide the next business step.
- Child abilities must not call plugins, App Shell UI, browser automation, AI, or unrelated ability runtime internals.

### 禁止

FORBIDDEN:

- child ability performing an entire upload/publish workflow;
- child ability deciding website placement, SEO value, product value, or final business success;
- child ability batching unrelated source artifacts as a hidden workflow;
- child ability importing `src/plugins/**`;
- child ability importing private runtime internals from another ability group;
- child ability invoking video download or browser automation to fetch its own input;
- adding new child capabilities without updating this law and the construction blueprint.

## 8. Law GRASSEYE-MEDIA-PROCESSING-CAPABILITY-004-V1 — Public Facade and Consumer Boundary

```apex-law
{
  "lawId": "GRASSEYE-MEDIA-PROCESSING-CAPABILITY-004-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "media-processing-capability",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast",
  "summary": "Consumers may call media-processing only through its explicit public facade; UI, routes, and job flows must not import private runtime files."
}
```

### 主题

公共门面边界

### 法条

All external consumers must import from:

```txt
src/capabilities/media-processing/index.ts
```

Allowed public facade exports:

- public types;
- public schemas;
- port interfaces;
- ability group factory;
- child capability id constants;
- safe preset identifiers;
- result/status types.

Required direction:

- App Shell routes and job flows may call the public facade or a mediator/job-flow wrapper that calls the public facade.
- UI components must not import any media-processing runtime, child, registry, or concrete storage adapter.
- Job flows must not import `runtime/**`, `children/**`, or `registry.ts` directly.
- Public facade exports must be explicit.

### 禁止

FORBIDDEN:

- `export *` from the media-processing public facade;
- consumer import from `src/capabilities/media-processing/runtime/**`;
- consumer import from `src/capabilities/media-processing/children/**`;
- consumer import from `src/capabilities/media-processing/registry.ts`;
- App Shell UI directly spawning ffmpeg/sharp/squoosh/image libraries;
- mediator routes owning transformation logic;
- route-level fallback processor that bypasses the ability group.

## 9. Law GRASSEYE-MEDIA-PROCESSING-CAPABILITY-005-V1 — Runtime Dependency Gate

```apex-law
{
  "lawId": "GRASSEYE-MEDIA-PROCESSING-CAPABILITY-005-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "media-processing-capability",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "runtime+ast",
  "summary": "media-processing runtime dependencies must be prepared, validated, bounded, and invoked through internal safe adapters only."
}
```

### 主题

本地媒体运行时依赖治理

### 法条

Media processing may use local media tooling only through internal safe adapters.

Required direction:

- Video processing must use an internal process runner with bounded arguments, timeout, abort handling, stdout/stderr redaction, and exit-code mapping.
- ffprobe-like probing must be validated before success and must not be skipped for video outputs.
- Image processing must use an internal decoding/encoding adapter with bounded dimensions, bounded input bytes, bounded output bytes, and memory safeguards.
- Runtime dependency readiness must be observable before production readiness is claimed.
- Dependency failures must produce structured `failed` or `review_required` results.

### 禁止

FORBIDDEN:

- passing raw user-controlled CLI argument strings to shell;
- `shell: true` process execution for media commands;
- unbounded ffmpeg/ffprobe execution;
- unbounded memory reads of large video files;
- loading 1GB+ media into memory when stream/path-based processing is required;
- hidden fallback to remote processing APIs;
- hidden fallback to third-party online compression/downloader websites;
- declaring success when runtime dependency is missing or unverified.

## 10. Law GRASSEYE-MEDIA-PROCESSING-CAPABILITY-006-V1 — Web Output Contract

```apex-law
{
  "lawId": "GRASSEYE-MEDIA-PROCESSING-CAPABILITY-006-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "media-processing-capability",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+real-code-inspection",
  "summary": "media-processing success must produce validated website-ready outputs with complete metadata, not merely copied or renamed files."
}
```

### 主题

网站成品输出合同

### 法条

A successful media-processing result must prove that the output artifact matches the requested web target.

Required video success facts:

- output artifact ref;
- output file path or storage ref;
- content type;
- byte size;
- sha256;
- container/format;
- video codec;
- audio codec when audio exists;
- width and height;
- duration;
- selected preset;
- fast-start/progressive readiness when applicable;
- compression ratio when source size is available;
- source artifact ref or source path hash;
- proof ref;
- completed timestamp.

Required image success facts:

- output artifact ref;
- output file path or storage ref;
- content type;
- byte size;
- sha256;
- format;
- width and height;
- selected preset;
- quality setting when applicable;
- source artifact ref or source path hash;
- proof ref;
- completed timestamp.

Required variant-set success facts:

- stable variant set id;
- per-variant artifact refs;
- per-variant width/height/format/byteSize/sha256;
- deterministic preset id;
- proof ref.

### 禁止

FORBIDDEN:

- claiming success after only copying or renaming a file;
- claiming success without decoding/probing the output;
- claiming video streaming readiness without validating output container/metadata;
- claiming image optimization without validating output dimensions and format;
- silently exceeding caller-approved max bytes, max dimension, or timeout;
- hiding partial output failures in a success result.

## 11. Law GRASSEYE-MEDIA-PROCESSING-CAPABILITY-007-V1 — Evidence, Logs, and Artifact Truth

```apex-law
{
  "lawId": "GRASSEYE-MEDIA-PROCESSING-CAPABILITY-007-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "media-processing-capability",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+runtime",
  "summary": "media-processing may write governed output artifacts and proof refs but must not create a second evidence or logging chain."
}
```

### 主题

证据、日志、artifact 真相

### 法条

`media-processing` may produce output artifacts and action proof, but evidence and log ownership remain with the approved evidence/log systems.

Required direction:

- Every attempt must produce a proof ref or a structured reason why proof could not be persisted.
- Runtime log events must use the approved runtime log spine.
- Proof must include input validation, selected child, selected preset, output validation facts, and failure reason when failed.
- Output artifact metadata must be derived from actual files after processing.
- Temporary files must be cleaned on failure and after successful import.

### 禁止

FORBIDDEN:

- private JSONL log system inside `media-processing`;
- private evidence database inside `media-processing`;
- forged proof ref;
- stale proof reused as fresh proof;
- logging raw secrets, signed URLs, or arbitrary local absolute paths when redaction is required;
- declaring success in memory when artifact/proof persistence failed;
- leaving unbounded temporary files after failed processing.

## 12. Law GRASSEYE-MEDIA-PROCESSING-CAPABILITY-008-V1 — Job Flow and App Shell Boundary

```apex-law
{
  "lawId": "GRASSEYE-MEDIA-PROCESSING-CAPABILITY-008-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "media-processing-capability",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "ast+route-inspection",
  "summary": "App Shell skills and routes are user surfaces only; long media processing must enter a governed job-flow or mediator path and call the ability group public facade."
}
```

### 主题

Job Flow 与 App Shell 边界

### 法条

A future `Media Optimizer` skill is optional and must remain a user operation surface.

Allowed skill responsibilities:

- choose input file or governed artifact;
- choose preset;
- start a governed task;
- display status, metadata, output artifacts, and errors;
- download or reveal the final local deliverable.

Required direction:

- UI must not own compression, transcoding, resizing, probing, or artifact proof logic.
- Long video processing must use async task/status semantics instead of blocking UI/server request indefinitely.
- Batch processing, if added later, must be a job flow that invokes one child ability per source artifact; it must not be hidden inside a child ability.
- Skill registry entry must be added only after the ability group and job/route contract exist.

### 禁止

FORBIDDEN:

- adding `Media Optimizer` as a skill that directly runs processing logic inside UI files;
- App route directly implementing ffmpeg/image processing as a shortcut;
- route calling private child/runtime files;
- duplicate media processor under `src/app/**`, `src/mediator/**`, `src/plugins/**`, or `scripts/**`;
- UI timer pretending to be backend progress;
- final success shown before artifact/proof persistence is complete.

## 13. Law GRASSEYE-MEDIA-PROCESSING-CAPABILITY-009-V1 — Security and Resource Limits

```apex-law
{
  "lawId": "GRASSEYE-MEDIA-PROCESSING-CAPABILITY-009-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "media-processing-capability",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "fs+runtime+ast",
  "summary": "media-processing must enforce local-file safety, bounded resource usage, and safe command execution."
}
```

### 主题

本地文件与资源安全

### 法条

Media processing is high-frequency local compute and must be bounded.

Required direction:

- Input byte limits must be enforced before processing when possible and after probing when exact size is known.
- Output byte limits must be enforced before success.
- Width, height, frame count, duration, and variant count must be bounded by presets.
- Processing concurrency must be bounded.
- Each task must have timeout and abort behavior.
- Temporary directories must be per-task and collision-resistant.
- Output file names must be filesystem-safe and collision-resistant.
- User-facing delivery path must avoid overwriting existing files.

### 禁止

FORBIDDEN:

- unbounded concurrent video processing;
- infinite or missing timeout;
- `Number.MAX_SAFE_INTEGER` or equivalent unbounded max bytes in production defaults;
- overwriting existing user files without collision-safe naming;
- writing outputs outside governed artifact roots except explicit user-selected delivery copy;
- path traversal in output names;
- allowing user-provided raw ffmpeg filters, raw CLI args, or raw shell snippets;
- memory-only whole-file processing for large videos.

## 14. Law GRASSEYE-MEDIA-PROCESSING-CAPABILITY-010-V1 — Audit and Production Readiness

```apex-law
{
  "lawId": "GRASSEYE-MEDIA-PROCESSING-CAPABILITY-010-V1",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "media-processing-capability",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "hybrid",
  "summary": "media-processing cannot be called production-stable until law, blueprint, implementation, inspector, acceptance, and ci:full verification are aligned."
}
```

### 主题

审计与生产准入

### 法条

`media-processing` may be called production-stable only when all of the following are true:

- active law exists;
- construction blueprint exists;
- public facade exists;
- typed schemas/contracts exist;
- approved child catalog exists;
- child abilities are atomic;
- source authorization is enforced;
- output validation is real;
- evidence refs are truthful;
- runtime logs are visible;
- no second media-processing chain exists;
- App Shell/route/job-flow consumers import only public facade or approved mediator/job-flow APIs;
- media-processing audit domain is runner-visible;
- acceptance tests cover success, failure, invalid input, limits, and second-chain prevention;
- `npm run ci:full` PASS has been observed after implementation.

If any item is missing, the correct status is:

```txt
media-processing is active but not production-stable.
```

### 禁止

FORBIDDEN:

- production readiness claim without `npm run ci:full` PASS;
- warning-only P0 finding for second-chain risk;
- manual generated artifact truth;
- fake PASS marker without executable acceptance coverage;
- bypassing audit because the feature is "just a local tool";
- merging a skill surface before the ability group boundary is enforceable.

## 15. Implementation Admission Checklist

Before writing production code, the implementation PR must confirm:

```txt
[ ] active law file accepted
[ ] construction blueprint accepted
[ ] capability-group governance list/gate admits src/capabilities/media-processing/**
[ ] no generated artifact manually edited
[ ] source root created only at src/capabilities/media-processing/**
[ ] no changes inserted into src/capabilities/video-download/** except facade-level handoff comments/tests if explicitly authorized
[ ] no standalone media runner/service/script beside ability group
[ ] no App Shell skill logic before job-flow/route contract exists
[ ] acceptance fixtures are local and deterministic
[ ] final verification target remains npm run ci:full PASS
```

## 16. Final Principle

```txt
Video Download obtains a governed source video artifact.
Media Processing turns a governed local media artifact into website-ready output artifacts.
Job Flow decides why and when to process.
App Shell only lets the user operate the task.
Evidence and logs prove what happened.

If media-processing starts downloading, publishing, judging, or orchestrating the mission,
it has become a second chain and must fail.
```
