# GrassEye Local AI Diagnostic Round 1

Date: 2026-04-28
Mode: read-only diagnostics, no business-chain changes

[TIMEOUT_TOOL_MISSING]

- `timeout`: missing
- `gtimeout`: missing
- consequence: no model smoke test was executed in this round because potentially hanging inference commands are forbidden without an external timeout wrapper.

[LOCAL-AI-CURRENT-STATE]

- 当前项目是否真的接入了本地 AI：YES
- 本地 AI 调用入口：`src/lib/local-ai/local-ai-gateway.ts`
- 当前使用的模型名称：vision=`qwen2.5vl:3b`, commentUnderstanding=`qwen2.5:3b`, productSignal=`qwen2.5:3b`, ocr=`apple-vision-or-paddleocr`
- 当前模型文件路径：Ollama manifests under `~/.ollama/models/manifests/registry.ollama.ai/library/qwen2.5/3b` and `~/.ollama/models/manifests/registry.ollama.ai/library/qwen2.5vl/3b`
- 当前模型文件大小：`qwen2.5:3b` layer size `1929903008` bytes, `qwen2.5vl:3b` layer size `3200614720` bytes
- 当前推理框架：vision/text=`ollama` over local HTTP; OCR=`local-ocr` CLI adapter
- 当前是否使用 Metal/GPU：unknown in current project runtime; no direct project-side Metal/MPS detection for Ollama path
- 当前是否使用 CPU：unknown in current project runtime; OCR path can use local CLI engine
- 当前图片尺寸：current runtime captures full Chrome viewport and forwards it as-is
- 当前是否压缩图片：NO
- 当前 prompt 长度：base vision prompt length `694`, then appends schema JSON plus full request input JSON
- 当前 max_tokens：not set in runtime adapter
- 当前 context/window：not set in runtime adapter
- 当前 temperature：not set in runtime adapter
- 当前 timeout：vision `60000ms`, text `30000ms`, OCR `30000ms`
- 当前是否有并发：runtime code path is sequential; no explicit local AI concurrency fan-out found
- 当前是否有循环调用：task loop can invoke local AI once per round for vision, OCR, comment understanding; model health check runs before each request
- 当前失败日志摘要：no persisted real local-AI failure events in `.grasseye-data/state.json`; direct machine probe shows `ollama list` fails with `could not connect to ollama server, run 'ollama serve' to start it`

[LOCAL-AI-ENVIRONMENT]

- Mac 芯片：Apple M2 Pro (`arm64`)
- 内存：16 GB
- CPU 核心：12
- macOS：26.4.1
- Python：project venv `3.11.14`; system python at `/opt/homebrew/bin/python3`
- Node：`v24.4.1`
- Ollama 是否存在：YES, client version `0.21.2`
- llama.cpp 是否存在：NO
- MLX 是否存在：project venv missing `mlx`; MLX model cache exists in HuggingFace cache
- PyTorch MPS 是否可用：unknown in project venv because `torch` is not installed there
- Transformers 是否可用：NO in project venv
- 当前环境最大风险：Ollama client exists but daemon is not running, while screenshot inputs are full-viewport PNG with no resize/compress boundary

[LOCAL-MODEL-INVENTORY]

- model name: `qwen2.5:3b`
  - path: `~/.ollama/models/manifests/registry.ollama.ai/library/qwen2.5/3b`
  - file size: manifest points to model layer `1929903008` bytes
  - type: text-only
  - quantization: unknown
  - estimated RAM requirement: about 3-5 GB
  - suitable for current Mac: YES
  - risk: low

- model name: `qwen2.5vl:3b`
  - path: `~/.ollama/models/manifests/registry.ollama.ai/library/qwen2.5vl/3b`
  - file size: manifest points to model layer `3200614720` bytes
  - type: vision-language
  - quantization: unknown
  - estimated RAM requirement: about 5-8 GB
  - suitable for current Mac: YES
  - risk: medium

- model name: `Qwen2.5-7B-Instruct`
  - path: `~/.cache/huggingface/hub/models--Qwen--Qwen2.5-7B-Instruct`
  - file size: `14G`
  - type: text-only
  - quantization: unknown
  - estimated RAM requirement: high, likely >14 GB effective runtime footprint
  - suitable for current Mac: NO
  - risk: high

