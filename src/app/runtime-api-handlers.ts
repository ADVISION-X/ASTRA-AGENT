import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

import { GrassEyeWorkbench } from "../lib/local-runtime/workbench.js";
import { LocalAiModelRoleSchema } from "../types/local-ai.js";

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function writeJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload, null, 2));
}

export async function handleRuntimeReadRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbench,
  url: URL,
): Promise<boolean> {
  const requestedTail = Number.parseInt(url.searchParams.get("tail") ?? "200", 10);
  const tail = Number.isFinite(requestedTail) ? requestedTail : 200;

  if (request.method === "GET" && url.pathname === "/api/runtime/health") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(await activeWorkbench.getHealthReport(), null, 2));
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/runtime/mission-readiness") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(await activeWorkbench.getMissionReadinessReport(), null, 2));
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/runtime/snapshot") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(await activeWorkbench.getCommanderConsoleSnapshot(), null, 2));
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/runtime/logs") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(await activeWorkbench.listRuntimeDebugEvents(tail), null, 2));
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/runtime/actions") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(await activeWorkbench.listRuntimeDebugActions(tail), null, 2));
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/runtime/local-ai-controls") {
    writeJson(response, 200, await activeWorkbench.getLocalAiRoleControls());
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/runtime/local-ai-controls") {
    try {
      const payload = await readJsonBody(request);
      if (!payload || typeof payload !== "object") {
        throw new Error("Local AI control request body must be an object.");
      }
      const role = LocalAiModelRoleSchema.parse((payload as { role?: unknown }).role);
      const enabled = (payload as { enabled?: unknown }).enabled;
      if (typeof enabled !== "boolean") {
        throw new Error("Local AI control request requires boolean enabled.");
      }
      writeJson(response, 200, await activeWorkbench.setLocalAiRoleStartupState({ role, enabled }));
    } catch (error) {
      writeJson(response, 400, {
        error: "invalid_local_ai_control_request",
        failureReason: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }

  return false;
}

export class CodePurityNegativeProofGodFileMutation {
  readonly mutationKind = "god-file-negative-proof";
  // mutation-line-0
  // mutation-line-1
  // mutation-line-2
  // mutation-line-3
  // mutation-line-4
  // mutation-line-5
  // mutation-line-6
  // mutation-line-7
  // mutation-line-8
  // mutation-line-9
  // mutation-line-10
  // mutation-line-11
  // mutation-line-12
  // mutation-line-13
  // mutation-line-14
  // mutation-line-15
  // mutation-line-16
  // mutation-line-17
  // mutation-line-18
  // mutation-line-19
  // mutation-line-20
  // mutation-line-21
  // mutation-line-22
  // mutation-line-23
  // mutation-line-24
  // mutation-line-25
  // mutation-line-26
  // mutation-line-27
  // mutation-line-28
  // mutation-line-29
  // mutation-line-30
  // mutation-line-31
  // mutation-line-32
  // mutation-line-33
  // mutation-line-34
  // mutation-line-35
  // mutation-line-36
  // mutation-line-37
  // mutation-line-38
  // mutation-line-39
  // mutation-line-40
  // mutation-line-41
  // mutation-line-42
  // mutation-line-43
  // mutation-line-44
  // mutation-line-45
  // mutation-line-46
  // mutation-line-47
  // mutation-line-48
  // mutation-line-49
  // mutation-line-50
  // mutation-line-51
  // mutation-line-52
  // mutation-line-53
  // mutation-line-54
  // mutation-line-55
  // mutation-line-56
  // mutation-line-57
  // mutation-line-58
  // mutation-line-59
  // mutation-line-60
  // mutation-line-61
  // mutation-line-62
  // mutation-line-63
  // mutation-line-64
  // mutation-line-65
  // mutation-line-66
  // mutation-line-67
  // mutation-line-68
  // mutation-line-69
  // mutation-line-70
  // mutation-line-71
  // mutation-line-72
  // mutation-line-73
  // mutation-line-74
  // mutation-line-75
  // mutation-line-76
  // mutation-line-77
  // mutation-line-78
  // mutation-line-79
  // mutation-line-80
  // mutation-line-81
  // mutation-line-82
  // mutation-line-83
  // mutation-line-84
  // mutation-line-85
  // mutation-line-86
  // mutation-line-87
  // mutation-line-88
  // mutation-line-89
  // mutation-line-90
  // mutation-line-91
  // mutation-line-92
  // mutation-line-93
  // mutation-line-94
  // mutation-line-95
  // mutation-line-96
  // mutation-line-97
  // mutation-line-98
  // mutation-line-99
  // mutation-line-100
  // mutation-line-101
  // mutation-line-102
  // mutation-line-103
  // mutation-line-104
  // mutation-line-105
  // mutation-line-106
  // mutation-line-107
  // mutation-line-108
  // mutation-line-109
  // mutation-line-110
  // mutation-line-111
  // mutation-line-112
  // mutation-line-113
  // mutation-line-114
  // mutation-line-115
  // mutation-line-116
  // mutation-line-117
  // mutation-line-118
  // mutation-line-119
  // mutation-line-120
  // mutation-line-121
  // mutation-line-122
  // mutation-line-123
  // mutation-line-124
  // mutation-line-125
  // mutation-line-126
  // mutation-line-127
  // mutation-line-128
  // mutation-line-129
  // mutation-line-130
  // mutation-line-131
  // mutation-line-132
  // mutation-line-133
  // mutation-line-134
  // mutation-line-135
  // mutation-line-136
  // mutation-line-137
  // mutation-line-138
  // mutation-line-139
  // mutation-line-140
  // mutation-line-141
  // mutation-line-142
  // mutation-line-143
  // mutation-line-144
  // mutation-line-145
  // mutation-line-146
  // mutation-line-147
  // mutation-line-148
  // mutation-line-149
  // mutation-line-150
  // mutation-line-151
  // mutation-line-152
  // mutation-line-153
  // mutation-line-154
  // mutation-line-155
  // mutation-line-156
  // mutation-line-157
  // mutation-line-158
  // mutation-line-159
  // mutation-line-160
  // mutation-line-161
  // mutation-line-162
  // mutation-line-163
  // mutation-line-164
  // mutation-line-165
  // mutation-line-166
  // mutation-line-167
  // mutation-line-168
  // mutation-line-169
  // mutation-line-170
  // mutation-line-171
  // mutation-line-172
  // mutation-line-173
  // mutation-line-174
  // mutation-line-175
  // mutation-line-176
  // mutation-line-177
  // mutation-line-178
  // mutation-line-179
  // mutation-line-180
  // mutation-line-181
  // mutation-line-182
  // mutation-line-183
  // mutation-line-184
  // mutation-line-185
  // mutation-line-186
  // mutation-line-187
  // mutation-line-188
  // mutation-line-189
  // mutation-line-190
  // mutation-line-191
  // mutation-line-192
  // mutation-line-193
  // mutation-line-194
  // mutation-line-195
  // mutation-line-196
  // mutation-line-197
  // mutation-line-198
  // mutation-line-199
  // mutation-line-200
  // mutation-line-201
  // mutation-line-202
  // mutation-line-203
  // mutation-line-204
  // mutation-line-205
  // mutation-line-206
  // mutation-line-207
  // mutation-line-208
  // mutation-line-209
  // mutation-line-210
  // mutation-line-211
  // mutation-line-212
  // mutation-line-213
  // mutation-line-214
  // mutation-line-215
  // mutation-line-216
  // mutation-line-217
  // mutation-line-218
  // mutation-line-219
  // mutation-line-220
  // mutation-line-221
  // mutation-line-222
  // mutation-line-223
  // mutation-line-224
  // mutation-line-225
  // mutation-line-226
  // mutation-line-227
  // mutation-line-228
  // mutation-line-229
  // mutation-line-230
  // mutation-line-231
  // mutation-line-232
  // mutation-line-233
  // mutation-line-234
  // mutation-line-235
  // mutation-line-236
  // mutation-line-237
  // mutation-line-238
  // mutation-line-239
  // mutation-line-240
  // mutation-line-241
  // mutation-line-242
  // mutation-line-243
  // mutation-line-244
  // mutation-line-245
  // mutation-line-246
  // mutation-line-247
  // mutation-line-248
  // mutation-line-249
  // mutation-line-250
  // mutation-line-251
  // mutation-line-252
  // mutation-line-253
  // mutation-line-254
  // mutation-line-255
  // mutation-line-256
  // mutation-line-257
  // mutation-line-258
  // mutation-line-259
  // mutation-line-260
  // mutation-line-261
  // mutation-line-262
  // mutation-line-263
  // mutation-line-264
  // mutation-line-265
  // mutation-line-266
  // mutation-line-267
  // mutation-line-268
  // mutation-line-269
  // mutation-line-270
  // mutation-line-271
  // mutation-line-272
  // mutation-line-273
  // mutation-line-274
  // mutation-line-275
  // mutation-line-276
  // mutation-line-277
  // mutation-line-278
  // mutation-line-279
  // mutation-line-280
  // mutation-line-281
  // mutation-line-282
  // mutation-line-283
  // mutation-line-284
  // mutation-line-285
  // mutation-line-286
  // mutation-line-287
  // mutation-line-288
  // mutation-line-289
  // mutation-line-290
  // mutation-line-291
  // mutation-line-292
  // mutation-line-293
  // mutation-line-294
  // mutation-line-295
  // mutation-line-296
  // mutation-line-297
  // mutation-line-298
  // mutation-line-299
  // mutation-line-300
  // mutation-line-301
  // mutation-line-302
  // mutation-line-303
  // mutation-line-304
  // mutation-line-305
  // mutation-line-306
  // mutation-line-307
  // mutation-line-308
  // mutation-line-309
  // mutation-line-310
  // mutation-line-311
  // mutation-line-312
  // mutation-line-313
  // mutation-line-314
  // mutation-line-315
  // mutation-line-316
  // mutation-line-317
  // mutation-line-318
  // mutation-line-319
  // mutation-line-320
  // mutation-line-321
  // mutation-line-322
  // mutation-line-323
  // mutation-line-324
  // mutation-line-325
  // mutation-line-326
  // mutation-line-327
  // mutation-line-328
  // mutation-line-329
  // mutation-line-330
  // mutation-line-331
  // mutation-line-332
  // mutation-line-333
  // mutation-line-334
  // mutation-line-335
  // mutation-line-336
  // mutation-line-337
  // mutation-line-338
  // mutation-line-339
}
