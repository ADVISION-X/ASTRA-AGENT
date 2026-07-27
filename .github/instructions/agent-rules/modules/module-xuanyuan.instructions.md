---
description: "GrassEye Xuanyuan local acceptance execution law: durable named GPT Web tasks, outbound cloud claims, exact checkpoints and restart recovery."
applyTo: "src/plugins/xuanyuan/**/*.ts,src/app/workbench-xuanyuan-routes.ts,src/app/workbench-api-boundary.ts,src/lib/local-runtime/workbench-xuanyuan-cloud-support.ts,scripts/audit/domains/xuanyuan/**/*.ts,scripts/acceptance/xuanyuan.acceptance.ts,docs/法案辅助文件/GrassEye Xuanyuan 受控本地执行施工图.md"
---

# GrassEye Xuanyuan 受控本地执行法案

status: active
version: 2026-07-27
capabilityDomain: xuanyuan

Scope: `xuanyuan` is the only GrassEye owner for governed local GPT Web acceptance tasks. It accepts local Workbench requests and authenticated outbound cloud claims, persists exact task/result evidence, and delegates provider transport to AI Input Gateway.

`xuanyuan` is not a universal agent and not a second AI provider transport. It receives governed prompt packages from external systems, persists task and prompt-package evidence, calls AI Input Gateway through its public contract, and returns a stable task/result contract.

## Required

- The job id is `xuanyuan`.
- The plugin root is `src/plugins/xuanyuan/`.
- External website access must enter through Workbench API Boundary.
- External website calls must use `X-GrassEye-Agent-Key`; websites must not call ChatGPT, OpenAI, Gemini, Claude, provider SDKs, or provider web chat directly.
- Local acceptance execution uses `providerKind: "gpt-web-chat"` and never represents a production Provider API.
- A xuanyuan request must carry `requestId`, `sourceProject`, `scenario`, `promptPackageId`, `promptContractId`, `inputRefs`, `textPrompt`, `timeoutMs`, `maxInputChars`, `maxFileCount`, and `maxFileBytes`.
- A xuanyuan request may optionally carry `continuationTaskId` and `continuationResponseHash`. They are one inseparable pair; external callers may never submit a provider conversation URL.
- Before continuation, Xuanyuan must load the prior persisted task and verify `sourceProject`, `providerKind`, `response_captured` status, exact raw-output hash, and a captured provider conversation URL. It then mints the internal AI Input Gateway continuation ref; any mismatch fails closed before provider transport.
- Continuation creates a new Xuanyuan task and new provider lease, but must reuse the exact prior provider conversation. It does not create a workflow engine, hidden third turn, or provider fallback.
- The task must persist request snapshot, prompt package snapshot, input hash proof as returned by AI Input Gateway, the exact raw response text, raw output refs and hash, provider proof, transport warnings, failure reason, and review-required reason.
- When a request carries files, Xuanyuan preserves their declared order and delegates the entire attachment phase to AI Input Gateway child `attach-approved-web-chat-files-once`; Xuanyuan stores only the aggregate proof and never selects a transport.
- The route surface must expose only known xuanyuan routes: `POST /api/xuanyuan/simulate`, `GET /api/xuanyuan/status`, `GET /api/xuanyuan/latest`, and `GET /api/xuanyuan/history`.
- Production Provider API belongs to the server-side website AI owner. Xuanyuan and AI Input Gateway must never hold the website production Provider key or accept production user traffic.
- Once AI Input Gateway captures a complete provider response, Xuanyuan must return `response_captured` with the exact raw text regardless of parsing, schema, tab-close, source-restore, focus, or cleanup outcomes.
- Accepted tasks must enter one durable fair queue. Xuanyuan workers may run multiple independent tasks concurrently up to AI Input Gateway's actual capacity, while callers remain unaware of browser concurrency details.
- Every accepted task must persist a stable `taskId`, governed human-readable `taskName`, label key, source project, scenario and request id before returning 202. Replaying the same `sourceProject + requestId` with the same canonical request returns the original task; a different request under that identity fails closed.
- Process restart must reclaim queued work and exact submitted in-flight work. A submitted task may resume response polling only through the persisted AI Input Gateway system-chat-title plus turn-marker identity; it must never submit the prompt again.
- Queue and progress states must distinguish waiting for runtime capacity, waiting for the serialized single-tab action slot, submitted provider work, response checkpointed, recovery pending and captured response without exposing internal chat title, tab or marker identity. Failure records must retain attempt count, last failure, recoverability, `nextRetryAt` and next action.
- Temporary provider absence before submission, including a missing controlled tab, a composer that is still unavailable, provider capacity/rate limiting, browser disconnection or transient network failure, must persist `recovery_pending` on the same task and retry with bounded backoff. It must not become terminal merely because no provider submission proof exists yet. Login, captcha, two-factor, security barrier or ambiguous identity remains `review_required`; immutable input or request identity defects remain `failed`.
- A configured cloud worker must connect outbound from this machine, enroll or authenticate one named device, heartbeat, claim only leased work, download only lease-bound private inputs, checkpoint submitted work and upload exact results or bounded failures.
- Cloud work must preserve the cloud `jobId`, `sourceTaskId`, `requestHash`, attempt and input hashes as authoritative external bindings while Xuanyuan keeps its own local task identity. A repeated cloud delivery with the same binding resumes or returns the original local task; a conflicting binding fails before provider submission.
- Cloud job capacity is bounded by the lesser of the registered device capacity and AI Input Gateway capacity. Overflow remains in the cloud ledger; there is no second local queue owner.
- Device credentials are stored only in a permission-0600 local credential file or secret environment and are never printed, returned through Workbench routes or copied into task evidence.