- model name: `mlx-community/Qwen2.5-7B-Instruct-8bit`
  - path: `~/.cache/huggingface/hub/models--mlx-community--Qwen2.5-7B-Instruct-8bit`
  - file size: `7.5G`
  - type: text-only
  - quantization: 8bit
  - estimated RAM requirement: about 8-10 GB
  - suitable for current Mac: UNKNOWN
  - risk: high

- model name: `mlx-community/Qwen2.5-7B-Instruct-4bit`
  - path: `~/.cache/huggingface/hub/models--mlx-community--Qwen2.5-7B-Instruct-4bit`
  - file size: `4.0G`
  - type: text-only
  - quantization: 4bit
  - estimated RAM requirement: about 5-7 GB
  - suitable for current Mac: YES
  - risk: medium

- model name: `Systran/faster-whisper-large-v3`
  - path: `~/.cache/huggingface/hub/models--Systran--faster-whisper-large-v3`
  - file size: `2.9G`
  - type: unknown
  - quantization: unknown
  - estimated RAM requirement: about 3-5 GB
  - suitable for current Mac: YES
  - risk: medium

- model name: `Systran/faster-whisper-base`
  - path: `~/.cache/huggingface/hub/models--Systran--faster-whisper-base`
  - file size: `141M`
  - type: unknown
  - quantization: unknown
  - estimated RAM requirement: low
  - suitable for current Mac: YES
  - risk: low

- model name: `mlx-community/whisper-tiny`
  - path: `~/.cache/huggingface/hub/models--mlx-community--whisper-tiny`
  - file size: `71M`
  - type: unknown
  - quantization: unknown
  - estimated RAM requirement: very low
  - suitable for current Mac: YES
  - risk: low

- model name: `mlx-community/whisper-large-v3-turbo`
  - path: `~/.cache/huggingface/hub/models--mlx-community--whisper-large-v3-turbo`
  - file size: `1.5G`
  - type: unknown
  - quantization: unknown
  - estimated RAM requirement: low to medium
  - suitable for current Mac: YES
  - risk: low

[TEXT-SMOKE-TEST]

- tested model: not executed
- command: not executed
- duration: not executed
- stdout: not executed
- stderr: not executed
- exit code: not executed
- result: not executed because `[TIMEOUT_TOOL_MISSING]`

[VISION-SMOKE-TEST]

- tested model: not executed
- image path: not executed
- image size: not executed
- command: not executed
- duration: not executed
- stdout: not executed
- stderr: not executed
- exit code: not executed
- memory observation: not executed
- result: not executed because `[TIMEOUT_TOOL_MISSING]`

[LOCAL-AI-PARAMETER-RISK]

| 风险项 | 是否存在 | 证据文件 | 风险等级 | 修复建议 |
| --- | --- | --- | --- | --- |
| 原图直接送入模型，未压缩 | YES | `src/lib/browser/current-chrome-browser-controller.ts`, `src/lib/local-ai/runtime-adapters/ollama-runtime-adapter.ts` | high | add resize/downscale before base64 encode |
| 截图尺寸超过 1280 宽 | POSSIBLE | `src/lib/browser/current-chrome-browser-controller.ts` | high | clamp viewport capture or post-process image to <= 512/768 |
| 一次发送多张超大图 | NO in current path | `src/lib/mission-runtime/mission-runtime-executor.ts` | low | keep image count at 1 until a safe multi-frame path exists |
| context 太大 | not configured | `src/lib/local-ai/runtime-adapter-utils.ts`, `src/lib/local-ai/runtime-adapters/ollama-runtime-adapter.ts` | medium | set explicit small request options |
| max_tokens 太大 | not configured | `src/lib/local-ai/runtime-adapters/ollama-runtime-adapter.ts` | medium | set explicit output token limit |
| batch size 太大 | NO explicit batch | local AI runtime path | low | keep batch = 1 |
| 没有 timeout | PARTIAL | `src/lib/local-ai/local-ai-runtime-execution.ts`, `src/lib/mission-runtime/mission-runtime-executor.ts` | medium | keep request timeout and add external process-level timeout in diagnostics and ops scripts |
| 没有进程 kill 机制 | YES for Ollama HTTP path | current runtime path | high | add operator-safe external watchdog or dedicated local-ai smoke wrapper |
| 没有压缩图像 | YES | `src/lib/browser/current-chrome-browser-controller.ts`, `src/lib/local-ai/runtime-adapters/runtime-adapter-utils.ts` | high | resize/compress PNG before base64 upload |
| 循环中重复加载模型 | POSSIBLE | `src/lib/mission-runtime/mission-runtime-executor.ts`, `src/lib/local-ai/local-ai-gateway.ts` | medium | warm daemon once and avoid first-request cold start inside runtime loop |
| 每次请求都重新初始化模型 | UNKNOWN at Ollama server level | runtime uses stateless HTTP generate | medium | keep Ollama daemon warm and verify model residency out-of-band |
| 多模型同时加载 | POSSIBLE by configuration | `config/local-ai.models.json` | medium | keep only vision/text models needed for current run alive |
| 并发调用本地 AI | NO explicit concurrency | current runtime path | low | preserve concurrency=1 |
| Metal/GPU backend 未正确启用 | UNKNOWN | no project-side check | medium | inspect Ollama runtime config separately before main-chain use |
| CPU-only 跑超大视觉模型 | POSSIBLE if Ollama falls back | machine + runtime gap | high | confirm Ollama acceleration before any live run |
| 模型量化过高，如 fp16 / Q8 太大 | YES in cached alternatives | HF cache inventory | medium | prefer 3B or 4bit models on 16 GB machine |
| 模型不是视觉模型却被当视觉模型使用 | NO in config | `config/local-ai.models.json` | low | keep vision bound to `qwen2.5vl:3b` |
| 日志没有记录模型响应时间 | YES for persisted evidence reviewed | `.grasseye-data/state.json` and runtime logs absence | medium | persist per-request latency and runtime error class |

