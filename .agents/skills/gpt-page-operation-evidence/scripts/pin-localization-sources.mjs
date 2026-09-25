import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { gptAttachmentProviderDisplayName } from "../../../../src/capabilities/gpt/schema.ts";

const sha = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const stable = (value) => Array.isArray(value) ? value.map(stable)
  : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort()
    .map((key) => [key, stable(value[key])])) : value;
const fail = (code) => { throw new Error(code); };
const ids = [
  ["zh-HK", "aiprod_f2366c41-f082-4111-a287-35c0ab191064"],
  ["zh-TW", "aiprod_6f5fc276-d9a1-44df-a2cb-c704206b9cc1"],
  ["en-US", "aiprod_d97f9318-4672-48f7-9331-e397c0675ae0"],
  ["ja-JP", "aiprod_c35f1eb7-9c5e-42c0-8ad9-3ed4630df3ec"],
  ["ko-KR", "aiprod_91ada47a-9810-440c-aa7e-d2b6b31c7d82"],
];
const roles = ["source_content", "terminology", "locale_policy", "render_policy"];
const rootSeoJobId = "aiprod_d5840bd0-c518-486c-bdbe-06e690f28332";

export async function pinLocalizationSources({ agentRepo, websiteRepo, profilePath, outputDir }) {
  process.loadEnvFile(join(resolve(websiteRepo), ".env.local"));
  const requireWebsite = createRequire(join(resolve(websiteRepo), "package.json"));
  const { Client } = requireWebsite("pg");
  const { readAiProductionInputObject } = await import(pathToFileURL(join(resolve(websiteRepo),
    "services/api/src/ai-production/private-object-store.ts")).href);
  const profile = JSON.parse(await readFile(profilePath, "utf8"));
  const client = new Client({ host: profile.socket_path, database: profile.database, user: profile.role });
  const db = new DatabaseSync(join(resolve(agentRepo), ".grasseye-local/production-runtime.sqlite"),
    { readOnly: true });
  const output = resolve(outputDir);
  const privateDir = join(output, "private-localization");
  const routeCatalog = JSON.parse(await readFile(join(resolve(agentRepo),
    "src/lib/local-runtime/production/website-agent-route-policies.v1.json"), "utf8"));
  const codePaths = ["src/plugins/localization-production/flow.ts",
    "src/plugins/localization-production/result-contract.ts",
    "src/plugins/localization-production/SKILL.md",
    "src/mediator/product-plugin-catalog.ts", "src/capabilities/gpt/schema.ts",
    "src/lib/local-runtime/production/website-agent-route-policies.v1.json"];
  const sourceCodeHashes = Object.fromEntries(await Promise.all(codePaths.map(async (path) =>
    [path, sha(await readFile(join(resolve(agentRepo), path)))])));
  const route = routeCatalog.routes.filter((entry) => entry.product_id === "localization_article_translation"
    && entry.action_id === "article_translation");
  if (route.length !== 1 || route[0].relation_kind !== "provider_continuation") fail("LOCALIZATION_ROUTE_DRIFT");
  await client.connect();
  let publicEntries = [], privateEntries = [], parentId = rootSeoJobId;
  let sourceIdentity = null, rootArticleReadback = null;
  try {
    await client.query("begin read only");
    for (const [locale, id] of ids) {
      const agent = db.prepare("select task_json,status from production_tasks where job_id=?").get(id);
      if (!agent || agent.status !== "completed") fail(`LOCALIZATION_AGENT_TASK_MISSING:${locale}`);
      const task = JSON.parse(agent.task_json);
      const website = (await client.query(`select job_id,request_hash,product_id,action_id,parameters_json,
        material_refs_json,parent_task_ref,parent_result_ref,parent_result_hash,result_json
        from ai_production_jobs where job_id=$1`, [id])).rows;
      if (website.length !== 1) fail(`LOCALIZATION_WEBSITE_TASK_MISSING:${locale}`);
      const job = website[0];
      if (task.job_id !== id || job.job_id !== id || task.request_hash !== job.request_hash
        || task.product_id !== job.product_id || task.action_id !== job.action_id
        || task.product_id !== "localization_article_translation" || task.action_id !== "article_translation"
        || task.parameters.target_locale !== locale
        || JSON.stringify(stable(task.parameters)) !== JSON.stringify(stable(job.parameters_json))
        || JSON.stringify(stable(task.material_refs)) !== JSON.stringify(stable(job.material_refs_json))
        || task.parent_task_ref !== parentId || job.parent_task_ref !== parentId
        || task.parent_result_ref !== job.parent_result_ref
        || task.parent_result_hash !== job.parent_result_hash) fail(`LOCALIZATION_TASK_IDENTITY_DRIFT:${locale}`);
      const parent = (await client.query(`select product_id,action_id,result_json from ai_production_jobs
        where job_id=$1`, [parentId])).rows;
      const parentRuntime = (await client.query(`select terminal_status,accepted_at,business_consumed_at,
        business_consumer_ref,business_consumer_error
        from ai_production_job_runtime where job_id=$1`, [parentId])).rows;
      if (parent.length !== 1 || !parent[0].result_json
        || parentRuntime.length !== 1 || parentRuntime[0].terminal_status !== "completed"
        || !parentRuntime[0].accepted_at || !parentRuntime[0].business_consumed_at
        || !parentRuntime[0].business_consumer_ref || parentRuntime[0].business_consumer_error
        || (locale === "zh-HK" && (parent[0].product_id !== "public_knowledge_article_pipeline"
          || parent[0].action_id !== "produce_article"))
        || (locale !== "zh-HK" && (parent[0].product_id !== "localization_article_translation"
          || parent[0].action_id !== "article_translation"))
        || parent[0].result_json.result_payload_hash !== task.parent_result_hash
        || parent[0].result_json.result_payload_ref !== task.parent_result_ref) {
        fail(`LOCALIZATION_PARENT_RESULT_DRIFT:${locale}`);
      }
      const identity = [task.parameters.source_resource_id, task.parameters.source_version,
        task.parameters.source_sha256];
      if (sourceIdentity && JSON.stringify(identity) !== JSON.stringify(sourceIdentity)) {
        fail(`LOCALIZATION_SOURCE_ROOT_DRIFT:${locale}`);
      }
      sourceIdentity ??= identity;
      const bindings = (await client.query(`select m.material_id,m.ordinal,m.role,m.display_name,m.object_ref,
        m.sha256,m.byte_count,m.media_type,m.storage_class,m.owner_scope_hash,m.material_blob_id,
        b.canonical_object_ref,b.sha256 as blob_sha256,b.byte_count as blob_byte_count
        from ai_production_job_materials m left join ai_production_material_blobs b
          on b.material_blob_id=m.material_blob_id where m.job_id=$1 order by m.ordinal`, [id])).rows;
      if (bindings.length !== 4 || task.material_refs.length !== 4) fail(`LOCALIZATION_MATERIAL_COUNT:${locale}`);
      const folder = join(resolve(agentRepo), ".grasseye-local/plugin-tasks/production-runtime", id, "materials");
      const names = (await readdir(folder)).sort();
      if (JSON.stringify(names) !== JSON.stringify(roles.map((role) => `${role}.json`).sort())) {
        fail(`LOCALIZATION_MATERIAL_SET:${locale}`);
      }
      const materials = [];
      for (let ordinal = 0; ordinal < 4; ordinal++) {
        const ref = task.material_refs[ordinal], binding = bindings[ordinal], role = roles[ordinal];
        if (ref.role !== role || ref.ordinal !== ordinal || binding.role !== role || binding.ordinal !== ordinal
          || ref.material_id !== binding.material_id || ref.display_name !== binding.display_name
          || ref.object_ref !== binding.object_ref || ref.sha256 !== binding.sha256
          || ref.bytes !== Number(binding.byte_count) || binding.sha256 !== binding.blob_sha256
          || Number(binding.byte_count) !== Number(binding.blob_byte_count)
          || binding.object_ref !== binding.canonical_object_ref
          || binding.storage_class !== "private_owner_scoped" || !binding.owner_scope_hash) {
          fail(`LOCALIZATION_MATERIAL_IDENTITY:${locale}:${role}`);
        }
        const bytes = await readFile(join(folder, ref.display_name));
        if (bytes.length !== ref.bytes || sha(bytes) !== ref.sha256) fail(`LOCALIZATION_MATERIAL_BYTES:${locale}:${role}`);
        const websiteBytes = Buffer.from(await readAiProductionInputObject({ objectRef: ref.object_ref,
          expectedHash: ref.sha256, expectedBytes: ref.bytes }));
        if (!websiteBytes.equals(bytes)) fail(`LOCALIZATION_WEBSITE_OBJECT_BYTES:${locale}:${role}`);
        if (role === "source_content") {
          const source = JSON.parse(bytes.toString("utf8"));
          if (source.canonical_article_id !== task.parameters.source_resource_id
            || source.canonical_admitted_version !== task.parameters.source_version
            || source.canonical_admitted_hash !== task.parameters.source_sha256
            || source.locale !== locale) fail(`LOCALIZATION_SOURCE_CONTENT_IDENTITY:${locale}`);
        }
        materials.push({ role, ordinal, displayName: ref.display_name, bytes: ref.bytes,
          sha256: ref.sha256, materialIdHash: sha(ref.material_id),
          ownerScopeHashDigest: sha(binding.owner_scope_hash) });
      }
      const batches = (await client.query(`select jobs_json from ai_production_claim_batch_receipts
        where jobs_json::text like $1 order by created_at`, [`%${id}%`])).rows;
      const grants = batches.flatMap((batch) => batch.jobs_json).filter((entry) => entry.job_id === id);
      const runtime = (await client.query(`select attempt_id,terminal_status,accepted_at,
        business_consumed_at,business_consumer_ref,business_consumer_error
        from ai_production_job_runtime where job_id=$1`, [id])).rows;
      const matchingGrants = grants.filter((entry) => entry.grant?.attempt_id === runtime[0]?.attempt_id);
      const finalGrant = matchingGrants[0];
      if (runtime.length !== 1 || runtime[0].terminal_status !== "completed"
        || !runtime[0].accepted_at || !runtime[0].business_consumed_at
        || !runtime[0].business_consumer_ref || runtime[0].business_consumer_error
        || matchingGrants.length !== 1
        || !Number.isSafeInteger(finalGrant.grant.result_revision)
        || !("prior_result_rejection" in finalGrant.grant)) fail(`LOCALIZATION_RESULT_REVISION_MISSING:${locale}`);
      const parentReadback = { parentJobId: parentId,
        resultPayloadRef: parent[0].result_json.result_payload_ref,
        resultPayloadHash: parent[0].result_json.result_payload_hash,
        terminalStatus: parentRuntime[0].terminal_status,
        acceptedAt: parentRuntime[0].accepted_at,
        businessConsumedAt: parentRuntime[0].business_consumed_at,
        businessConsumerRefHash: sha(parentRuntime[0].business_consumer_ref) };
      privateEntries.push({ locale, task, route: route[0], parentReadback, resultRevision: {
        revision: finalGrant.grant.result_revision,
        priorRejection: finalGrant.grant.prior_result_rejection }, materials });
      publicEntries.push({ locale, jobIdHash: sha(id), requestHash: task.request_hash,
        taskEnvelopeHash: sha(agent.task_json), parentJobIdHash: sha(parentId),
        parentResultHash: task.parent_result_hash, sourceResourceIdHash: sha(identity[0]),
        parentReadbackHash: sha(JSON.stringify(parentReadback)),
        sourceVersionHash: sha(identity[1]), sourceSha256: identity[2],
        resultRevisionHash: sha(JSON.stringify(privateEntries.at(-1).resultRevision)), materials });
      parentId = id;
    }
    const runs = (await client.query(`select status,article_id,admission_receipt_hash
      from public_knowledge_runs where ai_production_job_id=$1`, [rootSeoJobId])).rows;
    if (runs.length !== 1 || runs[0].status !== "admitted" || !runs[0].admission_receipt_hash) {
      fail("LOCALIZATION_ROOT_SEO_NOT_ADMITTED");
    }
    const articles = (await client.query(`select article_id,manifest_json,article_markdown_hash,admitted_at
      from public_knowledge_articles where article_id=$1`, [runs[0].article_id])).rows;
    if (articles.length !== 1 || !articles[0].admitted_at
      || articles[0].article_id !== sourceIdentity[0]
      || articles[0].manifest_json?.schema_version !== sourceIdentity[1]
      || articles[0].article_markdown_hash !== sourceIdentity[2]) {
      fail("LOCALIZATION_ROOT_ARTICLE_IDENTITY_DRIFT");
    }
    rootArticleReadback = { articleIdHash: sha(articles[0].article_id),
      sourceVersionHash: sha(articles[0].manifest_json.schema_version),
      articleMarkdownHash: articles[0].article_markdown_hash,
      admissionReceiptHash: runs[0].admission_receipt_hash };
    await client.query("commit");
  } catch (error) { await client.query("rollback").catch(() => {}); throw error; }
  finally { db.close(); await client.end(); }
  await mkdir(privateDir, { recursive: true, mode: 0o700 });
  for (const entry of privateEntries) {
    const folder = join(privateDir, entry.locale);
    await mkdir(folder, { recursive: true, mode: 0o700 });
    await mkdir(join(folder, "provider-upload"), { recursive: true, mode: 0o700 });
    await writeFile(join(folder, "task-and-route.json"), JSON.stringify({ task: entry.task,
      route: entry.route, parentReadback: entry.parentReadback,
      resultRevision: entry.resultRevision }), { mode: 0o600 });
    for (const material of entry.materials) {
      const original = join(resolve(agentRepo), ".grasseye-local/plugin-tasks/production-runtime",
        entry.task.job_id, "materials", material.displayName);
      const bytes = await readFile(original);
      if (bytes.length !== material.bytes || sha(bytes) !== material.sha256) {
        fail(`LOCALIZATION_PIN_COPY_SOURCE_DRIFT:${entry.locale}:${material.role}`);
      }
      await writeFile(join(folder, material.displayName), bytes, { mode: 0o600 });
      const providerName = gptAttachmentProviderDisplayName(material.displayName,
        entry.task.job_id, entry.task.material_refs[material.ordinal].material_id);
      await writeFile(join(folder, "provider-upload", providerName), bytes,
        { mode: 0o600 });
    }
  }
  const publicManifest = { schemaVersion: "gpt-page-localization-pinned-sources.v1",
    observedAt: new Date().toISOString(), sourceRelationship: "different-article-from-current-seo-qa-turn",
    verification: ["Website job/material/blob metadata", "Website object original bytes",
      "AGENT durable task", "AGENT material original bytes", "Website claim grant result revision"],
    websiteObjectBytesRead: true,
    routePolicyHash: sha(JSON.stringify(route[0])), sourceCodeHashes,
    rootArticleReadback, entries: publicEntries };
  await writeFile(join(output, "localization-source-manifest.json"), JSON.stringify(publicManifest, null, 2) + "\n");
  return { localeCount: publicEntries.length, materialCount: publicEntries.length * 4,
    sourceRootHash: sha(JSON.stringify(sourceIdentity)), manifestHash: sha(JSON.stringify(publicManifest)),
    websiteObjectBytesRead: true };
}

if (process.argv[1] && import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href) {
  const root = process.cwd();
  const result = await pinLocalizationSources({ agentRepo: root,
    websiteRepo: "/Users/nexgen/Documents/xuanxue-web",
    profilePath: "/Users/nexgen/Library/Application Support/Xuanshu/PostgreSQL/profiles/xuanshu-api.json",
    outputDir: join(root, ".agents/skills/gpt-page-operation-evidence/assets") });
  console.log(JSON.stringify(result));
}