## Forbidden

- No second HTTP server, API gateway, route bus, or external dispatcher.
- No website direct provider calls.
- No website-held provider API key.
- No production Provider API key, production user traffic or production fallback inside GrassEye.
- No inbound home port, server callback, reverse tunnel as the normal activation path, or server-initiated connection to the local machine.
- No cloud claim without device authentication and no input download outside the exact active lease.
- No provider SDK or provider web-chat DOM operation inside `src/plugins/xuanyuan/**`.
- No `src/plugins/xuanyuan/**` import from provider adapter files.
- No browser command, selector, coordinate, next action, or action plan accepted from external websites.
- No provider conversation URL, tab id, browser profile, provider selector, or other transport continuation detail accepted from external websites.
- No continuation from a missing, non-captured, different-project, different-provider, or hash-mismatched prior task.
- No cookies, localStorage, sessionStorage, passwords, provider tokens, or browser profile paths in xuanyuan requests.
- No fake success, fallback success, mock production result, or swallowed provider failure.
- No external transport selector, provider DOM instruction, same-attempt fallback, duplicate paste, or lower-bound-only attachment acceptance.
- No AI output controlling browser actions, workflow order, payment, submission, deletion, or other sensitive final actions.
- No JSON parsing, schema validation, normalization, extraction, repair, content judgment, or post-capture downgrade inside Xuanyuan.

## Law IDs

```apex-law
{
  "lawId": "GRASSEYE-XUANYUAN-001-V2",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "xuanyuan",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+acceptance+audit",
  "summary": "Xuanyuan is the single governed local GPT Web acceptance owner, entering through Workbench or authenticated outbound cloud claims and calling AI Input Gateway without production Provider responsibilities.",
  "required": [
    "Known xuanyuan routes exist and are admitted by Workbench API Boundary.",
    "Xuanyuan persists request, prompt package, AI Input Gateway result, provider proof, and parse status.",
    "Cloud delivery binds one server job identity to one persisted local task without exposing provider transport controls.",
    "Production Provider API remains physically outside GrassEye and cannot fall back to local GPT Web.",
    "Optional continuation is authorized only by prior Xuanyuan task id plus exact captured response hash, while Xuanyuan resolves the internal provider conversation ref.",
    "Web Chat files are delegated to the standard AI Input Gateway attachment child and Xuanyuan persists its aggregate terminal proof."
  ],
  "forbidden": [
    "second HTTP server or API gateway",
    "website direct provider call or production provider key inside GrassEye",
    "inbound home port, reverse callback or unleased cloud input",
    "xuanyuan direct provider SDK or web-chat DOM operation",
    "external provider conversation URL or unverified continuation",
    "fake success when provider or parsing fails",
    "external attachment transport selection or duplicate Web Chat file paste"
  ],
  "clauses": [
    {
      "clauseId": "grasseye-xuanyuan-001-requirement",
      "statement": "Xuanyuan is the single governed local GPT Web acceptance owner, entering through Workbench or authenticated outbound cloud claims and calling AI Input Gateway without production Provider responsibilities.",
      "evidenceMode": "acceptance",
      "ownerDomain": "xuanyuan"
    }
  ]
}
```

```apex-law
{
  "lawId": "GRASSEYE-XUANYUAN-002-V2",
  "status": "active",
  "tier": "P0",
  "capabilityDomain": "xuanyuan",
  "enforcementMode": "machine-blocking",
  "evidenceMode": "law+blueprint+acceptance+audit",
  "summary": "Xuanyuan owns one leased durable local task queue with cloud-bound idempotent names, bounded parallel execution, exact checkpoints and cross-restart recovery.",
  "required": [
    "HTTP start persists accepted work before returning 202 and never depends on an untracked fire-and-forget promise.",
    "A single queue owner claims persisted work with lease and heartbeat semantics, runs independent tasks concurrently up to gateway capacity, and leaves overflow queued.",
    "The unique sourceProject plus requestId identity is idempotent: an identical retry returns the original persisted task and a conflicting retry fails before provider work. Each task persists a governed readable taskName derived from an allowlisted label key plus opaque trace.",
    "Restart recovery resumes queued tasks, pre-submit temporary provider unavailability, response-checkpointed tasks and exact submitted gateway attempts without duplicating prompts; every recoverable failure persists nextRetryAt and stays recovery_pending rather than becoming a terminal loss.",
    "Public task progress exposes stable queue, provider-wait, response-checkpointed and recovery-pending states plus attempt and failure trace, but no system chat title, tab id, marker, selector, browser command or caller concurrency control.",
    "The outbound cloud worker authenticates one device, heartbeats and claims lease-bound jobs, then returns checkpoints and exact results without opening an inbound home port."
  ],
  "forbidden": [
    "void fire-and-forget execution as task durability",
    "caller-controlled concurrency or browser identity",
    "duplicate submit on restart",
    "creating a second task for an identical sourceProject plus requestId replay",
    "terminally discarding a submitted or response-checkpointed provider attempt",
    "second queue owner, compatibility queue, shadow executor or legacy serial mode",
    "server-initiated connection to this machine or cloud result without matching job lease"
  ],
  "clauses": [
    {
      "clauseId": "grasseye-xuanyuan-002-requirement",
      "statement": "Xuanyuan owns one leased durable local task queue with cloud-bound idempotent names, bounded parallel execution, exact checkpoints and cross-restart recovery.",
      "evidenceMode": "acceptance",
      "ownerDomain": "xuanyuan"
    }
  ]
}
```