[ROOT-CAUSE-CLASSIFICATION]

- primary cause: `L LOGGING_INSUFFICIENT`
- secondary causes: `D NO_TIMEOUT`
- evidence:
  - `.grasseye-data/state.json` contains `structuredRuntimeEvents=0` for the inspected data
  - no persisted `local_ai_runtime_unavailable` or `local_ai_task_failed` events were found
  - direct machine probe shows `ollama list` fails because the Ollama server is not running
  - project Python environment contains no `torch`, `mlx`, `transformers`, or `llama_cpp`
  - screenshot pipeline captures full viewport PNG and forwards it without resize/compress
- confidence: medium
- next minimal fix: first restore observable runtime by starting Ollama explicitly outside the browser chain and adding a safe external timeout wrapper; then test one 512px single-image request only

[SAFE-LOCAL-AI-PRESET]

- model: `qwen2.5vl:3b`
- framework: `ollama`
- image max width: `512`
- image count per request: `1`
- timeout: `60s`
- max output tokens: `64`
- context: `<= 2048`
- batch: `1`
- concurrency: `1`
- preload model: YES, start daemon before runtime and avoid cold boot inside agent loop
- unload policy: keep one small model warm during diagnosis, unload after session
- CPU/GPU setting: prefer Ollama with Apple Silicon acceleration enabled; do not proceed if acceleration status is unknown
- expected latency: `8s - 20s` target for a single small image on this machine, but not verified in this round
- risk: medium

[LOCAL-AI-FITNESS-VERDICT]

- verdict: `BLOCKED_INSUFFICIENT_DATA`
- evidence:
  - current machine is capable enough on paper for 3B local models
  - configured models are cached locally
  - current runtime is not operational because Ollama server is unreachable
  - no safe timeout wrapper is installed, so smoke tests were not allowed
  - persisted logs are insufficient to prove the actual pre-freeze failure path

[FINAL-LOCAL-AI-DIAGNOSTIC-REPORT]

1. 当前本地 AI 是否真的安装：PARTIAL. Ollama client and local model cache exist; project Python runtime dependencies do not.
2. 当前是否有 vision-capable 模型：YES, `qwen2.5vl:3b` is cached in Ollama manifests.
3. 文本 smoke test：未执行，因 `[TIMEOUT_TOOL_MISSING]`.
4. 视觉 smoke test：未执行，因 `[TIMEOUT_TOOL_MISSING]`.
5. 失败/卡死根因：当前唯一被直接证实的失败是 Ollama daemon 不可达；真正“卡死”根因因日志不足无法闭环证明。
6. 是否因为参数设置错误：存在高风险参数问题，尤其是原始 viewport PNG 直送模型且未限输出参数。
7. 是否因为图片太大：存在高风险，但本轮未执行推理，无法直接实证。
8. 是否因为模型太大：当前主配置 3B 模型不是明显过大；缓存中的 7B 模型对 16 GB 机器风险高。
9. 是否因为 CPU-only：未知，当前项目没有拿到 Ollama 的加速状态证据。
10. 是否因为 Metal/MPS/MLX 未启用：未知，当前项目运行面没有证明它已启用。
11. 是否因为重复加载模型：存在冷启动/重复请求风险，但本轮未实测。
12. 是否因为没有 timeout：诊断层面 YES；项目内部请求层有 timeout，但缺外部 kill 约束。
13. 推荐最小安全参数：see `[SAFE-LOCAL-AI-PRESET]`.
14. 是否适合作为主链：`BLOCKED_INSUFFICIENT_DATA`.
15. 修改文件：none in business chain.
16. 新增诊断文件：`tools/local-ai-diagnostics/diagnose-local-ai.md`
17. 未修改业务文件确认：YES
18. 下一轮建议：install `gtimeout` or equivalent first, then run one text smoke test and one 512px single-image vision smoke test against a manually started Ollama daemon.

## Round 2 Safe Ollama Smoke Test

Date: 2026-04-28
Mode: isolated diagnostic execution, no business-chain changes

[ROUND-2-CURRENT-STATE]

- 当前视觉模型：`qwen2.5vl:3b`
- 当前文本模型：`qwen2.5:3b`
- 当前 Ollama base URL：`http://127.0.0.1:11434`
- 当前是否已有独立安全 smoke script：NO before this round
- 本轮是否允许修改业务主链：NO

[ROUND-2-EXECUTION]

- 执行脚本：`node tools/local-ai-diagnostics/safe-ollama-smoke-test.mjs`
- 新增脚本：`tools/local-ai-diagnostics/safe-ollama-smoke-test.mjs`
- 结果文件：`tools/local-ai-diagnostics/results/ollama-smoke-result.json`
- daemon 日志：`tools/local-ai-diagnostics/results/ollama-daemon.log`
- 测试图片：`tools/local-ai-diagnostics/test-assets/local-vision-smoke.png`
- 运行方式：单进程、单请求串行、全部使用 `AbortController` 限时，无 `timeout` / `gtimeout` 依赖

[ROUND-2-DAEMON-RESULT]

- daemon 启动前可达：NO
- 安全启动方式：先尝试 `open -a Ollama`，未恢复后回退到后台 `ollama serve`
- daemon 启动后可达：YES
- daemon 启动后识别到的模型：`qwen2.5:3b`, `qwen2.5vl:3b`
- Ollama 启动日志确认：server listened on `127.0.0.1:11434`，并识别到 `Apple M2 Pro` Metal 设备

[ROUND-2-TEXT-SMOKE]

- 模型：`qwen2.5:3b`
- 请求约束：`keep_alive=30s`, `num_predict=8`, `num_ctx=512`, `temperature=0`, `stream=false`
- timeout：`45s`
- 实际耗时：`22891ms`
- 响应预览：`OK`
- 结果：PASS

[ROUND-2-VISION-SMOKE]

- 模型：`qwen2.5vl:3b`
- 输入图片：`tools/local-ai-diagnostics/test-assets/local-vision-smoke.png`
- 图片规格：`512x512`，白底，单个红色方块，文字 `RED BOX`
- 请求约束：`keep_alive=30s`, `num_predict=32`, `num_ctx=1024`, `temperature=0`, `stream=false`
- timeout：`90s`
- 实际耗时：`21072ms`
- 响应预览：`{"ok": true, "label": "red box"}`
- 结果：PASS

[ROUND-2-SAFETY-OBSERVATION]

- 本轮未观察到 timeout
- 本轮未观察到 OOM 证据
- 本轮脚本执行期间未出现可证明的系统卡死证据
- 本轮证明的问题边界：Ollama daemon 缺失可以被安全启动修复；在小图、低输出、低上下文约束下，文本与视觉最小链路均可用

[ROUND-2-VERDICT]

- 结论：`LOCAL_AI_RUNTIME_OK`
- 是否可以继续调试本地视觉主链：YES，但下一轮必须继续保持单张真实浏览器区域截图、宽度不超过 `512px`、单请求、串行、有限输出参数，不得直接恢复全 viewport 原图链路
- 本轮未修改业务文件确认：YES